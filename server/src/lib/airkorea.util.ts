import { UpstreamError } from './errors';

export type TMPoint = { tmX: number; tmY: number };

const DEG_TO_RAD = Math.PI / 180;

export function wgs84ToTM(lat: number, lon: number): TMPoint {
  const a = 6378137.0; // GRS80
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const eSquared = 1 - (b * b) / (a * a);
  const ePrimeSquared = eSquared / (1 - eSquared);

  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;

  const lat0 = 38 * DEG_TO_RAD;
  const lon0 = 127 * DEG_TO_RAD;
  const k0 = 1.0;
  const falseEasting = 200000;
  const falseNorthing = 600000;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = a / Math.sqrt(1 - eSquared * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ePrimeSquared * cosLat * cosLat;
  const A = cosLat * (lonRad - lon0);

  const m =
    a * ((1 - eSquared / 4 - (3 * eSquared * eSquared) / 64 - (5 * eSquared ** 3) / 256) * latRad
    - ((3 * eSquared) / 8 + (3 * eSquared * eSquared) / 32 + (45 * eSquared ** 3) / 1024) * Math.sin(2 * latRad)
    + ((15 * eSquared * eSquared) / 256 + (45 * eSquared ** 3) / 1024) * Math.sin(4 * latRad)
    - ((35 * eSquared ** 3) / 3072) * Math.sin(6 * latRad));

  const m0 =
    a * ((1 - eSquared / 4 - (3 * eSquared * eSquared) / 64 - (5 * eSquared ** 3) / 256) * lat0
    - ((3 * eSquared) / 8 + (3 * eSquared * eSquared) / 32 + (45 * eSquared ** 3) / 1024) * Math.sin(2 * lat0)
    + ((15 * eSquared * eSquared) / 256 + (45 * eSquared ** 3) / 1024) * Math.sin(4 * lat0)
    - ((35 * eSquared ** 3) / 3072) * Math.sin(6 * lat0));

  const x =
    falseEasting +
    k0 *
      N *
      (A + ((1 - T + C) * Math.pow(A, 3)) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ePrimeSquared) * Math.pow(A, 5)) / 120);

  const y =
    falseNorthing +
    k0 *
      (m - m0 +
        N * tanLat *
          (Math.pow(A, 2) / 2 + ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ePrimeSquared) * Math.pow(A, 6)) / 720));

  return { tmX: Math.round(x * 1000) / 1000, tmY: Math.round(y * 1000) / 1000 };
}

type NearbyStationItem = {
  stationName?: string;
  tmX?: string;
  tmY?: string;
  dist?: string;
  distance?: string;
};

const extractNearbyItems = (payload: any): NearbyStationItem[] => {
  const items = payload?.response?.body?.items;
  if (Array.isArray(items)) return items as NearbyStationItem[];
  if (items?.item && Array.isArray(items.item)) return items.item as NearbyStationItem[];
  return [];
};

export function pickNearestStation(payload: unknown): string {
  const items = extractNearbyItems(payload);
  if (!items.length) {
    throw new UpstreamError('AirKorea nearby station payload empty', 'bad_response');
  }

  let nearest = items[0];
  let minDist = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const station = item?.stationName;
    if (!station) continue;
    const distance = Number((item.dist ?? item.distance ?? '').toString().trim());
    if (!Number.isNaN(distance) && distance < minDist) {
      minDist = distance;
      nearest = item;
    }
  }

  if (!nearest?.stationName) {
    throw new UpstreamError('AirKorea nearby station missing stationName', 'bad_response');
  }

  return nearest.stationName;
}

type MeasurementItem = {
  stationName?: string;
  dataTime?: string;
  pm10Value?: string;
  pm10Grade?: string;
  pm25Value?: string;
  pm25Grade?: string;
  khaiValue?: string;
  khaiGrade?: string;
};

const extractMeasurementItems = (payload: any): MeasurementItem[] => {
  const items = payload?.response?.body?.items;
  if (Array.isArray(items)) return items as MeasurementItem[];
  if (items?.item && Array.isArray(items.item)) return items.item as MeasurementItem[];
  return [];
};

const gradeMap: Record<string, 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy'> = {
  '1': 'Good',
  '2': 'Moderate',
  '3': 'Unhealthy',
  '4': 'Very Unhealthy',
};

const parseNumberOrNull = (value?: string): number | null => {
  if (!value || value.trim() === '-' || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toIso = (dataTime?: string): string | undefined => {
  if (!dataTime) return undefined;
  const trimmed = dataTime.trim();
  if (!trimmed) return undefined;
  const iso = `${trimmed}:00+09:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

export type NormalizedAirQuality = {
  stationName?: string;
  observedAt?: string;
  pm10: number | null;
  pm25: number | null;
  pm10Category?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  pm25Category?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  aqi?: number | null;
  aqiCategory?: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy';
  notes: string[];
};

export function normalizeAirPayload(payload: unknown): NormalizedAirQuality {
  const items = extractMeasurementItems(payload);
  if (!items.length) {
    throw new UpstreamError('AirKorea measurement payload empty', 'bad_response');
  }

  const latest = items[0]!;
  const pm10 = parseNumberOrNull(latest.pm10Value);
  const pm25 = parseNumberOrNull(latest.pm25Value);
  const aqi = parseNumberOrNull(latest.khaiValue);
  const notes: string[] = [];

  if (pm10 == null) notes.push('PM10 data unavailable');
  if (pm25 == null) notes.push('PM2.5 data unavailable');
  if (aqi == null) notes.push('AQI data unavailable');

  const result: NormalizedAirQuality = {
    pm10,
    pm25,
    aqi,
    notes,
  };

  const stationName = latest.stationName;
  if (stationName) {
    result.stationName = stationName;
  }
  const observedAt = toIso(latest.dataTime);
  if (observedAt) {
    result.observedAt = observedAt;
  }
  const pm10Category = gradeMap[latest.pm10Grade ?? ''];
  if (pm10Category) {
    result.pm10Category = pm10Category;
  }
  const pm25Category = gradeMap[latest.pm25Grade ?? ''];
  if (pm25Category) {
    result.pm25Category = pm25Category;
  }
  const aqiCategory = gradeMap[latest.khaiGrade ?? ''];
  if (aqiCategory) {
    result.aqiCategory = aqiCategory;
  }

  return result;
}
