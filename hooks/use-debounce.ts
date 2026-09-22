'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value.
 *
 * Delays updating the returned value until after the specified quiet window (`delayMs`)
 * has elapsed since the last time the source value changed.
 *
 * @template T The type of the value being debounced.
 * @param value The reactive input value (e.g. user keystrokes in a search input).
 * @param delayMs The debounce quiet window in milliseconds (defaults to 300ms).
 * @returns The debounced value, which only updates after typing pauses.
 *
 * @example
 * ```tsx
 * const debouncedQuery = useDebounce(rawQuery, 300);
 * ```
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  // Store the debounced value in local state
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Schedule state update after the specified quiet delay
    const timerHandler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // CLEANUP INVARIANT:
    // If the caller provides a new value before delayMs has elapsed, or if the
    // consuming component unmounts, cancel the pending timer to prevent memory leaks
    // and stale state updates.
    return () => {
      clearTimeout(timerHandler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
