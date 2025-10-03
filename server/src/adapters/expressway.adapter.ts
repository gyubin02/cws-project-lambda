import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cached } from '../lib/cache';
import { ENV } from '../lib/env';
import { UpstreamError } from '../lib/errors';
import type { TrafficBrief } from '../types';
import type { ExpresswayFixture } from '../types';

// TODO: Replace fixture usage with Korea Expressway Open API calls once official docs/links are available.

const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/expressway_tollgate.sample.json');

function timeBucket10m(when?: Date): string {
  const base = when ? when.getTime() : Date.now();
  const bucket = Math.floor(base / (10 * 60_000));
  return bucket.toString();
}

async function loadFixture(): Promise<ExpresswayFixture> {
  try {
    const raw = await fs.readFile(FIXTURE_PATH, 'utf8');
    return JSON.parse(raw) as ExpresswayFixture;
  } catch (error) {
    throw new UpstreamError('Failed to read expressway fixture', 'bad_response');
  }
}

function deriveStatus(): { status: TrafficBrief['source_status']; notes: string[] } {
  const status = ENV.EXPRESSWAY_API_KEY ? 'ok' : 'missing_api_key';
  const notes = status === 'missing_api_key'
    ? ['Using fixture data. Provide EXPRESSWAY_API_KEY to enable live requests.']
    : ['Using fixture data pending real API integration.'];
  return { status, notes };
}

function mapTrafficStatus(status: string | undefined): TrafficBrief['congestion_level'] | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase();
  if (normalized.includes('FREE')) return 'LOW';
  if (normalized.includes('SLOW')) return 'MID';
  if (normalized.includes('HEAVY') || normalized.includes('CONGEST')) return 'HIGH';
  return undefined;
}

export class ExpresswayAdapter {
  async routeExpresswayByTollgate(
    fromToll: string,
    toToll: string,
    when?: Date
  ): Promise<TrafficBrief> {
    const cacheKey = `expressway:${fromToll}:${toToll}:${timeBucket10m(when)}`;
    return cached(cacheKey, async () => {
      const data = await loadFixture();
      const match = data.items.find((item) => item.fromToll === fromToll && item.toToll === toToll);
      if (!match) {
        throw new UpstreamError(`Expressway fixture missing segment ${fromToll}->${toToll}`, 'bad_response');
      }
      const { status, notes } = deriveStatus();

      const brief: TrafficBrief = {
        source: 'expressway',
        source_status: status,
        updated_at: new Date().toISOString(),
        mode: 'car',
        notes,
      };

      const eta = Math.round(match.travelTimeSec / 60);
      brief.eta_minutes = eta;

      const congestion = mapTrafficStatus(match.trafficStatus);
      if (congestion) {
        brief.congestion_level = congestion;
      }

      return brief;
    });
  }
}

export const expresswayAdapter = new ExpresswayAdapter();
