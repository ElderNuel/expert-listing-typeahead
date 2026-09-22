'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import type { SearchStatus, TelemetryLog } from '../types/geo';

/**
 * Configuration options for the typeahead search hook.
 */
export interface UseTypeaheadSearchOptions<T> {
  /** Keystroke debounce quiet window in milliseconds. Defaults to 300ms. */
  delayMs?: number;
  /** Minimum character threshold before querying the upstream API. Defaults to 2. */
  minQueryLength?: number;
  /** Cache time-to-live in milliseconds. */
  cacheTtlMs?: number;
  /** Observability hook for telemetry events (dispatches, aborts, cache hits). */
  onTelemetry?: (log: TelemetryLog) => void;
  /** Artificial latency simulator in milliseconds for edge-case testing. */
  simulateLatencyMs?: number;
  /** Synthetic 503 network fault injector for resiliency testing. */
  simulateError?: boolean;
}

/**
 * Return contract representing the deterministic state and controls of the search hook.
 */
export interface UseTypeaheadSearchResult<T> {
  /** The discrete state machine value: 'idle' | 'loading' | 'success' | 'empty' | 'error'. */
  status: SearchStatus;
  /** The normalized array of search results for the current active query. */
  results: T[];
  /** Error message if the search or network request failed. */
  error: string | null;
  /** The current debounced query string driving the state. */
  debouncedQuery: string;
  /** Monotonically increasing sequence token of the active request. */
  activeSequence: number;
  /** Trigger a fresh re-fetch of the current query (e.g. after a network error). */
  retry: () => void;
  /** Reset search state, abort in-flight requests, and clear results. */
  clear: () => void;
}

/**
 * Enterprise-grade Typeahead search hook featuring:
 * 1. Configurable input debouncing (300ms default) to throttle upstream API consumption.
 * 2. Native AbortController cancellation on subsequent requests, keystrokes, and unmount.
 * 3. Monotonic sequence token guards that discard stale or out-of-order promise resolutions.
 * 4. In-memory LRU query cache to eliminate redundant network roundtrips on backspace/retype.
 * 5. Discrete 5-state state machine: IDLE | LOADING | SUCCESS | EMPTY | ERROR.
 *
 * @template T Type of geographic item or search result entity.
 * @param query The raw input string typed by the user.
 * @param fetcher Async function returning search results, receiving an AbortSignal.
 * @param options Configuration options for debouncing, caching, and telemetry.
 * @returns An object containing results, state status, error messages, and control callbacks.
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

  // Discrete state machine status
  const [rawStatus, setRawStatus] = useState<SearchStatus>('idle');
  // Current active result collection
  const [results, setResults] = useState<T[]>([]);
  // Error container for user-friendly error banners
  const [error, setError] = useState<string | null>(null);
  // Monotonic sequence token exposed to telemetry for verification
  const [activeSequence, setActiveSequence] = useState<number>(0);
  // Retry counter to trigger re-execution on demand
  const [retryCount, setRetryCount] = useState<number>(0);

  // Debounced query string
  const debouncedQuery = useDebounce<string>(query.trim(), delayMs);

  // Concurrency & network refs:
  // Active AbortController instance for in-flight cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Monotonically increasing request counter to identify out-of-order packets
  const requestSeqRef = useRef<number>(0);
  // In-memory query cache storing previous results
  const cacheRef = useRef<Map<string, { data: T[]; timestamp: number }>>(new Map());

  // Observability telemetry logger
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

  // Explicit clear action: aborts in-flight requests and resets to clean state
  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('User cleared search');
      abortControllerRef.current = null;
    }
    // Increment sequence so any pending promise will be ignored
    requestSeqRef.current++;
    setActiveSequence((s) => s + 1);
    setRawStatus('idle');
    setResults([]);
    setError(null);
  }, []);

  // Explicit retry trigger for recovering from network or upstream faults
  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  // Determine whether the query satisfies the minimum character length
  const isQueryEligible = debouncedQuery.length >= minQueryLength;

  useEffect(() => {
    // GUARD: If query is below threshold, ensure any pending request is immediately aborted
    if (!isQueryEligible) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Query below threshold');
        abortControllerRef.current = null;
      }
      return;
    }

    const trimmed = debouncedQuery;
    const cacheKey = trimmed.toLowerCase();

    // DUAL-LAYER RACE GUARD 1 (NETWORK):
    // Cancel prior in-flight fetch before spawning a new one
    if (abortControllerRef.current) {
      logTelemetry('ABORT', requestSeqRef.current, trimmed, 'Aborted previous in-flight request');
      abortControllerRef.current.abort('Superseded by new keystroke');
      abortControllerRef.current = null;
    }

    // DUAL-LAYER RACE GUARD 2 (MEMORY TOKEN):
    // Increment sequence counter to uniquely fingerprint this request cycle
    const currentSeq = ++requestSeqRef.current;
    setActiveSequence(currentSeq);

    // Initialize fresh AbortController for this fetch invocation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Local closure flag tracking whether this effect run has been dismantled
    let isDisposed = false;

    const executeFetch = async () => {
      // CACHE OPTIMIZATION: Check in-memory map before performing network I/O
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

      // Enter LOADING status
      setRawStatus('loading');
      setError(null);
      logTelemetry('DISPATCH', currentSeq, trimmed, 'Dispatched API request with AbortSignal');
      const startTime = performance.now();

      try {
        // Developer simulator: artificial latency
        if (simulateLatencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
        }

        // Developer simulator: synthetic 503 error injection
        if (simulateError) {
          throw new Error('Simulated network fault: 503 Service Unavailable');
        }

        // Dispatch upstream fetch with AbortSignal
        const data = await fetcher(trimmed, controller.signal);

        // RACE CONDITION INVARIANT:
        // If a newer keystroke has already fired, our sequence token is now stale.
        // Discard this response immediately to prevent overwriting newer state.
        if (isDisposed || currentSeq !== requestSeqRef.current) {
          logTelemetry(
            'ABORT',
            currentSeq,
            trimmed,
            `Discarded stale response (Seq #${currentSeq} vs Current #${requestSeqRef.current})`
          );
          return;
        }

        // Cache the successful result set
        cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
        const duration = Math.round(performance.now() - startTime);
        logTelemetry('RESOLVE', currentSeq, trimmed, `Resolved ${data.length} items`, duration);

        // Commit results to state
        setResults(data);
        setRawStatus(data.length > 0 ? 'success' : 'empty');
        setError(null);
      } catch (err: unknown) {
        // AbortError is intentional behavior when the user types rapidly; ignore silently
        if (
          isDisposed ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          controller.signal.aborted
        ) {
          return;
        }

        // Ignore errors from stale requests that were superseded
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
        // Cleanup ref once this request finishes
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    };

    executeFetch();

    // TEARDOWN INVARIANT:
    // When effect re-runs or component unmounts, abort the active HTTP stream
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

  // DERIVED STATE:
  // If the query is currently shorter than minQueryLength, enforce 'idle' with zero results
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
