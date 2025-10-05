/**
 * 유틸리티 함수들 (지리, 시간, 단위 변환)
 */

import { Coordinates } from '../types';
import { UpstreamError } from './errors';
import tollgateCatalog from '../../data/expressway_tollgates.json';
import type { ExpresswayTollgate } from '../types';

/**
 * 두 좌표 간의 거리 계산 (Haversine 공식)
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = (to.lat - from.lat) * Math.PI / 180;
  const dLon = (to.lon - from.lon) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const tollgates: ExpresswayTollgate[] = tollgateCatalog as ExpresswayTollgate[];

export function nearestTollgate(lat: number, lon: number): ExpresswayTollgate {
  if (tollgates.length === 0) {
    throw new Error('expressway tollgate catalog is empty');
  }

  let closest = tollgates[0]!;
  let minDistance = Number.POSITIVE_INFINITY;
  const origin: Coordinates = { lat, lon };

  for (const gate of tollgates) {
    const candidate: Coordinates = { lat: gate.lat, lon: gate.lon };
    const dist = calculateDistance(origin, candidate);
    if (dist < minDistance) {
      minDistance = dist;
      closest = gate;
    }
  }

  return closest;
}

/**
 * 체감온도 계산 (간단한 공식)
 */
export function calculateFeelsLike(temp: number, humidity: number, _windSpeed: number): number {
  // Heat Index 공식 (화씨 기준)
  const tempF = (temp * 9 / 5) + 32;
  const hi = -42.379 + 
    2.04901523 * tempF +
    10.14333127 * humidity -
    0.22475541 * tempF * humidity -
    6.83783e-3 * tempF * tempF -
    5.481717e-2 * humidity * humidity +
    1.22874e-3 * tempF * tempF * humidity +
    8.5282e-4 * tempF * humidity * humidity -
    1.99e-6 * tempF * tempF * humidity * humidity;
  
  // 섭씨로 변환
  return (hi - 32) * 5 / 9;
}

/**
 * 풍속에 따른 체감온도 보정
 */
export function applyWindChill(temp: number, windSpeed: number): number {
  if (windSpeed < 4.8) return temp; // 4.8 km/h 미만은 체감온도 변화 없음
  
  const windChill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 
    0.3965 * temp * Math.pow(windSpeed, 0.16);
  
  return Math.max(windChill, temp); // 체감온도는 실제온도보다 높을 수 없음
}

/**
 * 시간 문자열을 Date 객체로 변환
 */
export function parseTimeString(timeStr: string): Date {
  const year = parseInt(timeStr.substring(0, 4));
  const month = parseInt(timeStr.substring(4, 6)) - 1; // 0-based
  const day = parseInt(timeStr.substring(6, 8));
  const hour = parseInt(timeStr.substring(8, 10));
  const minute = parseInt(timeStr.substring(10, 12));
  
  return new Date(year, month, day, hour, minute);
}

/**
 * 현재 시간 기준으로 가장 가까운 관측/예보 시간 찾기
 */
export function getNearestBaseTime(targetTime?: Date): { baseDate: string; baseTime: string } {
  const now = targetTime || new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // KMA 기준: 매시 30분에 발표 (00:30, 01:30, ..., 23:30)
  let baseHour = hour;
  if (minute < 30) {
    baseHour = hour - 1;
    if (baseHour < 0) baseHour = 23;
  }
  
  const baseDate = now.toISOString().substring(0, 10).replace(/-/g, '');
  const baseTime = baseHour.toString().padStart(2, '0') + '30';
  
  return { baseDate, baseTime };
}

/**
 * 좌표 문자열 파싱 ("lat,lon" -> {lat, lon})
 */
export const COORDINATE_REGEX = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;

export function isCoordinateLike(value: string): boolean {
  return COORDINATE_REGEX.test(value);
}

export function parseCoordinates(coordStr: string): Coordinates {
  const trimmed = coordStr.trim();
  const [latStr, lonStr] = trimmed.split(',');
  if (latStr === undefined || lonStr === undefined) {
    throw new Error(`Invalid coordinates: ${trimmed}`);
  }
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error(`Invalid coordinates: ${trimmed}`);
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`Invalid coordinate range: ${trimmed}`);
  }
  return { lat, lon };
}

export const LOCATION_INPUT_MESSAGE = "from/to must be 'lat,lon' or a place name (e.g., 강남역).";

export async function parseCoordOrGeocode(
  value: string,
  geocodeFn: (query: string) => Promise<Coordinates>
): Promise<Coordinates> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(LOCATION_INPUT_MESSAGE);
  }

  if (COORDINATE_REGEX.test(trimmed)) {
    return parseCoordinates(trimmed);
  }

  try {
    const coordinates = await geocodeFn(trimmed);
    if (typeof coordinates?.lat === 'number' && typeof coordinates?.lon === 'number') {
      return coordinates as Coordinates;
    }
  } catch (error) {
    if (error instanceof UpstreamError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : LOCATION_INPUT_MESSAGE;
    throw new Error(message || LOCATION_INPUT_MESSAGE);
  }

  throw new Error(LOCATION_INPUT_MESSAGE);
}

/**
 * 미세먼지 등급 계산
 */
export function calculateAirGrade(pm10: number, pm25: number): 'good' | 'normal' | 'bad' | 'verybad' {
  const pm10Grade = getPM10Grade(pm10);
  const pm25Grade = getPM25Grade(pm25);
  
  // 더 나쁜 등급을 선택
  const grades = [pm10Grade, pm25Grade];
  if (grades.includes('verybad')) return 'verybad';
  if (grades.includes('bad')) return 'bad';
  if (grades.includes('normal')) return 'normal';
  return 'good';
}

function getPM10Grade(pm10: number): 'good' | 'normal' | 'bad' | 'verybad' {
  if (pm10 <= 30) return 'good';
  if (pm10 <= 80) return 'normal';
  if (pm10 <= 150) return 'bad';
  return 'verybad';
}

function getPM25Grade(pm25: number): 'good' | 'normal' | 'bad' | 'verybad' {
  if (pm25 <= 15) return 'good';
  if (pm25 <= 35) return 'normal';
  if (pm25 <= 75) return 'bad';
  return 'verybad';
}

/**
 * 등급에 따른 조언 생성
 */
export function getAirQualityAdvice(grade: 'good' | 'normal' | 'bad' | 'verybad'): string {
  switch (grade) {
    case 'good':
      return '공기질이 좋습니다. 야외 활동에 적합합니다.';
    case 'normal':
      return '공기질이 보통입니다. 민감한 분은 마스크 착용을 권장합니다.';
    case 'bad':
      return '공기질이 나쁩니다. KF94 마스크 착용을 권장합니다.';
    case 'verybad':
      return '공기질이 매우 나쁩니다. 외출을 자제하고 KF94 마스크를 착용하세요.';
  }
}

/**
 * 날씨 상태 매핑 (KMA 코드 -> 문자열)
 */
export function mapWeatherCondition(pty: number, sky: number): string {
  // PTY (강수형태): 0-없음, 1-비, 2-비/눈, 3-눈, 4-소나기
  if (pty > 0) {
    switch (pty) {
      case 1: return 'rain';
      case 2: return 'sleet';
      case 3: return 'snow';
      case 4: return 'shower';
      default: return 'rain';
    }
  }
  
  // SKY (하늘상태): 1-맑음, 3-구름많음, 4-흐림
  switch (sky) {
    case 1: return 'clear';
    case 3: return 'cloudy';
    case 4: return 'overcast';
    default: return 'clear';
  }
}

/**
 * 강수확률을 0-1 범위로 정규화
 */
export function normalizePop(pop: number): number {
  return Math.max(0, Math.min(1, pop / 100));
}
