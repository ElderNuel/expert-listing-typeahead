/**
 * Geographic entity returned by Open-Meteo Geocoding API
 * https://geocoding-api.open-meteo.com/v1/search
 */
export interface GeoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  country_id?: number;
  admin1?: string; // State / Region / Province (e.g. Lagos, Ontario, California)
  admin2?: string; // County / LGA / District
  admin3?: string;
  admin4?: string;
  timezone?: string;
  population?: number;
  postcodes?: string[];
}

export interface OpenMeteoGeocodingResponse {
  results?: GeoLocation[];
  generationtime_ms?: number;
}

export type SearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface TelemetryLog {
  id: string;
  timestamp: string;
  type: 'DEBOUNCE' | 'DISPATCH' | 'ABORT' | 'RESOLVE' | 'CACHE_HIT' | 'ERROR';
  sequence: number;
  query: string;
  details: string;
  durationMs?: number;
}
