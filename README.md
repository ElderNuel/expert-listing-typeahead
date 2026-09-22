# Expert Listing — High-Density Geographic Typeahead

> **Staff Frontend Engineering & Systems Architecture Assessment**  
> **Candidate Evaluation for:** Founder & Technical Hiring Team, Expert Listing Limited (Lekki, Lagos, Nigeria)  
> **Production Live URL:** [expertlistingtypeahead.vercel.app](https://expertlistingtypeahead.vercel.app)

---

## 1. Executive Summary & Objective

In high-velocity real estate proptech platforms like **Expert Listing Limited**, location discovery is the single most critical user touchpoint. A sluggish, glitchy, or accessibility-blind search box directly leads to buyer drop-offs, tenant abandonment, and frustrated agents.

This repository implements a production-grade, zero-external-UI-dependency **Geographic Typeahead Combobox** engineered to the strict **WAI-ARIA 1.2 Combobox Specification**. It provides:
1. **Flawless Race Condition Immunity:** Dual-layer network synchronization using browser-native `AbortController` cancellation alongside strictly monotonic sequence tokens.
2. **Deterministic UI Lifecycle:** 5-state discrete state machine (`idle` → `loading` → `success` | `empty` | `error`) with in-memory caching to eliminate layout shift and UI flicker.
3. **Inclusive Assistive Accessibility:** Full keyboard navigation (`ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, `Escape`), active element tracking via `aria-activedescendant`, and screen-reader live announcements (`aria-live="polite"`).
4. **Live Verification Telemetry:** An in-app real-time event monitor that visually logs dispatches, network aborts, cache hits, sequence numbers, and latency in milliseconds.
5. **Exact 150–300 Word Technical Screening Memo:** An executive architecture breakdown addressing design tradeoffs, 100k+ RPS enterprise scaling, and automated testing strategies.

---

## 2. System Architecture & Technical Highlights

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Keystroke Input                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                ┌───────────────────────────────────────┐
                │       useDebounce Hook (300ms)        │
                └───────────────────┬───────────────────┘
                                    │ (Debounced Query)
                                    ▼
                ┌───────────────────────────────────────┐
                │   In-Memory Query Cache Check (Map)   │
                └───────────┬───────────────────────┬───┘
               [Cache Hit]  │                       │ [Cache Miss]
                            ▼                       ▼
                ┌───────────────────────┐   ┌───────────────────────────┐
                │ Immediate Sync Return │   │   Abort In-Flight Request │
                │ (Zero Network I/O)    │   │ (controller.abort('Stale')│
                └───────────────────────┘   └─────────────┬─────────────┘
                                                          │
                                                          ▼
                                            ┌───────────────────────────┐
                                            │ Increment Sequence Token  │
                                            │ (++requestSeqRef.current) │
                                            └─────────────┬─────────────┘
                                                          │
                                                          ▼
                                            ┌───────────────────────────┐
                                            │ Fetch Open-Meteo API      │
                                            │ (signal: controller.signal│
                                            └─────────────┬─────────────┘
                                                          │
                                 ┌────────────────────────┴────────────────────────┐
                                 │                                                 │
                                 ▼                                                 ▼
                  ┌──────────────────────────────┐                  ┌──────────────────────────────┐
                  │ Token == requestSeqRef       │                  │ Token < requestSeqRef        │
                  │ (Current / In-Order)         │                  │ (Stale / Out-of-Order Packet)│
                  └──────────────┬───────────────┘                  └──────────────┬───────────────┘
                                 │                                                 │
                                 ▼                                                 ▼
                  ┌──────────────────────────────┐                  ┌──────────────────────────────┐
                  │ Commit to Results & Cache    │                  │ Silently Discard Payload     │
                  │ Status: 'success' | 'empty'  │                  │ (Guards Against Race Cond.)  │
                  └──────────────────────────────┘                  └──────────────────────────────┘
```

### Key Engineering Guardrails
- **Zero External UI Libraries:** No Radix, no Headless UI, no React-Select. All combobox interaction, roving focus, DOM measurement, and ARIA attributes are implemented using raw React 19 and standard Web APIs.
- **Dual-Layer Race Condition Prevention:**
  - *Layer 1 (Network Level):* Native `AbortController` cancels pending HTTP streams as soon as the user types another character or clears the input, freeing browser connection pools and socket handlers.
  - *Layer 2 (Memory Level):* Sequence tokens (`requestSeqRef.current`) ensure that if a stale promise resolves after a newer query has already returned, the older payload is discarded without mutating state.
- **Graceful Fault Tolerance:** Built-in network error capture with visual retry triggers, handling geocoding outages without crashing parent components.
- **Built-in Fault & Latency Simulator:** Interactive developer controls in the UI allowing the evaluator to test **0ms normal latency**, **800ms artificial packet delay**, and **simulated 503 service failures** on demand.

---

## 3. Directory & File Structure

```
├── app/
│   ├── globals.css              # Global styles, Tailwind v4 imports (@import "tailwindcss")
│   ├── layout.tsx               # Next.js 15 Root layout with synchronized OpenGraph & Twitter tags
│   └── page.tsx                 # Interactive multi-tab evaluation harness (Interactive, Memo, Code)
├── components/
│   └── location-typeahead.tsx   # Production WAI-ARIA 1.2 Combobox component
├── hooks/
│   ├── use-debounce.ts          # Zero-dependency, timer-cleaned debounce hook
│   ├── use-mobile.ts            # Screen breakpoint detection utility
│   └── use-typeahead-search.ts  # State machine, AbortController, sequence token & cache engine
├── lib/
│   ├── geocoding-api.ts         # Open-Meteo geocoding normalization & coordinate formatters
│   └── utils.ts                 # Class variance & tailwind-merge helper (cn)
├── types/
│   └── geo.ts                   # Strict TypeScript contracts (GeoLocation, Status, Telemetry)
├── metadata.json                # AI Studio application metadata & major capabilities
├── package.json                 # Project dependencies & build scripts
├── tsconfig.json                # Strict TypeScript configuration
└── README.md                    # Comprehensive technical documentation & evaluation guide
```

---

## 4. How to Run Locally

### Prerequisites
- **Node.js:** `v20.x` or higher (Node 22 LTS recommended)
- **Package Manager:** `npm` (v10+), `pnpm` (v9+), or `bun`

### Installation & Startup

```bash
# 1. Clone repository or navigate to workspace root
cd expert-listing-typeahead

# 2. Install dependencies (Clean install)
npm install

# 3. Start development server on port 3000
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Build Verification & Linting

```bash
# Run ESLint validation
npm run lint

# Compile production Next.js App Router build
npm run build

# Start production server
npm run start
```

---

## 5. Comprehensive Testing Guide for Evaluators

This assessment is equipped with preset scenarios and real-time telemetry so that the hiring committee can rigorously stress-test the implementation against real-world edge cases.

### Test Scenario A: Rapid Keystrokes & Network Abort Verification
1. Open the **Interactive Component** tab.
2. In the search input, rapidly type `Lekki Phase 1`.
3. **Observe the Concurrency & Race Telemetry panel on the right:**
   - Notice the sequence of `DISPATCH` events.
   - For every keystroke fired before the upstream API finishes, observe the yellow `ABORT` badge confirming `AbortController.abort('Superseded by new keystroke')`.
   - Only the latest sequence token resolves (`RESOLVE`), ensuring zero out-of-order state overwrites.

### Test Scenario B: Cache Deduplication & Instant Backspace Recall
1. Search for `Victoria Island` and let the results load.
2. Hit `Backspace` repeatedly until the input is cleared.
3. Click the preset button **🇳🇬 Victoria Island** or type `Victoria Island` again.
4. **Observe Telemetry:** Notice the purple `CACHE_HIT` event. The component resolves in `<1ms` without dispatching an HTTP request, completely eliminating redundant network load.

### Test Scenario C: Out-of-Order Packet Race Condition (800ms Latency Test)
1. Under **Simulator Controls**, select **800ms (High Latency)**.
2. Type `Abuja`, then immediately type `London`.
3. Notice that `Abuja` is aborted mid-flight. Even if its network response were to resolve delayed, the sequence token guard (`currentSeq !== requestSeqRef.current`) discards it.
4. The input displays results for `London` only.

### Test Scenario D: Network Failure & Resilience Recovery
1. Toggle the **Simulate 503 Fault** checkbox.
2. Type `Lagos`.
3. The combobox displays an accessible error state: *"Search Service Interrupted — Upstream HTTP 503 Geocoding Outage"*.
4. Untick the checkbox and click **Retry Search**.
5. The component recovers immediately and renders verified coordinates.

### Test Scenario E: WAI-ARIA 1.2 Assistive Keyboard Navigation
1. Click the input or press `Tab` to focus.
2. Type `Lekki`.
3. Press <kbd>↓</kbd> (Down Arrow): Observe the first option highlighted. Inspect the DOM in DevTools to verify that `aria-activedescendant` is dynamically linked to that option's generated ID.
4. Press <kbd>End</kbd>: Focus jumps instantly to the last suggestion.
5. Press <kbd>Home</kbd>: Focus returns to the first suggestion.
6. Press <kbd>Enter</kbd>: Selects the item, closes the dropdown, updates the input value, and populates the **Proptech Anchor Verified** detail card.
7. Press <kbd>Esc</kbd>: Immediately dismisses the dropdown menu.

---

## 6. Official 150–300 Word Technical Screening Memo

*(Directly included in the app under the "Screening Memo" tab and reproduced below for convenience)*

> **1. Tradeoffs Made**  
> I paired client-side debouncing (300ms) with native `AbortController` cancellation rather than offloading to Web Workers or an intermediary BFF proxy. For a typeahead querying a lightweight geocoding API, browser-native primitives minimize bundle overhead and execution complexity while eliminating stale response races. I chose uncontrolled input state synchronized to a deterministic status reducer (idle, loading, success, empty, error) with an in-memory Map query cache. This guarantees zero UI flicker and instant backspace recall without pulling in heavy external state managers.
>
> **2. High-Traffic Scaling & Hardening**  
> To withstand enterprise traffic (such as high-volume listing searches across Lagos metropolitan hubs), I would introduce:
> 1. **Edge Caching & Reverse Proxying:** Deploy Cloudflare or Vercel Edge Middleware with stale-while-revalidate (`s-maxage=86400, stale-while-revalidate=3600`) to absorb repeat geo queries at the CDN edge.
> 2. **Client-Side Request Coalescing:** Utilize an LRU cache or TanStack Query to deduplicate in-flight promises across concurrent consumers.
> 3. **Traffic Shaping:** Enforce IP-based leaky-bucket rate limiting and circuit breaking at the gateway to gracefully degrade to local offline datasets (e.g., top cities stored in IndexedDB) if upstream geocoding providers experience outages.
>
> **3. Testing Strategy**  
> 1. **Unit & Hook Testing (Vitest + RTL):** Mock timers with `vi.useFakeTimers()` to assert 300ms debouncing, and verify that rapid successive queries trigger `.abort()` while discarding out-of-order promise resolutions via sequence IDs.
> 2. **Network Integration (MSW):** Intercept requests with Mock Service Worker simulating high latency, out-of-order packet arrival, and 500 server faults to validate the retry mechanism.
> 3. **Accessibility & E2E (Playwright + axe-core):** Audit WAI-ARIA 1.2 Combobox compliance (`aria-activedescendant`, `aria-expanded`, DOM focus), ensuring full keyboard navigation (ArrowUp/Down, Home/End, Escape, Enter) and screen reader announcer reliability.

---

## 7. Component API Reference

```tsx
import { LocationTypeahead } from '@/components/location-typeahead';
import type { GeoLocation } from '@/types/geo';

export default function SearchSection() {
  const handleSelect = (location: GeoLocation) => {
    console.log('Selected verified coordinates:', location.latitude, location.longitude);
  };

  return (
    <LocationTypeahead
      label="Property Search Location"
      placeholder="Search by neighborhood, city, or LGA (e.g. Lekki, Ikoyi)..."
      defaultValue="Lekki"
      debounceDelayMs={300}
      minQueryLength={2}
      onSelect={handleSelect}
      autoFocus
    />
  );
}
```

### Props Specification

| Prop Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | `"Search Location"` | Accessible text for `<label>` linked via `htmlFor`. |
| `placeholder` | `string` | `"Search by city, state, or country..."` | Accessible input placeholder. |
| `defaultValue` | `string` | `""` | Initial string to seed the search input. |
| `onSelect` | `(location: GeoLocation) => void` | `undefined` | Callback invoked when user confirms a selection. |
| `onTelemetry` | `(log: TelemetryLog) => void` | `undefined` | Callback stream for debugging or observability sinks. |
| `debounceDelayMs` | `number` | `300` | Keystroke debounce quiet window in milliseconds. |
| `minQueryLength` | `number` | `2` | Minimum character threshold before querying upstream. |
| `simulateLatencyMs`| `number` | `0` | Artificial network latency simulation helper. |
| `simulateError` | `boolean` | `false` | Injects synthetic 503 service failure for fault testing. |
| `className` | `string` | `""` | Optional styling overrides for root container. |
| `autoFocus` | `boolean` | `false` | Sets initial input focus on mount. |

---

## 8. WAI-ARIA 1.2 Compliance Checklist

- [x] `role="combobox"` on `<input>` element.
- [x] `aria-expanded="true|false"` accurately synced to dropdown visibility.
- [x] `aria-haspopup="listbox"` declared on the combobox input.
- [x] `aria-controls` explicitly referencing the `id` of the suggestions `<ul>`.
- [x] `aria-autocomplete="list"` declared on the combobox input.
- [x] `aria-activedescendant` referencing the highlighted option `<li id="...">` during keyboard navigation.
- [x] `role="listbox"` on the dropdown container `<ul>`.
- [x] `role="option"` with `aria-selected="true|false"` on individual suggestion items.
- [x] Hidden live region `<div aria-live="polite" aria-atomic="true">` providing auditory counts to screen readers.
- [x] Full keyboard navigation: <kbd>ArrowDown</kbd>, <kbd>ArrowUp</kbd>, <kbd>Home</kbd>, <kbd>End</kbd>, <kbd>Enter</kbd>, <kbd>Escape</kbd>, and <kbd>Tab</kbd>.
- [x] Click-outside listener dismissing dropdown without clearing active selection.

---

## 9. License & Attribution

Designed and engineered for the **Staff Frontend Engineering Assessment** at **Expert Listing Limited**.  
Geocoding provided via [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) (Non-commercial CC BY 4.0 compliant, high-availability European & African mirror clusters).
