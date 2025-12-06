import type {
  AirBrief,
  Briefing,
  Coordinates,
  Recommendation,
  TrafficBrief,
  WeatherBrief,
} from '../types';
import type { CityRecommendation } from './recommend.service';
import { ENV } from '../lib/env';

type HybridRecommendation = Recommendation & CityRecommendation;

type MockScenario = {
  from: Coordinates;
  to: Coordinates;
  build: (now: string) => Briefing;
};

const CITY_HALL: Coordinates = { lat: 37.566295, lon: 126.977945 };
const LOTTE_TOWER: Coordinates = { lat: 37.513068, lon: 127.102554 };
const COEX: Coordinates = { lat: 37.513039, lon: 127.056254 };
const TEHERAN_152: Coordinates = { lat: 37.500026, lon: 127.036506 };
const GWANGHWAMUN_209: Coordinates = { lat: 37.574906, lon: 126.975205 };

function closeEnough(a: Coordinates, b: Coordinates, tolerance = 0.0005): boolean {
  return Math.abs(a.lat - b.lat) <= tolerance && Math.abs(a.lon - b.lon) <= tolerance;
}

function buildHybridRecommendation(params: {
  mode: CityRecommendation['mode'];
  deltaMin?: number;
  headline: string;
  detail: string;
  reason?: string;
}): HybridRecommendation {
  const recommendation: HybridRecommendation = {
    mode: params.mode,
    reasons: ['eta_gap'],
    reason: params.reason ?? params.headline,
    headline: params.headline,
    details: [params.detail],
  };

  if (params.deltaMin !== undefined) {
    recommendation.delta_min = params.deltaMin;
  }

  return recommendation;
}

function cityHallToLotte(now: string): Briefing {
  const weather: WeatherBrief = {
    source: 'kma',
    source_status: 'ok',
    updated_at: now,
    condition: 'clear',
    temp_c: 4,
    tmin_c: 4,
    tmax_c: 4,
    pop: 0.1,
    notes: ['맑고 쌀쌀한 아침, 체감 4°C 내외.'],
  };

  const air: AirBrief = {
    source: 'airkorea',
    source_status: 'ok',
    updated_at: now,
    pm10: 12,
    pm25: 4,
    aqi: 22,
    grade: 'good',
    notes: ['중구 정식 관측소 실시간 값 기준 (AQI 22, 좋음 수준)'],
  };

  const car: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'car',
    eta_minutes: 60,
    distance_km: 18.6,
    notes: ['도심 정체 구간 없음'],
  };

  const transit: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'transit',
    eta_minutes: 35,
    distance_km: 17.8,
    fare_krw: 1450,
    transfers: 1,
    notes: ['환승 1회, 출퇴근 시간대 기준'],
  };

  const recommendation = buildHybridRecommendation({
    mode: 'transit',
    deltaMin: 25,
    headline: '대중교통이 약 25분 빠름',
    detail: '대중교통 ETA 35분, 자동차 60분.',
  });

  return {
    summary: '서울시청 → 롯데월드타워: 자동차 60분, 대중교통 35분 · 기온 4°C, 공기 깨끗',
    notices: [],
    weather,
    air,
    traffic: { car, transit },
    recommendation,
  };
}

function coexToCityHall(now: string): Briefing {
  const weather: WeatherBrief = {
    source: 'kma',
    source_status: 'ok',
    updated_at: now,
    condition: 'overcast',
    temp_c: 7,
    tmin_c: 6,
    tmax_c: 8,
    pop: 0.2,
    notes: ['흐리고 7°C 내외.'],
  };

  const air: AirBrief = {
    source: 'airkorea',
    source_status: 'ok',
    updated_at: now,
    pm10: 26,
    pm25: 12,
    aqi: 57,
    grade: 'normal',
    notes: ['강남구 실시간 관측치 기준 (AQI 57, 보통 수준)'],
  };

  const car: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'car',
    eta_minutes: 44,
    distance_km: 12.4,
    notes: ['강남역 인근 정체 소폭'],
  };

  const transit: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'transit',
    eta_minutes: 36,
    distance_km: 12.1,
    fare_krw: 1450,
    transfers: 1,
    notes: ['환승 1회, 비교적 원활'],
  };

  const recommendation = buildHybridRecommendation({
    mode: 'transit',
    deltaMin: 8,
    headline: '대중교통이 약 8분 빠름',
    detail: '대중교통 ETA 36분, 자동차 44분.',
  });

  return {
    summary: '코엑스 → 시청: 자동차 44분, 대중교통 36분 · 기온 7°C, 미세먼지 보통',
    notices: [],
    weather,
    air,
    traffic: { car, transit },
    recommendation,
  };
}

function teheranToGwanghwamun(now: string): Briefing {
  const weather: WeatherBrief = {
    source: 'kma',
    source_status: 'ok',
    updated_at: now,
    condition: 'cloudy',
    temp_c: 4,
    tmin_c: 3,
    tmax_c: 5,
    pop: 0.35,
    notes: ['구름 조금, 간헐적 소나기 가능'],
  };

  const air: AirBrief = {
    source: 'airkorea',
    source_status: 'ok',
    updated_at: now,
    pm10: 26,
    pm25: 15,
    aqi: 60,
    grade: 'normal',
    notes: ['강남구 실시간 관측치 기준, AQI 약 60 (보통)'],
  };

  const car: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'car',
    eta_minutes: 45,
    distance_km: 14.2,
    notes: ['주요 구간 보통 수준'],
  };

  const transit: TrafficBrief = {
    source: 'tmap',
    source_status: 'ok',
    updated_at: now,
    mode: 'transit',
    eta_minutes: 39,
    distance_km: 14.0,
    fare_krw: 1450,
    transfers: 1,
    notes: ['환승 1회, 약간의 혼잡'],
  };

  const recommendation = buildHybridRecommendation({
    mode: 'transit',
    deltaMin: 6,
    headline: '대중교통이 약 6분 빠름',
    detail: '대중교통 ETA 39분, 자동차 45분.',
  });

  return {
    summary: '테헤란로 152 → 세종대로 209: 자동차 45분, 대중교통 39분 · 기온 4°C, 미세먼지 보통',
    notices: [],
    weather,
    air,
    traffic: { car, transit },
    recommendation,
  };
}

const SCENARIOS: MockScenario[] = [
  { from: CITY_HALL, to: LOTTE_TOWER, build: cityHallToLotte },
  { from: COEX, to: CITY_HALL, build: coexToCityHall },
  { from: TEHERAN_152, to: GWANGHWAMUN_209, build: teheranToGwanghwamun },
];

export function resolveMockBriefing(from?: Coordinates, to?: Coordinates): Briefing | null {
  if (ENV.MOCK !== 1) return null;
  if (!from || !to) return null;

  const match = SCENARIOS.find(
    (scenario) => closeEnough(scenario.from, from) && closeEnough(scenario.to, to)
  );
  if (!match) return null;

  const now = new Date().toISOString();
  return match.build(now);
}
