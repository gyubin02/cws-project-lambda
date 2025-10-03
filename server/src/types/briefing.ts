/**
 * 공통 Briefing 스키마 (프론트엔드와 공유)
 */

export type Briefing = {
  summary: string;
  weather: {
    temp: number; // ℃
    feels_like: number; // ℃ (computed)
    condition: string; // 'rain'|'snow'|'cloudy'|'clear'...
    pop: number; // 0..1
    hourly: { time: string; temp: number; pop: number }[];
  };
  air: {
    pm10: number; // µg/m³
    pm25: number; // µg/m³
    grade: 'good' | 'normal' | 'bad' | 'verybad';
    advice: string; // e.g., 'KF94 recommended'
  };
  traffic: {
    eta: { car?: number; metro?: number; bike?: number }; // minutes
    recommend: 'car' | 'metro' | 'bike';
    notes?: string; // road works/incidents/congestion notes
  };
};

export type BriefingRequest = {
  from: string; // "lat,lon"
  to: string; // "lat,lon"
  time?: string; // ISO8601
  mode?: 'car' | 'metro' | 'bike';
};

export type Coordinates = {
  lat: number;
  lon: number;
};

export type WeatherCondition = 'rain' | 'snow' | 'cloudy' | 'clear' | 'fog' | 'storm';

export type AirQualityGrade = 'good' | 'normal' | 'bad' | 'verybad';

export type TransportMode = 'car' | 'metro' | 'bike';
