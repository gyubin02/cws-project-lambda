export type TravelMode = 'car' | 'metro' | 'bike';

export type AirQualityGrade = 'GOOD' | 'MODERATE' | 'BAD' | 'VERY_BAD';

export type WeatherCondition = 'SUNNY' | 'CLOUDY' | 'RAINY' | 'SNOW' | 'FOG';

export type SourceStatus =
  | 'ok'
  | 'missing_api_key'
  | 'upstream_error'
  | 'timeout'
  | 'bad_response'
  | 'mock'
  | 'degraded'
  | 'error';

export interface HourlyWeather {
  time: string;
  temp: number;
  pop: number;
  condition: WeatherCondition;
}

export interface Weather {
  source: 'kma';
  source_status: SourceStatus;
  updated_at: string;
  sky?: WeatherCondition;
  temp?: number;
  pop?: number;
  tmin_c?: number;
  tmax_c?: number;
  note?: string;
}

export interface AirQuality {
  source: 'airkorea';
  source_status: SourceStatus;
  updated_at: string;
  pm10?: number;
  pm25?: number;
  aqi?: number;
  grade?: AirQualityGrade;
  note?: string;
}

export interface TrafficStep {
  type?: 'drive' | 'metro' | 'bus' | 'walk' | 'bike';
  name?: string;
  duration_min?: number;
}

export interface TrafficInfo {
  source: 'tmap' | 'expressway' | 'transit';
  source_status: SourceStatus;
  updated_at: string;
  eta_minutes?: number;
  duration_seconds?: number;
  distance_km?: number;
  congestion_level?: 'LOW' | 'MID' | 'HIGH';
  note?: string;
  steps?: TrafficStep[];
}

export interface Briefing {
  summary: string;
  notices?: string[];
  from?: string;
  to?: string;
  weather?: Weather;
  air?: AirQuality;
  traffic?: TrafficInfo;
  meta?: BriefingMeta;
}

export interface SearchParams {
  from: string;
  to: string;
  mode?: 'car' | 'transit';
}

export type LocationSource = 'stored' | 'geocoded' | 'request';

export interface BriefingMeta {
  origin?: { source: LocationSource };
  destination?: { source: LocationSource };
  warnings?: string[];
}
