import type { GeoLocation, OpenMeteoGeocodingResponse } from '../types/geo';

/**
 * Normalizes Open-Meteo Geocoding API results.
 * Handles messy or sparse geographic entities gracefully.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<GeoLocation[]> {
  const sanitized = query.trim();
  if (!sanitized) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    sanitized
  )}&count=8&language=en&format=json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding service returned HTTP ${response.status} (${response.statusText})`
    );
  }

  const json: OpenMeteoGeocodingResponse = await response.json();
  return json.results ?? [];
}

/**
 * Formats a location's display label (e.g. "Lekki, Lagos, Nigeria")
 */
export function formatLocationTitle(loc: GeoLocation): string {
  const parts: string[] = [];
  if (loc.name) parts.push(loc.name);
  if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
  if (loc.country) parts.push(loc.country);
  return parts.join(', ');
}

/**
 * Formats geographic coordinates into human-readable notation (e.g. 6.4698° N, 3.5852° E)
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}
