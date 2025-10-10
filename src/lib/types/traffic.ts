import type { SourceStatus } from '../types';

export type TravelMode = 'car' | 'transit';

export type GeoLineString = {
  type: 'LineString';
  coordinates: Array<[number, number]>;
};

export interface TollgateInfo {
  code: string;
  name: string;
  lat: number;
  lon: number;
  congestion?: 'SMOOTH' | 'MODERATE' | 'CONGESTED' | 'BLOCKED';
  speed_kph?: number;
  delay_min?: number;
  updated_at?: string;
  source?: string;
}

export interface CarBrief {
  mode: 'car';
  eta_minutes: number;
  distance_km?: number;
  polyline?: GeoLineString;
  tollgates?: TollgateInfo[];
  source?: string;
  source_status?: SourceStatus;
}

export interface TransitStep {
  kind: string;
  name?: string;
  duration_min?: number;
}

export interface TransitBrief {
  mode: 'transit';
  eta_minutes: number;
  distance_km?: number;
  fare_krw?: number;
  transfers?: number;
  steps?: TransitStep[];
  notes?: string[];
  source?: string;
  source_status?: SourceStatus;
}

export interface CityRecommendation {
  mode: 'car' | 'transit' | 'tie';
  delta_min?: number;
  reasons?: string[];
}

export interface CityTraffic {
  car?: CarBrief | null;
  transit?: TransitBrief | null;
  recommendation?: CityRecommendation | null;
}
