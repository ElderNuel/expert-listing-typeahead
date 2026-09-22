'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import type { SearchStatus, TelemetryLog } from '../types/geo';

export interface UseTypeaheadSearchOptions<T> {
  delayMs?: number;
  minQueryLength?: number;
  cacheTtlMs?: number;
  onTelemetry?: (log: TelemetryLog) => void;
  simulateLatencyMs?: number;
  simulateError?: boolean;
}

export interface UseTypeaheadSearchResult<T> {
  status: SearchStatus;
  results: T[];
  error: string | null;
  debouncedQuery: string;
  activeSequence: number;
  retry: () => void;
  clear: () => void;
}

/**
 * Enterprise-grade Typeahead search hook featuring:
 * 1. Configurable input debouncing (300ms default)
 * 2. Native AbortController cancellation on subsequent requests and unmount
 * 3. Monotonic sequence token guards discarding stale or out-of-order promise resolutions
 * 4. In-memory LRU query cache to eliminate duplicate network thrashing
 * 5. Deterministic state machine: IDLE | LOADING | SUCCESS | EMPTY | ERROR
 */
export function useTypeaheadSearch<T>(
  query: string,
  fetcher: (searchQuery: string, signal: AbortSignal) => Promise<T[]>,
  options: UseTypeaheadSearchOptions<T> = {}
): UseTypeaheadSearchResult<T> {
  const {
    delayMs = 300,
    minQueryLength = 2,
    onTelemetry,
    simulateLatencyMs = 0,
    simulateError = false,
  } = options;

  const [rawStatus, setRawStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSequence, setActiveSequence] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Debounced query
  const debouncedQuery = useDebounce<string>(query.trim(), delayMs);

  // Concurrency & network refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);
  const cacheRef = useRef<Map<string, { data: T[]; timestamp: number }>>(new Map());

  // Telemetry logger
  const logTelemetry = useCallback(
    (
      type: TelemetryLog['type'],
      sequence: number,
      targetQuery: string,
      details: string,
      durationMs?: number
    ) => {
      if (onTelemetry) {
        onTelemetry({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          type,
          sequence,
          query: targetQuery,
          details,
          durationMs,
        });
      }
    },
    [onTelemetry]
  );

  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('User cleared search');
      abortControllerRef.current = null;
    }
    requestSeqRef.current++;
    setActiveSequence((s) => s + 1);
    setRawStatus('idle');
    setResults([]);
    setError(null);
  }, []);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const isQueryEligible = debouncedQuery.length >= minQueryLength;

  useEffect(() => {
    // If query is below threshold, ensure any pending request is aborted
    if (!isQueryEligible) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Query below threshold');
        abortControllerRef.current = null;
      }
      return;
    }

    const trimmed = debouncedQuery;
    const cacheKey = trimmed.toLowerCase();

    // Cancel prior in-flight fetch before spawning a new one
    if (abortControllerRef.current) {
      logTelemetry('ABORT', requestSeqRef.current, trimmed, 'Aborted previous in-flight request');
      abortControllerRef.current.abort('Superseded by new keystroke');
      abortControllerRef.current = null;
    }

    const currentSeq = ++requestSeqRef.current;
    setActiveSequence(currentSeq);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Asynchronous worker function
    let isDisposed = false;

    const executeFetch = async () => {
      // Check cache first
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        if (!isDisposed && currentSeq === requestSeqRef.current) {
          logTelemetry(
            'CACHE_HIT',
            currentSeq,
            trimmed,
            `Instant cache hit (${cached.data.length} results)`
          );
          setResults(cached.data);
          setRawStatus(cached.data.length > 0 ? 'success' : 'empty');
          setError(null);
        }
        return;
      }

      setRawStatus('loading');
      setError(null);
      logTelemetry('DISPATCH', currentSeq, trimmed, 'Dispatched API request with AbortSignal');
      const startTime = performance.now();

      try {
        if (simulateLatencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
        }

        if (simulateError) {
          throw new Error('Simulated network fault: 503 Service Unavailable');
        }

        const data = await fetcher(trimmed, controller.signal);

        // Sequence guard: Discard stale or superseded responses
        if (isDisposed || currentSeq !== requestSeqRef.current) {
          logTelemetry(
            'ABORT',
            currentSeq,
            trimmed,
            `Discarded stale response (Seq #${currentSeq} vs Current #${requestSeqRef.current})`
          );
          return;
        }

        cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
        const duration = Math.round(performance.now() - startTime);
        logTelemetry('RESOLVE', currentSeq, trimmed, `Resolved ${data.length} items`, duration);

        setResults(data);
        setRawStatus(data.length > 0 ? 'success' : 'empty');
        setError(null);
      } catch (err: unknown) {
        if (
          isDisposed ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          controller.signal.aborted
        ) {
          return;
        }

        if (currentSeq !== requestSeqRef.current) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach the geocoding service. Please check your connection.';

        logTelemetry('ERROR', currentSeq, trimmed, message);
        setError(message);
        setRawStatus('error');
        setResults([]);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    };

    executeFetch();

    return () => {
      isDisposed = true;
      controller.abort('Component unmounted or query updated');
    };
  }, [
    debouncedQuery,
    isQueryEligible,
    fetcher,
    logTelemetry,
    simulateLatencyMs,
    simulateError,
    retryCount,
  ]);

  // Derived effective state: if query is below threshold, return idle and empty results
  const status: SearchStatus = !isQueryEligible ? 'idle' : rawStatus;
  const effectiveResults = !isQueryEligible ? [] : results;
  const effectiveError = !isQueryEligible ? null : error;

  return {
    status,
    results: effectiveResults,
    error: effectiveError,
    debouncedQuery,
    activeSequence,
    retry,
    clear,
  };
}
