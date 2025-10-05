import {
  AirQuality,
  AirQualityGrade,
  Briefing,
  LocationSource,
  SearchParams,
  SourceStatus,
  TrafficInfo,
  TrafficStep,
  Weather,
  WeatherCondition,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

type ServerTrafficStep = {
  type?: TrafficStep['type'];
  name?: string;
  duration_min?: number;
};

type ServerTrafficBrief = {
  source?: TrafficInfo['source'];
  source_status: SourceStatus;
  updated_at?: string;
  eta_minutes?: number;
  duration_seconds?: number;
  distance_km?: number;
  congestion_level?: TrafficInfo['congestion_level'];
  notes?: string[];
  steps?: ServerTrafficStep[];
};

type ServerWeatherBrief = {
  source?: Weather['source'];
  source_status: SourceStatus;
  updated_at?: string;
  condition?: string;
  temp_c?: number;
  pop?: number;
  tmin_c?: number;
  tmax_c?: number;
  notes?: string[];
};

type ServerAirBrief = {
  source?: AirQuality['source'];
  source_status: SourceStatus;
  updated_at?: string;
  grade?: string;
  pm10?: number;
  pm25?: number;
  aqi?: number;
  notes?: string[];
};

type ServerBriefing = {
  summary?: string;
  notices?: string[];
  from?: string;
  to?: string;
  weather?: ServerWeatherBrief | null;
  air?: ServerAirBrief | null;
  traffic?: {
    car?: ServerTrafficBrief | null;
    expressway?: ServerTrafficBrief | null;
    transit?: ServerTrafficBrief | null;
  } | null;
};

type ServerBriefingMeta = {
  origin?: { source?: string | null } | null;
  destination?: { source?: string | null } | null;
  warnings?: string[] | null;
};

type ServerBriefingResponse = {
  data?: ServerBriefing | null;
  meta?: ServerBriefingMeta | null;
};

const SKY_MAP: Record<string, WeatherCondition | undefined> = {
  clear: 'SUNNY',
  sunny: 'SUNNY',
  cloudy: 'CLOUDY',
  overcast: 'CLOUDY',
  rain: 'RAINY',
  rainy: 'RAINY',
  shower: 'RAINY',
  showers: 'RAINY',
  snow: 'SNOW',
  snowy: 'SNOW',
  fog: 'FOG',
  mist: 'FOG',
};

const AIR_GRADE_MAP: Record<string, AirQualityGrade | undefined> = {
  good: 'GOOD',
  normal: 'MODERATE',
  moderate: 'MODERATE',
  bad: 'BAD',
  verybad: 'VERY_BAD',
  'very bad': 'VERY_BAD',
};

function normalizeLocationSource(value?: string | null): LocationSource | undefined {
  if (!value) return undefined;
  if (value === 'stored' || value === 'geocoded' || value === 'request') {
    return value;
  }
  return undefined;
}

function normalizeBriefing(server: ServerBriefing | null, meta?: ServerBriefingMeta | null): Briefing {
  if (!server) {
    return {
      summary: '',
      notices: [],
    };
  }

  const pickTraffic =
    server.traffic?.car ?? server.traffic?.expressway ?? server.traffic?.transit ?? null;

  const traffic: TrafficInfo = {
    source: pickTraffic?.source ?? 'expressway',
    source_status: pickTraffic?.source_status ?? 'upstream_error',
    updated_at: pickTraffic?.updated_at ?? new Date().toISOString(),
    eta_minutes: pickTraffic?.eta_minutes,
    duration_seconds:
      pickTraffic?.duration_seconds ??
      (typeof pickTraffic?.eta_minutes === 'number'
        ? Math.round(pickTraffic.eta_minutes * 60)
        : undefined),
    distance_km: pickTraffic?.distance_km,
    congestion_level: pickTraffic?.congestion_level,
    note: pickTraffic?.notes?.[0],
    steps: pickTraffic?.steps?.map((step) => ({
      type: step.type,
      name: step.name,
      duration_min: step.duration_min,
    })),
  };

  const weather: Weather | undefined = server.weather
    ? {
        source: server.weather.source ?? 'kma',
        source_status: server.weather.source_status,
        updated_at: server.weather.updated_at ?? new Date().toISOString(),
        sky: SKY_MAP[String(server.weather.condition ?? '').toLowerCase()],
        temp: server.weather.temp_c,
        pop: server.weather.pop,
        tmax_c: server.weather.tmax_c,
        tmin_c: server.weather.tmin_c,
        note: server.weather.notes?.[0],
      }
    : undefined;

  const air: AirQuality | undefined = server.air
    ? {
        source: server.air.source ?? 'airkorea',
        source_status: server.air.source_status,
        updated_at: server.air.updated_at ?? new Date().toISOString(),
        grade: AIR_GRADE_MAP[String(server.air.grade ?? '').toLowerCase()],
        pm10: server.air.pm10,
        pm25: server.air.pm25,
        aqi: server.air.aqi,
        note: server.air.notes?.[0],
      }
    : undefined;

  const briefing: Briefing = {
    summary: server.summary ?? '',
    notices: server.notices ?? [],
    from: server.from ?? undefined,
    to: server.to ?? undefined,
    weather,
    air,
    traffic,
  };

  const originSource = normalizeLocationSource(meta?.origin?.source ?? undefined);
  const destinationSource = normalizeLocationSource(meta?.destination?.source ?? undefined);
  const warnings = Array.isArray(meta?.warnings)
    ? meta.warnings.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];

  if (originSource || destinationSource || warnings.length) {
    briefing.meta = {};
    if (originSource) {
      briefing.meta.origin = { source: originSource };
    }
    if (destinationSource) {
      briefing.meta.destination = { source: destinationSource };
    }
    if (warnings.length) {
      briefing.meta.warnings = warnings;
    }
  }

  return briefing;
}

export async function getBriefing(params: SearchParams): Promise<Briefing> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  const res = await fetch(`${API_BASE_URL}/briefing?${qs.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Briefing request failed: ${res.status}`);
  }
  const raw = (await res.json()) as ServerBriefingResponse;
  return normalizeBriefing(raw?.data ?? null, raw?.meta ?? null);
}

export async function getWeather(params: { location?: string; lat?: number; lon?: number }) {
  const qs = new URLSearchParams();
  if (params.location) {
    qs.set('location', params.location);
  }
  if (params.lat !== undefined && params.lon !== undefined) {
    qs.set('lat', String(params.lat));
    qs.set('lon', String(params.lon));
  }
  const url = `${API_BASE_URL}/weather?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json();
}

export async function getAirQuality(params: { location?: string; lat?: number; lon?: number; district?: string }) {
  const qs = new URLSearchParams();
  if (params.location) qs.set('location', params.location);
  if (params.lat !== undefined && params.lon !== undefined) {
    qs.set('lat', String(params.lat));
    qs.set('lon', String(params.lon));
  }
  if (params.district) qs.set('district', params.district);
  const url = `${API_BASE_URL}/air?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air quality request failed: ${res.status}`);
  return res.json();
}

export async function getTraffic(from: string, to: string) {
  const url = `${API_BASE_URL}/traffic?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Traffic request failed: ${res.status}`);
  return res.json();
}

export async function getHealth() {
  const url = `${API_BASE_URL}/healthz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
