import { fetchKmaWeather } from '../adapters/kma.adapter';
import { fetchAirQuality } from '../adapters/airkorea.adapter';
import { fetchTraffic } from '../adapters/expressway.adapter';
import { isMock } from '../lib/env';

type Briefing = {
  summary: string;
  notices?: string[];
  weather?: Awaited<ReturnType<typeof fetchKmaWeather>>;
  air?: Awaited<ReturnType<typeof fetchAirQuality>>;
  traffic?: Awaited<ReturnType<typeof fetchTraffic>>;
};

export async function buildBriefing(lat: number, lon: number, from: string, to: string): Promise<Briefing> {
  const results = await Promise.allSettled([
    fetchKmaWeather(lat, lon),
    fetchAirQuality(lat, lon),
    fetchTraffic(from, to),
  ]);

  const [rWeather, rAir, rTraffic] = results;
  const briefing: Briefing = { summary: '', notices: [] };

  if (rWeather.status === 'fulfilled') briefing.weather = rWeather.value;
  else briefing.notices!.push('weather_unavailable');

  if (rAir.status === 'fulfilled') briefing.air = rAir.value;
  else briefing.notices!.push('air_unavailable');

  if (rTraffic.status === 'fulfilled') briefing.traffic = rTraffic.value;
  else briefing.notices!.push('traffic_unavailable');

  const parts: string[] = [];
  if (briefing.weather?.tmax_c != null) parts.push(`High ${briefing.weather.tmax_c}°C`);
  if (briefing.air?.grade) parts.push(`Air ${briefing.air.grade}`);
  if (briefing.traffic?.eta_minutes) parts.push(`ETA ${briefing.traffic.eta_minutes} min`);
  briefing.summary = parts.length ? parts.join(' · ') : (isMock ? 'Sample data' : 'Partial data unavailable');

  ['weather','air','traffic'].forEach((k) => {
    const src = (briefing as any)[k];
    if (src && src.source_status === 'missing_api_key') {
      briefing.notices!.push(`${k}_missing_api_key`);
    }
  });

  return briefing;
}
