export type TravelMode = 'car' | 'metro' | 'bike';

export type AirQualityGrade = 'GOOD' | 'MODERATE' | 'BAD' | 'VERY_BAD';

export type WeatherCondition = 'SUNNY' | 'CLOUDY' | 'RAINY';

export type SourceStatus = 'ok' | 'missing_api_key' | 'upstream_error' | 'timeout' | 'bad_response';

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
  grade?: AirQualityGrade;
  note?: string;
}

export interface TrafficInfo {
  source: 'expressway';
  source_status: SourceStatus;
  updated_at: string;
  eta_minutes?: number;
  congestion_level?: 'LOW' | 'MID' | 'HIGH';
  note?: string;
}

export interface Briefing {
  summary: string;
  notices?: string[];
  weather?: Weather;
  air?: AirQuality;
  traffic?: TrafficInfo;
}

export interface SearchParams {
  lat: number;
  lon: number;
  from: string;
  to: string;
}
