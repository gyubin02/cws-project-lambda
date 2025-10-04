import { SourceStatus } from '../lib/errors';

/**
 * 기본 좌표 타입 (WGS84)
 */
export type Coordinates = {
  lat: number;
  lon: number;
};

export type TrafficMode = 'car' | 'transit' | 'bike' | 'walk';

export type WeatherHourly = {
  time: string; // ISO8601
  temp_c: number;
  pop: number; // 0..1
  condition: string;
};

export type WeatherBrief = {
  source: 'kma';
  source_status: SourceStatus;
  updated_at: string;
  temp_c?: number;
  feels_like_c?: number;
  condition?: string;
  pop?: number;
  hourly?: WeatherHourly[];
  tmin_c?: number;
  tmax_c?: number;
  humidity?: number;
  wind_mps?: number;
  wind_degree?: number;
  precip_mm?: number;
  notes?: string[];
};

export type AirGrade = 'good' | 'normal' | 'bad' | 'verybad';

export type AirBrief = {
  source: 'airkorea';
  source_status: SourceStatus;
  updated_at: string;
  pm10?: number;
  pm25?: number;
  grade?: AirGrade;
  advice?: string;
  station_name?: string;
  district?: string;
  pm10_category?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  pm25_category?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  aqi?: number;
  aqi_category?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  notes?: string[];
};

export type TrafficStep = {
  type: 'drive' | 'metro' | 'bus' | 'walk' | 'bike';
  name?: string;
  duration_min?: number;
};

export type TrafficBrief = {
  source: 'tmap' | 'expressway';
  source_status: SourceStatus;
  updated_at: string;
  mode: TrafficMode;
  eta_minutes?: number;
  distance_km?: number;
  fare_krw?: number;
  transfers?: number;
  steps?: TrafficStep[];
  congestion_level?: 'LOW' | 'MID' | 'HIGH';
  notes?: string[];
};

export type TrafficOverview = {
  car?: TrafficBrief;
  transit?: TrafficBrief;
  walk?: TrafficBrief;
  bike?: TrafficBrief;
  expressway?: TrafficBrief;
};

export type Recommendation = {
  headline: string;
  details: string[];
  suggested_mode?: TrafficMode;
  leave_earlier_min?: number;
};

export type Briefing = {
  summary: string;
  notices: string[];
  weather?: WeatherBrief;
  air?: AirBrief;
  traffic: TrafficOverview;
  recommendation?: Recommendation;
};

export type UserProfile = {
  user_id: string;
  preferred_mode: TrafficMode;
  tz: string;
  home: {
    lat: number;
    lon: number;
    label?: string;
    district?: string;
  };
  work: {
    lat: number;
    lon: number;
    label?: string;
  };
  last_updated: string;
};
