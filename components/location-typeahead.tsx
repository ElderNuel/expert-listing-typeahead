'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import {
  MapPin,
  Search,
  Loader2,
  X,
  AlertCircle,
  RotateCw,
  Compass,
  Building2,
  Check,
} from 'lucide-react';
import { useTypeaheadSearch, type UseTypeaheadSearchOptions } from '../hooks/use-typeahead-search';
import { searchLocations, formatLocationTitle, formatCoordinates } from '../lib/geocoding-api';
import type { GeoLocation, TelemetryLog } from '../types/geo';

/**
 * Props contract for the production LocationTypeahead combobox component.
 */
export interface LocationTypeaheadProps {
  /** Optional explicit element ID for DOM integration. */
  id?: string;
  /** Accessible label displayed above the input and linked via htmlFor. */
  label?: string;
  /** Accessible input placeholder guidance text. */
  placeholder?: string;
  /** Default search query string to seed the input value. */
  defaultValue?: string;
  /** Selection handler invoked when an option is chosen via Click or Enter. */
  onSelect?: (location: GeoLocation) => void;
  /** Observability telemetry listener for dispatch, abort, and cache auditing. */
  onTelemetry?: (log: TelemetryLog) => void;
  /** Keystroke debounce quiet window in milliseconds (defaults to 300ms). */
  debounceDelayMs?: number;
  /** Minimum character threshold before querying upstream (defaults to 2). */
  minQueryLength?: number;
  /** Artificial latency simulator for edge-case and race-condition testing. */
  simulateLatencyMs?: number;
  /** Synthetic error simulator (503 Service Unavailable) for resilience testing. */
  simulateError?: boolean;
  /** Custom CSS classes for the root container element. */
  className?: string;
  /** Whether the combobox input should automatically focus on mount. */
  autoFocus?: boolean;
}

/**
 * Production-ready, zero-dependency WAI-ARIA 1.2 Geographic Combobox.
 *
 * Implements strict accessibility patterns:
 * - `role="combobox"` on the input element with dynamic `aria-expanded` and `aria-controls`.
 * - Virtual focus management using `aria-activedescendant` linked to option IDs.
 * - Full roving keyboard navigation (<kbd>↓/↑</kbd>, <kbd>Home/End</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>).
 * - Screen-reader live region announcements (`aria-live="polite"`).
 * - Click-outside dismissal and automatic scroll alignment for active items.
 */
export function LocationTypeahead({
  id: explicitId,
  label = 'Search Location or Property Hub',
  placeholder = 'Try "Lekki", "Victoria Island", "Ikeja", "Abuja", or any global city...',
  defaultValue = '',
  onSelect,
  onTelemetry,
  debounceDelayMs = 300,
  minQueryLength = 2,
  simulateLatencyMs = 0,
  simulateError = false,
  className = '',
  autoFocus = false,
}: LocationTypeaheadProps) {
  const generatedId = useId();
  const inputId = explicitId || `typeahead-input-${generatedId}`;
  const listboxId = `typeahead-listbox-${generatedId}`;
  const helperId = `typeahead-helper-${generatedId}`;
  const errorId = `typeahead-error-${generatedId}`;

  // Local state
  const [inputValue, setInputValue] = useState<string>(defaultValue);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [rawActiveIndex, setRawActiveIndex] = useState<number>(-1);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  // Component DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Wire custom debounced & cancellation-protected search hook
  const searchOptions: UseTypeaheadSearchOptions<GeoLocation> = {
    delayMs: debounceDelayMs,
    minQueryLength,
    onTelemetry,
    simulateLatencyMs,
    simulateError,
  };

  const {
    status,
    results,
    error,
    debouncedQuery,
    retry,
    clear: clearSearch,
  } = useTypeaheadSearch<GeoLocation>(inputValue, searchLocations, searchOptions);

  // Guard activeIndex within results bounds
  const activeIndex =
    rawActiveIndex >= 0 && rawActiveIndex < results.length ? rawActiveIndex : -1;

  // Auto-scroll active item into visible listbox boundary
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeElement = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Click outside listener for resilient dismissal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setRawActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Selection handler
  const handleSelect = useCallback(
    (location: GeoLocation) => {
      const formattedTitle = formatLocationTitle(location);
      setInputValue(formattedTitle);
      setSelectedLocation(location);
      setIsOpen(false);
      setRawActiveIndex(-1);
      if (onSelect) {
        onSelect(location);
      }
      inputRef.current?.focus();
    },
    [onSelect]
  );

  // Clear handler
  const handleClear = useCallback(() => {
    setInputValue('');
    setSelectedLocation(null);
    setIsOpen(false);
    setRawActiveIndex(-1);
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  // Change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setRawActiveIndex(-1);
    if (val.trim().length >= minQueryLength) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Keyboard navigation strictly adhering to WAI-ARIA 1.2 Combobox
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          if (results.length > 0) setRawActiveIndex(0);
        } else if (results.length > 0) {
          setRawActiveIndex((prev) => (prev + 1) % results.length);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          if (results.length > 0) setRawActiveIndex(results.length - 1);
        } else if (results.length > 0) {
          setRawActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
        }
        break;
      }
      case 'Home': {
        if (isOpen && results.length > 0) {
          e.preventDefault();
          setRawActiveIndex(0);
        }
        break;
      }
      case 'End': {
        if (isOpen && results.length > 0) {
          e.preventDefault();
          setRawActiveIndex(results.length - 1);
        }
        break;
      }
      case 'Enter': {
        if (isOpen && activeIndex >= 0 && results[activeIndex]) {
          e.preventDefault();
          handleSelect(results[activeIndex]);
        }
        break;
      }
      case 'Escape': {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          setRawActiveIndex(-1);
        }
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        setRawActiveIndex(-1);
        break;
      }
      default:
        break;
    }
  };

  const activeOptionId =
    activeIndex >= 0 && results[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  // Determine if dropdown should be displayed
  const shouldShowDropdown =
    isOpen &&
    inputValue.trim().length >= minQueryLength &&
    (status === 'loading' || status === 'success' || status === 'empty' || status === 'error');

  return (
    <div
      ref={containerRef}
      id={`typeahead-container-${generatedId}`}
      className={`relative w-full text-slate-800 ${className}`}
    >
      {/* Accessible Label */}
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={inputId}
          id={`typeahead-label-${generatedId}`}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          {label}
        </label>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 font-medium">
          WAI-ARIA 1.2 Combobox
        </span>
      </div>

      {/* Input Group */}
      <div className="relative flex items-center group">
        <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400 group-focus-within:text-emerald-600 transition-colors">
          <Search className="h-4 w-4" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shouldShowDropdown}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-invalid={status === 'error'}
          aria-describedby={status === 'error' ? errorId : helperId}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue.trim().length >= minQueryLength) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-white pl-10 pr-24 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all focus:outline-none focus:ring-2 ${
            status === 'error'
              ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 hover:border-slate-400 focus:border-emerald-600 focus:ring-emerald-500/20'
          }`}
        />

        {/* Right-aligned Status / Action Icons */}
        <div className="absolute right-3 flex items-center gap-1.5 text-slate-400">
          {status === 'loading' && (
            <div
              role="status"
              aria-label="Searching locations..."
              className="flex items-center text-emerald-600 animate-spin"
            >
              <Loader2 className="h-4 w-4" />
            </div>
          )}

          {inputValue.length > 0 && (
            <button
              id={`typeahead-clear-btn-${generatedId}`}
              type="button"
              onClick={handleClear}
              aria-label="Clear location input"
              className="rounded-lg p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          <div className="hidden sm:flex items-center text-[10px] font-mono font-medium uppercase bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md shadow-2xs">
            ↓↑ Nav
          </div>
        </div>
      </div>

      {/* Screen reader live announcements */}
      <div
        id={helperId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === 'loading' && 'Fetching location suggestions...'}
        {status === 'success' && `${results.length} locations available. Use Up and Down arrow keys to navigate.`}
        {status === 'empty' && `No locations found matching ${debouncedQuery}`}
        {status === 'error' && `Error searching locations: ${error}`}
      </div>

      {/* Dropdown Menu Container */}
      {shouldShowDropdown && (
        <div
          id={`typeahead-menu-${generatedId}`}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* STATE: LOADING SKELETON */}
          {status === 'loading' && results.length === 0 && (
            <div
              id={`typeahead-loading-state-${generatedId}`}
              className="p-3.5 space-y-2.5"
              role="status"
            >
              <div className="flex items-center justify-between px-2 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span className="text-slate-600 font-medium">Querying global geocodes...</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">300ms Debounce</span>
              </div>
              {[1, 2, 3].map((skeletonIndex) => (
                <div
                  key={skeletonIndex}
                  className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50/80 animate-pulse border border-slate-100"
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STATE: SUCCESS / RESULTS LIST */}
          {status === 'success' && results.length > 0 && (
            <ul
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label="Location search suggestions"
              className="max-h-80 overflow-y-auto p-1.5 text-sm focus:outline-none space-y-1"
            >
              {results.map((item, index) => {
                const isSelected = activeIndex === index;
                const itemId = `${listboxId}-option-${index}`;
                const isCurrentSelection = selectedLocation?.id === item.id;

                return (
                  <li
                    key={`${item.id}-${index}`}
                    id={itemId}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setRawActiveIndex(index)}
                    className={`flex items-start gap-3.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all select-none border ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950 shadow-xs'
                        : 'border-transparent hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-emerald-300 bg-emerald-100/80 text-emerald-700'
                          : 'border-slate-200 bg-slate-100/70 text-slate-500'
                      }`}
                    >
                      {item.feature_code?.startsWith('PPL') || !item.admin1 ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate text-slate-900">
                          {item.name}
                        </span>
                        {item.country_code && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 border border-slate-200">
                            {item.country_code}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        {item.admin1 && <span className="font-medium text-slate-600">{item.admin1} ·</span>}
                        <span>{item.country || 'Global Entity'}</span>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <Compass className="h-3 w-3 text-slate-400" />
                          {formatCoordinates(item.latitude, item.longitude)}
                        </span>
                        {item.timezone && (
                          <span className="hidden sm:inline">· {item.timezone}</span>
                        )}
                      </div>
                    </div>

                    {isCurrentSelection && (
                      <div className="mt-1 shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* STATE: EMPTY */}
          {status === 'empty' && (
            <div
              id={`typeahead-empty-state-${generatedId}`}
              className="p-6 text-center"
              role="region"
              aria-label="No results"
            >
              <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <MapPin className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                No matching locations found
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                No geocoded results for &ldquo;{debouncedQuery}&rdquo;. Try checking for typos or searching a broader city, state, or country.
              </p>
            </div>
          )}

          {/* STATE: ERROR WITH RETRY */}
          {status === 'error' && (
            <div
              id={errorId}
              role="alert"
              className="p-4 bg-red-50/70 border-t border-red-100"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-900">
                    Search Service Interrupted
                  </p>
                  <p className="mt-0.5 text-xs text-red-700">
                    {error || 'Unable to fetch location suggestions.'}
                  </p>
                  <button
                    id={`typeahead-retry-btn-${generatedId}`}
                    type="button"
                    onClick={retry}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 transition-colors cursor-pointer"
                  >
                    <RotateCw className="h-3 w-3" />
                    Retry Search
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Bar: Metadata & ARIA shortcuts */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Open-Meteo Geocoding
            </span>
            <div className="flex items-center gap-2">
              <span>Press <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">Esc</kbd> to exit</span>
              <span><kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">↵</kbd> to select</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
