/**
 * 유틸리티 함수들 (지리, 시간, 단위 변환)
 */

import { Coordinates } from '../types';
import { UpstreamError } from './errors';
import tollgateCatalog from '../../data/expressway_tollgates.json';

export interface Tollgate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routeNo?: string;
  routeName?: string;
}

export interface MatchedTollgate extends Tollgate {
  distanceFromRouteMeters: number;
  progressRatio: number;
}

const EARTH_RADIUS_METERS = 6371_000;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const toTollgate = (value: unknown): Tollgate | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const idRaw = record['id'];
  const id = typeof idRaw === 'string' ? idRaw.trim() : undefined;
  const nameRaw = record['name'];
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : undefined;
  const lat = toNumber(record['lat']);
  const lon = toNumber(record['lon']);
  if (!id || !name || lat == null || lon == null) return undefined;
  const gate: Tollgate = { id, name, lat, lon };
  const routeNoRaw = record['routeNo'];
  const routeNameRaw = record['routeName'];
  const routeNo = typeof routeNoRaw === 'string' ? routeNoRaw.trim() : undefined;
  const routeName = typeof routeNameRaw === 'string' ? routeNameRaw.trim() : undefined;
  if (routeNo) gate.routeNo = routeNo;
  if (routeName) gate.routeName = routeName;
  return gate;
};

export function normalizeTollgateDataset(raw: unknown): Tollgate[] {
  const entries = (() => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).tollgates)) {
      return (raw as any).tollgates as unknown[];
    }
    return [];
  })();

  const deduped = new Map<string, Tollgate>();
  for (const item of entries) {
    const gate = toTollgate(item);
    if (!gate) continue;
    const existing = deduped.get(gate.id);
    if (!existing) {
      deduped.set(gate.id, gate);
      continue;
    }
    // Preserve the first entry but merge optional metadata if missing.
    if (!existing.routeNo && gate.routeNo) existing.routeNo = gate.routeNo;
    if (!existing.routeName && gate.routeName) existing.routeName = gate.routeName;
  }

  return Array.from(deduped.values());
}

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

const tollgates: Tollgate[] = (() => {
  try {
    return normalizeTollgateDataset(tollgateCatalog as unknown);
  } catch (error) {
    console.warn('Failed to normalize tollgate dataset:', error);
    return [];
  }
})();

export function nearestTollgate(lat: number, lon: number): Tollgate {
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

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

type RoutePoint = { lat: number; lon: number };

function projectToLocalMeters(origin: RoutePoint, target: RoutePoint): { x: number; y: number } {
  const lat0 = toRadians(origin.lat);
  const lon0 = toRadians(origin.lon);
  const lat = toRadians(target.lat);
  const lon = toRadians(target.lon);
  const x = (lon - lon0) * Math.cos(lat0) * EARTH_RADIUS_METERS;
  const y = (lat - lat0) * EARTH_RADIUS_METERS;
  return { x, y };
}

function projectPointOnSegment(
  p: RoutePoint,
  a: RoutePoint,
  b: RoutePoint
): { distance: number; t: number } {
  const aProj = projectToLocalMeters(p, a);
  const bProj = projectToLocalMeters(p, b);

  const dx = bProj.x - aProj.x;
  const dy = bProj.y - aProj.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const distance = Math.hypot(aProj.x, aProj.y);
    return { distance, t: 0 };
  }

  const dot = (-aProj.x) * dx + (-aProj.y) * dy;
  let t = dot / lengthSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const closestX = aProj.x + t * dx;
  const closestY = aProj.y + t * dy;
  const distance = Math.hypot(closestX, closestY);
  return { distance, t };
}

export function pointToSegmentDistanceMeters(
  p: RoutePoint,
  a: RoutePoint,
  b: RoutePoint
): number {
  return projectPointOnSegment(p, a, b).distance;
}

export function pointToPolylineDistanceMeters(
  p: RoutePoint,
  line: RoutePoint[]
): { distance: number; atIndex: number } {
  if (!Array.isArray(line) || line.length === 0) {
    return { distance: Number.POSITIVE_INFINITY, atIndex: -1 };
  }

  if (line.length === 1) {
    return { distance: haversineMeters(p, line[0]!), atIndex: 0 };
  }

  let minDistance = Number.POSITIVE_INFINITY;
  let bestIndex = 0;

  for (let i = 0; i < line.length - 1; i += 1) {
    const distance = pointToSegmentDistanceMeters(p, line[i]!, line[i + 1]!);
    if (distance < minDistance) {
      minDistance = distance;
      bestIndex = i;
    }
  }

  return { distance: minDistance, atIndex: bestIndex };
}

type RouteSegments = {
  segments: Array<{ start: RoutePoint; end: RoutePoint; length: number }>;
  prefixMeters: number[];
  totalLength: number;
};

function prepareRoute(line: RoutePoint[]): RouteSegments {
  const segments: RouteSegments['segments'] = [];
  const prefixMeters: number[] = [];
  let total = 0;

  for (let i = 0; i < line.length - 1; i += 1) {
    const start = line[i]!;
    const end = line[i + 1]!;
    const length = haversineMeters(start, end);
    segments.push({ start, end, length });
    prefixMeters.push(total);
    total += length;
  }

  return { segments, prefixMeters, totalLength: total };
}

type RouteProjection = {
  distance: number;
  segmentIndex: number;
  t: number;
  progressMeters: number;
};

function projectPointOntoRoute(line: RoutePoint[], prepared: RouteSegments, point: RoutePoint): RouteProjection {
  if (line.length === 0) {
    return { distance: Number.POSITIVE_INFINITY, segmentIndex: -1, t: 0, progressMeters: 0 };
  }

  if (prepared.segments.length === 0) {
    const distance = haversineMeters(point, line[0]!);
    return { distance, segmentIndex: 0, t: 0, progressMeters: 0 };
  }

  let minDistance = Number.POSITIVE_INFINITY;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < prepared.segments.length; i += 1) {
    const segment = prepared.segments[i]!;
    const projection = projectPointOnSegment(point, segment.start, segment.end);
    if (projection.distance < minDistance) {
      minDistance = projection.distance;
      bestIndex = i;
      bestT = projection.t;
    }
  }

  const progressMeters = prepared.prefixMeters[bestIndex]! + prepared.segments[bestIndex]!.length * bestT;
  return { distance: minDistance, segmentIndex: bestIndex, t: bestT, progressMeters };
}

export function sortByRouteProgress(line: RoutePoint[], candidates: RoutePoint[]): number[] {
  if (!Array.isArray(line) || line.length === 0) {
    return candidates.map((_value, index) => index);
  }

  const prepared = prepareRoute(line);
  const total = prepared.totalLength > 0 ? prepared.totalLength : 1;

  return candidates
    .map((point, index) => {
      const projection = projectPointOntoRoute(line, prepared, point);
      const ratio = Math.max(0, Math.min(1, projection.progressMeters / total));
      return { index, ratio };
    })
    .sort((a, b) => a.ratio - b.ratio)
    .map((entry) => entry.index);
}

export function tollgatesAlongRoute(
  line: RoutePoint[],
  tollgateList: Tollgate[],
  bufferMeters = 200,
  max = 12
): MatchedTollgate[] {
  if (!Array.isArray(line) || line.length === 0 || !Array.isArray(tollgateList) || tollgateList.length === 0) {
    return [];
  }

  const prepared = prepareRoute(line);
  const total = prepared.totalLength > 0 ? prepared.totalLength : 1;
  const dedupe = new Map<string, MatchedTollgate>();

  for (const tollgate of tollgateList) {
    const projection = projectPointOntoRoute(line, prepared, tollgate);
    if (!Number.isFinite(projection.distance) || projection.distance > bufferMeters) {
      continue;
    }

    const progressRatio = Math.max(0, Math.min(1, projection.progressMeters / total));
    const distanceMeters = Number.isFinite(projection.distance) ? projection.distance : Number.POSITIVE_INFINITY;
    const candidate: MatchedTollgate = {
      ...tollgate,
      distanceFromRouteMeters: distanceMeters,
      progressRatio,
    };

    const existing = dedupe.get(tollgate.id);
    if (!existing || distanceMeters < existing.distanceFromRouteMeters) {
      dedupe.set(tollgate.id, candidate);
    }
  }

  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : tollgateList.length;

  return Array.from(dedupe.values())
    .sort((a, b) => {
      if (a.progressRatio === b.progressRatio) {
        return a.distanceFromRouteMeters - b.distanceFromRouteMeters;
      }
      return a.progressRatio - b.progressRatio;
    })
    .slice(0, limit);
}
