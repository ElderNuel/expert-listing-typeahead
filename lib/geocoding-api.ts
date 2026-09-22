import type { GeoLocation, OpenMeteoGeocodingResponse } from '../types/geo';

/**
 * Normalizes Open-Meteo Geocoding API results.
 * Handles messy or sparse geographic entities gracefully.
 *
 * @param query The geographic search term (city, LGA, postal area).
 * @param signal Optional AbortSignal from the consumer's AbortController.
 * @returns A promise resolving to an array of normalized GeoLocation objects.
 * @throws Error if the upstream HTTP response status is not 2xx.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<GeoLocation[]> {
  // Sanitize whitespace
  const sanitized = query.trim();
  if (!sanitized) return [];

  // Upstream Open-Meteo Geocoding API endpoint
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    sanitized
  )}&count=8&language=en&format=json`;

  // Fetch with explicit Accept header and consumer-supplied cancellation signal
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  // Verify HTTP status code
  if (!response.ok) {
    throw new Error(
      `Geocoding service returned HTTP ${response.status} (${response.statusText})`
    );
  }

  // Parse JSON and extract results or fallback to empty array
  const json: OpenMeteoGeocodingResponse = await response.json();
  return json.results ?? [];
}

/**
 * Formats a location's display label (e.g. "Lekki, Lagos, Nigeria").
 * Filters out redundant state/name duplicates.
 *
 * @param loc The geographic location object.
 * @returns A clean, comma-delimited location title string.
 */
export function formatLocationTitle(loc: GeoLocation): string {
  const parts: string[] = [];
  if (loc.name) parts.push(loc.name);
  if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
  if (loc.country) parts.push(loc.country);
  return parts.join(', ');
}

/**
 * Formats geographic coordinates into human-readable notation (e.g. "6.4698° N, 3.5852° E").
 *
 * @param lat Decimal latitude.
 * @param lon Decimal longitude.
 * @returns Standard directional coordinate string.
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}
