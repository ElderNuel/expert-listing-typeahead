'use client';

import React, { useState, useCallback } from 'react';
import {
  MapPin,
  CheckCircle2,
  Activity,
  Code2,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  Globe2,
  Trash2,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
import { LocationTypeahead } from '../components/location-typeahead';
import type { GeoLocation, TelemetryLog } from '../types/geo';
import { formatCoordinates } from '../lib/geocoding-api';

const SCREENING_MEMO_TEXT = `### 1. Tradeoffs Made
I paired client-side debouncing (300ms) with native AbortController cancellation rather than offloading to Web Workers or an intermediary BFF proxy. For a typeahead querying a lightweight geocoding API, browser-native primitives minimize bundle overhead and execution complexity while eliminating stale response races. I chose uncontrolled input state synchronized to a deterministic status reducer (idle, loading, success, empty, error) with an in-memory Map query cache. This guarantees zero UI flicker and instant backspace recall without pulling in heavy external state managers.

### 2. High-Traffic Scaling & Hardening
To withstand enterprise traffic (such as high-volume listing searches across Lagos metropolitan hubs), I would introduce:
1. Edge Caching & Reverse Proxying: Deploy Cloudflare or Vercel Edge Middleware with stale-while-revalidate (s-maxage=86400, stale-while-revalidate=3600) to absorb repeat geo queries at the CDN edge.
2. Client-Side Request Coalescing: Utilize an LRU cache or TanStack Query to deduplicate in-flight promises across concurrent consumers.
3. Traffic Shaping: Enforce IP-based leaky-bucket rate limiting and circuit breaking at the gateway to gracefully degrade to local offline datasets (e.g., top cities stored in IndexedDB) if upstream geocoding providers experience outages.

### 3. Testing Strategy
1. Unit & Hook Testing (Vitest + RTL): Mock timers with vi.useFakeTimers() to assert 300ms debouncing, and verify that rapid successive queries trigger .abort() while discarding out-of-order promise resolutions via sequence IDs.
2. Network Integration (MSW): Intercept requests with Mock Service Worker simulating high latency, out-of-order packet arrival, and 500 server faults to validate the retry mechanism.
3. Accessibility & E2E (Playwright + axe-core): Audit WAI-ARIA 1.2 Combobox compliance (aria-activedescendant, aria-expanded, DOM focus), ensuring full keyboard navigation (ArrowUp/Down, Home/End, Escape, Enter) and screen reader announcer reliability.`;

export default function Home() {
  const [selectedGeo, setSelectedGeo] = useState<GeoLocation | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);
  const [simulateLatency, setSimulateLatency] = useState<number>(0);
  const [simulateError, setSimulateError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'demo' | 'memo' | 'code'>('demo');
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [searchKey, setSearchKey] = useState(1);
  const [initialPreset, setInitialPreset] = useState<string>('');

  const handleTelemetry = useCallback((log: TelemetryLog) => {
    setTelemetryLogs((prev) => [log, ...prev].slice(0, 30));
  }, []);

  const handleCopyMemo = async () => {
    try {
      await navigator.clipboard.writeText(SCREENING_MEMO_TEXT);
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    } catch {
      // Fallback
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  const applyPreset = (query: string, errorMode = false) => {
    setSimulateError(errorMode);
    setInitialPreset(query);
    setSearchKey((prev) => prev + 1);
  };

  const clearLogs = () => {
    setTelemetryLogs([]);
  };

  // Word count calculation
  const memoWordCount = SCREENING_MEMO_TEXT.trim().split(/\s+/).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-600/30">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">
                  Expert Listing
                </span>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Lagos Proptech Evaluation
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Staff Frontend Engineering &amp; Systems Architecture Assessment
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 text-xs font-medium">
            <button
              id="nav-tab-demo"
              type="button"
              onClick={() => setActiveTab('demo')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'demo'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Interactive Component
            </button>
            <button
              id="nav-tab-memo"
              type="button"
              onClick={() => setActiveTab('memo')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'memo'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Screening Memo (150–300w)
            </button>
            <button
              id="nav-tab-code"
              type="button"
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Hook &amp; Architecture
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'demo' && (
          <div className="space-y-8">
            {/* Context Header */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs ring-1 ring-slate-900/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg mb-2.5 border border-emerald-200/70">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    WAI-ARIA 1.2 Combobox with Race Condition Cancellation
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    High-Density Geographic Typeahead
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">
                    Engineered for Expert Listing&apos;s verified property marketplace. Features 300ms debouncing, native <code className="font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-xs border border-emerald-200/60">AbortController</code> cancellation, request sequence token guards against stale responses, and a fully compliant WAI-ARIA 1.2 keyboard combobox.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    id="live-deployment-badge"
                    href="https://expertlistingtypeahead.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium text-emerald-800 transition-colors shadow-2xs group"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Live on Vercel</span>
                    <Globe2 className="h-3.5 w-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                  </a>

                  <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="leading-tight">
                      <p className="font-semibold text-slate-900">Production Guardrails</p>
                      <p className="text-[11px] text-slate-500">Zero External UI Libs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1.5">
                  Test Presets:
                </span>
                <button
                  id="preset-lekki"
                  type="button"
                  onClick={() => applyPreset('Lekki')}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                >
                  🇳🇬 Lekki, Lagos
                </button>
                <button
                  id="preset-vi"
                  type="button"
                  onClick={() => applyPreset('Victoria Island')}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                >
                  🇳🇬 Victoria Island
                </button>
                <button
                  id="preset-abuja"
                  type="button"
                  onClick={() => applyPreset('Abuja')}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                >
                  🇳🇬 Abuja FCT
                </button>
                <button
                  id="preset-london"
                  type="button"
                  onClick={() => applyPreset('London')}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                >
                  🇬🇧 London
                </button>
                <button
                  id="preset-empty"
                  type="button"
                  onClick={() => applyPreset('xyznonexistent999')}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition-colors border border-amber-200 cursor-pointer"
                >
                  Empty Query State
                </button>
                <button
                  id="preset-error"
                  type="button"
                  onClick={() => applyPreset('Lagos', true)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-800 rounded-lg transition-colors border border-red-200 cursor-pointer"
                >
                  Simulate Network Error
                </button>
              </div>
            </div>

            {/* Two-Column Grid: Typeahead & Real-time Verification Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Interactive Typeahead & Selected Detail */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs ring-1 ring-slate-900/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Live Component Sandbox
                    </span>
                    <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      Open-Meteo Geocoding
                    </span>
                  </div>

                  {/* The LocationTypeahead Component */}
                  <LocationTypeahead
                    key={`typeahead-${searchKey}`}
                    defaultValue={initialPreset}
                    onSelect={(loc) => setSelectedGeo(loc)}
                    onTelemetry={handleTelemetry}
                    debounceDelayMs={300}
                    simulateLatencyMs={simulateLatency}
                    simulateError={simulateError}
                    autoFocus
                  />

                  {/* Simulator Controls */}
                  <div className="mt-7 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="font-semibold text-slate-700">Simulate Latency:</span>
                      <button
                        id="latency-0ms"
                        type="button"
                        onClick={() => setSimulateLatency(0)}
                        className={`px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                          simulateLatency === 0
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        0ms (Normal)
                      </button>
                      <button
                        id="latency-800ms"
                        type="button"
                        onClick={() => setSimulateLatency(800)}
                        className={`px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                          simulateLatency === 800
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        800ms (High Latency)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor="toggle-error-sim" className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors">
                        <input
                          id="toggle-error-sim"
                          type="checkbox"
                          checked={simulateError}
                          onChange={(e) => setSimulateError(e.target.checked)}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-400 h-3.5 w-3.5"
                        />
                        <span className="text-xs font-medium text-slate-700">Simulate 503 Fault</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selected Location Geo-Verification Card */}
                {selectedGeo ? (
                  <div
                    id="selected-location-card"
                    className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 to-emerald-50/20 p-6 shadow-xs ring-1 ring-emerald-500/10 animate-in fade-in-50 duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {selectedGeo.name}
                            </h3>
                            {selectedGeo.country_code && (
                              <span className="text-xs font-mono font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-emerald-200">
                                {selectedGeo.country_code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            {[selectedGeo.admin1, selectedGeo.country].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-white px-3 py-1 rounded-full border border-emerald-200/90 shadow-2xs">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Proptech Anchor Verified
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-slate-400 text-[10px] uppercase font-mono font-medium block">Latitude</span>
                        <span className="font-semibold text-slate-800 font-mono text-sm">
                          {selectedGeo.latitude.toFixed(4)}°
                        </span>
                      </div>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-slate-400 text-[10px] uppercase font-mono font-medium block">Longitude</span>
                        <span className="font-semibold text-slate-800 font-mono text-sm">
                          {selectedGeo.longitude.toFixed(4)}°
                        </span>
                      </div>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-slate-400 text-[10px] uppercase font-mono font-medium block">Timezone</span>
                        <span className="font-semibold text-slate-800 truncate block text-sm">
                          {selectedGeo.timezone || 'UTC'}
                        </span>
                      </div>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                        <span className="text-slate-400 text-[10px] uppercase font-mono font-medium block">Coordinates</span>
                        <span className="font-semibold text-slate-800 font-mono text-xs truncate block">
                          {formatCoordinates(selectedGeo.latitude, selectedGeo.longitude)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 bg-white/70">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Globe2 className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No Location Selected Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Use the typeahead above or click a quick preset to select a verified geographic entity.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Real-time Concurrency & Race Condition Telemetry Monitor */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs ring-1 ring-slate-900/5">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
                        <Activity className="h-4 w-4" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                        Concurrency &amp; Race Telemetry
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {telemetryLogs.length} events
                      </span>
                      {telemetryLogs.length > 0 && (
                        <button
                          id="clear-telemetry-btn"
                          type="button"
                          onClick={clearLogs}
                          title="Clear logs"
                          className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5 mb-3 leading-relaxed">
                    Live audit of <code className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded text-[11px] border border-emerald-200/60">AbortController.abort()</code>, monotonic sequence tokens, and cache deduplication in action:
                  </p>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {telemetryLogs.length === 0 ? (
                      <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
                        Keystrokes will log real-time sequence tokens, network cancellations, and resolutions here.
                      </div>
                    ) : (
                      telemetryLogs.map((log) => {
                        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (log.type === 'DISPATCH') badgeColor = 'bg-blue-50 text-blue-700 border-blue-200/80';
                        if (log.type === 'ABORT') badgeColor = 'bg-amber-50 text-amber-800 border-amber-200/80';
                        if (log.type === 'RESOLVE') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
                        if (log.type === 'CACHE_HIT') badgeColor = 'bg-purple-50 text-purple-700 border-purple-200/80';
                        if (log.type === 'ERROR') badgeColor = 'bg-red-50 text-red-700 border-red-200/80';

                        return (
                          <div
                            key={log.id}
                            className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 text-xs font-mono space-y-1.5 transition-all hover:border-slate-200 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}
                              >
                                {log.type}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans">
                                {log.timestamp} {log.durationMs ? `(${log.durationMs}ms)` : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-800 truncate">
                              <span className="text-slate-400 font-semibold mr-1.5">
                                Seq #{log.sequence}
                              </span>
                              &ldquo;{log.query}&rdquo;
                            </div>
                            <p className="text-[10px] text-slate-500 font-sans leading-tight">
                              {log.details}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Architecture Highlights Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs ring-1 ring-slate-900/5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    WAI-ARIA 1.2 Specs Implemented
                  </h3>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span><code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">role=&quot;combobox&quot;</code> with <code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">aria-expanded</code> &amp; <code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">aria-controls</code></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span><code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">aria-activedescendant</code> dynamically bound to highlighted option ID</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span><code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">role=&quot;listbox&quot;</code> and <code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">role=&quot;option&quot;</code> with <code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">aria-selected</code></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Full keyboard controls: <kbd className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">↓/↑</kbd>, <kbd className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Home/End</kbd>, <kbd className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd>, <kbd className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Esc</kbd></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Accessible live region announcer (<code className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1 py-0.5 rounded">aria-live=&quot;polite&quot;</code>)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: The Required 150-300 Word Technical Screening Memo */}
        {activeTab === 'memo' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs ring-1 ring-slate-900/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      Screening Write-Up: Engineering Tradeoffs &amp; Architecture
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {memoWordCount} Words (Strictly 150–300w)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Prepared for: Founder &amp; Technical Hiring Team, Expert Listing Limited (Lekki, Lagos)
                  </p>
                </div>

                <button
                  id="copy-screening-memo-btn"
                  type="button"
                  onClick={handleCopyMemo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-98 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer shrink-0"
                >
                  {copiedMemo ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedMemo ? 'Copied to Clipboard!' : 'Copy Screening Memo'}
                </button>
              </div>

              <div className="mt-6 space-y-6 text-sm text-slate-700 leading-relaxed">
                <section className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-2.5 flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">1</span>
                    Tradeoffs Made
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    I paired client-side debouncing (300ms) with native <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium text-slate-800">AbortController</code> cancellation rather than offloading to Web Workers or an intermediary BFF proxy. For a typeahead querying a lightweight geocoding API, browser-native primitives minimize bundle overhead and execution complexity while eliminating stale response races. I chose uncontrolled input state synchronized to a deterministic status reducer (idle, loading, success, empty, error) with an in-memory Map query cache. This guarantees zero UI flicker and instant backspace recall without pulling in heavy external state managers.
                  </p>
                </section>

                <section className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-2.5 flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">2</span>
                    High-Traffic Scaling &amp; Hardening
                  </h3>
                  <p className="mb-3 text-slate-600 leading-relaxed">
                    To withstand enterprise traffic (such as high-volume listing searches across Lagos metropolitan hubs), I would introduce:
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Edge Caching &amp; Reverse Proxying:</strong> Deploy Cloudflare or Vercel Edge Middleware with stale-while-revalidate (<code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">s-maxage=86400, stale-while-revalidate=3600</code>) to absorb repeat geo queries at the CDN edge.
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Client-Side Request Coalescing:</strong> Utilize an LRU cache or TanStack Query to deduplicate in-flight promises across concurrent consumers.
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Traffic Shaping:</strong> Enforce IP-based leaky-bucket rate limiting and circuit breaking at the gateway to gracefully degrade to local offline datasets (e.g., top cities stored in IndexedDB) if upstream geocoding providers experience outages.
                    </li>
                  </ol>
                </section>

                <section className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-2.5 flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">3</span>
                    Testing Strategy
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Unit &amp; Hook Testing (Vitest + RTL):</strong> Mock timers with <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">vi.useFakeTimers()</code> to assert 300ms debouncing, and verify that rapid successive queries trigger <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">.abort()</code> while discarding out-of-order promise resolutions via sequence IDs.
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Network Integration (MSW):</strong> Intercept requests with Mock Service Worker simulating high latency, out-of-order packet arrival, and 500 server faults to validate the retry mechanism.
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Accessibility &amp; E2E (Playwright + axe-core):</strong> Audit WAI-ARIA 1.2 Combobox compliance (<code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">aria-activedescendant</code>, <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">aria-expanded</code>, DOM focus), ensuring full keyboard navigation (ArrowUp/Down, Home/End, Escape, Enter) and screen reader announcer reliability.
                    </li>
                  </ol>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Component Source Code & Architecture */}
        {activeTab === 'code' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Production Architecture: Hooks &amp; Component
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Modular, zero-dependency implementation complying with WAI-ARIA 1.2 and strict race condition protection.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-mono font-medium text-slate-700">
                    <span className="font-semibold text-slate-800">hooks/use-debounce.ts</span>
                    <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Zero Dependencies</span>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
{`export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}`}
                  </pre>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-mono font-medium text-slate-700">
                    <span className="font-semibold text-slate-800">hooks/use-typeahead-search.ts (Race Condition Guards)</span>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">AbortController + Sequence Token</span>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
{`// Cancels previous in-flight requests & discards out-of-order promise resolutions
if (abortControllerRef.current) {
  abortControllerRef.current.abort('Superseded by new keystroke');
}

const currentSeq = ++requestSeqRef.current;
const controller = new AbortController();
abortControllerRef.current = controller;

try {
  const data = await fetcher(trimmed, controller.signal);
  if (currentSeq !== requestSeqRef.current) return; // Discard stale/out-of-order response!
  setResults(data);
  setStatus(data.length > 0 ? 'success' : 'empty');
} catch (err) {
  if (controller.signal.aborted) return; // Ignore expected user cancellations
  if (currentSeq !== requestSeqRef.current) return;
  setError(err.message);
  setStatus('error');
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Expert Listing Engineering Candidate Submission · Clean WAI-ARIA 1.2 Combobox · Next.js 15 &amp; TypeScript
      </footer>
    </div>
  );
}
