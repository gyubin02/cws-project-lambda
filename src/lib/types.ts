export type TravelMode = 'car' | 'metro' | 'bike';

export type AirQualityGrade = 'good' | 'normal' | 'bad' | 'verybad';

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface HourlyWeather {
  time: string;
  temp: number;
  pop: number;
  condition: WeatherCondition;
}

export interface Weather {
  temp: number;
  feels_like: number;
  condition: WeatherCondition;
  pop: number;
  hourly: HourlyWeather[];
  wind_speed?: number;
  humidity?: number;
}

export interface AirQuality {
  pm10: number;
  pm25: number;
  grade: AirQualityGrade;
  advice: string;
}

export interface TrafficInfo {
  eta: {
    car?: number;
    metro?: number;
    bike?: number;
  };
  recommend: TravelMode;
  notes?: string;
}

export interface Briefing {
  summary: string;
  weather: Weather;
  air: AirQuality;
  traffic: TrafficInfo;
}

export interface SearchParams {
  from: string;
  to: string;
  time: string;
  mode: TravelMode;
}
