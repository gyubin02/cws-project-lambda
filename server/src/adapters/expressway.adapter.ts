import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cached } from '../lib/cache';
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import { UpstreamError } from '../lib/errors';
import { logger } from '../lib/logger';
import type { TrafficBrief } from '../types';

const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/expressway_tollgate.sample.json');
const EXPRESSWAY_BASE_URL = (process.env['EXPRESSWAY_BASE_URL'] ?? '').trim() ||
  'http://data.ex.co.kr/openapi/trtm';

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

const composeObservedAt = (date?: string, hour?: string, minute?: string): string | undefined => {
  if (!date || date.length < 8) return undefined;
  const y = date.substring(0, 4);
  const m = date.substring(4, 6);
  const d = date.substring(6, 8);
  const hh = (hour ?? '00').padStart(2, '0');
  const mm = (minute ?? '00').padStart(2, '0');
  const iso = `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
  return new Date(iso).toISOString();
};

const parseCongestion = (value: unknown): TrafficBrief['congestion_level'] | undefined => {
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (upper.includes('SLOW')) return 'MID';
    if (upper.includes('CONGEST') || upper.includes('BLOCK')) return 'HIGH';
    if (upper.includes('LOW') || upper.includes('FREE')) return 'LOW';
    if (upper.includes('MID')) return 'MID';
    if (upper.includes('HIGH')) return 'HIGH';
  } else if (typeof value === 'number') {
    if (value <= 1) return 'LOW';
    if (value === 2) return 'MID';
    if (value >= 3) return 'HIGH';
  }
  return undefined;
};

const deriveCongestionFromEta = (minutes: number | undefined): TrafficBrief['congestion_level'] | undefined => {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) {
    return undefined;
  }
  if (minutes <= 20) return 'LOW';
  if (minutes <= 40) return 'MID';
  return 'HIGH';
};

type ExpresswayRecord = {
  timeAvg?: string | number;
  travelTimeSec?: number;
  travelTime?: string | number;
  stndDate?: string;
  stndHour?: string;
  stndMin?: string;
  regDate?: string;
  trafficStatus?: string;
  trafficIdx?: string | number;
};

type MapOptions = {
  status: TrafficBrief['source_status'];
  note?: string;
};

const extractRecords = (payload: any): ExpresswayRecord[] => {
  if (Array.isArray(payload?.response?.body?.items?.item)) {
    return payload.response.body.items.item as ExpresswayRecord[];
  }
  if (Array.isArray(payload?.list)) {
    return payload.list as ExpresswayRecord[];
  }
  if (Array.isArray(payload?.realUnitTrtm)) {
    const first = payload.realUnitTrtm[0];
    if (Array.isArray(first?.list)) {
      return first.list as ExpresswayRecord[];
    }
  }
  if (Array.isArray(payload?.items)) {
    return payload.items as ExpresswayRecord[];
  }
  return [];
};

const pickLatestRecord = (records: ExpresswayRecord[]): ExpresswayRecord | undefined => {
  if (!records.length) return undefined;
  return records.reduce((latest, current) => {
    const currentStamp = `${current.stndDate ?? ''}${current.stndHour ?? ''}${current.stndMin ?? ''}${current.regDate ?? ''}`;
    const latestStamp = `${latest?.stndDate ?? ''}${latest?.stndHour ?? ''}${latest?.stndMin ?? ''}${latest?.regDate ?? ''}`;
    return currentStamp > latestStamp ? current : latest;
  }, records[0]);
};

const mapExpressway = (payload: any, opts: MapOptions): TrafficBrief => {
  const records = extractRecords(payload);
  const latest = pickLatestRecord(records);

  if (!latest) {
    throw new UpstreamError('Expressway response missing records', 'bad_response');
  }

  const etaMinutes = (() => {
    const travelSeconds = toNumber(latest.travelTimeSec);
    if (travelSeconds != null) return Math.ceil(travelSeconds / 60);
    const travelMinutes = toNumber(latest.timeAvg ?? latest.travelTime);
    if (travelMinutes != null) return Math.ceil(travelMinutes);
    return undefined;
  })();

  if (etaMinutes == null) {
    throw new UpstreamError('Expressway response missing ETA', 'bad_response');
  }

  const observedAt = composeObservedAt(latest.stndDate ?? latest.regDate, latest.stndHour, latest.stndMin);

  const notes: string[] = [];
  if (opts.note) notes.push(opts.note);
  if (observedAt) notes.push(`Latest observation at ${observedAt}`);

  const brief: TrafficBrief = {
    source: 'expressway',
    source_status: opts.status,
    updated_at: new Date().toISOString(),
    mode: 'car',
    eta_minutes: etaMinutes,
  };

  const congestion =
    parseCongestion(latest.trafficStatus ?? latest.trafficIdx) ?? deriveCongestionFromEta(etaMinutes);
  if (congestion) {
    brief.congestion_level = congestion;
  }

  if (notes.length) {
    brief.notes = notes;
  }

  return brief;
};

const timeBucket10m = (when?: Date): string => {
  const base = when ? when.getTime() : Date.now();
  const bucket = Math.floor(base / (10 * 60_000));
  return bucket.toString();
};

export class ExpresswayAdapter {
  async routeExpresswayByTollgate(
    fromToll: string,
    toToll: string,
    when?: Date
  ): Promise<TrafficBrief> {
    const cacheKey = `expressway:${fromToll}:${toToll}:${timeBucket10m(when)}`;
    const mode = liveOrMock('expressway');
    const apiKey = ENV.EXPRESSWAY_API_KEY;

    return cached(cacheKey, async () => {
      const loadMock = async (
        status: TrafficBrief['source_status'],
        note: string
      ): Promise<TrafficBrief> => {
        const data = await fs.readFile(FIXTURE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        return mapExpressway(parsed, { status, note });
      };

      if (mode === 'live') {
        if (!apiKey) {
          logger.warn({ adapter: 'expressway' }, 'Expressway API key missing during live mode — returning fixture data.');
          return loadMock('missing_api_key', 'Expressway API key missing — returning fixture data.');
        }

        try {
          const response = await http.get(`${EXPRESSWAY_BASE_URL}/realUnitTrtm`, {
            params: {
              key: apiKey,
              type: 'json',
              iStartUnitCode: fromToll,
              iEndUnitCode: toToll,
            },
          });

          return mapExpressway(response.data, { status: 'ok' });
        } catch (error) {
          logger.warn(
            {
              adapter: 'expressway',
              error: error instanceof Error ? error.message : String(error),
            },
            'Expressway live request failed — falling back to fixture data.'
          );
          return loadMock('upstream_error', 'Expressway live request failed — returning fixture data.');
        }
      }

      const forcedMock = ENV.MOCK === 1 && !!apiKey;
      const status: TrafficBrief['source_status'] = forcedMock ? 'upstream_error' : 'missing_api_key';
      const note = forcedMock
        ? 'MOCK=1 flag set — returning fixture expressway data.'
        : 'Expressway API key missing — returning fixture data.';
      return loadMock(status, note);
    });
  }
}

export const expresswayAdapter = new ExpresswayAdapter();
