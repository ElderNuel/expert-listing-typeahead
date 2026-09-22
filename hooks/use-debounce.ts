'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value.
 * Delays updating the debounced value until after the specified delay has elapsed
 * since the last time the source value changed.
 *
 * @param value The value to debounce
 * @param delayMs Debounce delay in milliseconds (defaults to 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // Tear down pending timer whenever value or delay changes, or on unmount
    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
