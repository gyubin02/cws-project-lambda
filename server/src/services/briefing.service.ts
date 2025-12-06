import type { AirBrief, Briefing, Coordinates, TrafficBrief, WeatherBrief } from '../types';
import { weatherService } from './weather.service';
import { airService } from './air.service';
import { trafficService } from './traffic.service';
import { recommendService } from './recommend.service';
import { profileService } from './profile.service';
import type { UserProfile } from '../types';
import { resolveMockBriefing } from './mockBriefing.service';

export type BriefingOptions = {
  userId?: string;
  from?: Coordinates;
  to?: Coordinates;
  when?: Date;
};

export async function buildBriefing(options: BriefingOptions): Promise<Briefing> {
  const profile = options.userId ? await profileService.getProfile(options.userId) : undefined;

  if (options.userId && !profile && !options.from && !options.to) {
    throw new Error('Profile not found');
  }

  const origin = options.from ?? profile?.home;
  const destination = options.to ?? profile?.work;

  if (!origin || !destination) {
    throw new Error('Origin and destination are required (via query or stored profile).');
  }

  const mockBriefing = resolveMockBriefing(origin, destination);
  if (mockBriefing) {
    return mockBriefing;
  }

  const weatherPromise = weatherService.getWeatherBrief(profile?.home ?? origin, options.when);
  const airPromise = airService.getAirBrief(profile?.home ?? origin, profile?.home?.district);

  const expresswayOptions: Parameters<typeof trafficService.getExpresswayTraffic>[2] = {};
  if (options.when) {
    expresswayOptions.when = options.when;
  }

  const cityTrafficPromise = trafficService.getAggregatedCityTraffic(
    origin,
    destination,
    options.when ? { when: options.when } : {}
  );
  const expresswayPromise = trafficService.getExpresswayTraffic(origin, destination, expresswayOptions);

  const [weatherResult, airResult, cityTrafficResult, expresswayResult] = await Promise.allSettled([
    weatherPromise,
    airPromise,
    cityTrafficPromise,
    expresswayPromise,
  ]);

  const notices: string[] = [];

  const weather = unwrapResult(weatherResult, 'weather', notices);
  const air = unwrapResult(airResult, 'air', notices);

  const trafficCity = cityTrafficResult.status === 'fulfilled'
    ? cityTrafficResult.value
    : (notices.push('traffic_city_error'), undefined);

  if (cityTrafficResult.status === 'rejected') {
    notices.push('traffic_city_rejected');
  }

  const trafficExpressway = expresswayResult.status === 'fulfilled'
    ? expresswayResult.value
    : (notices.push('traffic_expressway_error'), { expressway: undefined, meta: undefined });

  if (expresswayResult.status === 'rejected') {
    notices.push('traffic_expressway_rejected');
  }

  const traffic: Briefing['traffic'] = {};
  if (trafficCity?.car) {
    traffic.car = trafficCity.car;
  }
  if (trafficCity?.transit) {
    traffic.transit = trafficCity.transit;
  }
  if (trafficExpressway.expressway) {
    traffic.expressway = trafficExpressway.expressway;
  }

  collectNotice(weather, 'weather', notices);
  collectNotice(air, 'air', notices);
  collectNotice(traffic.car, 'traffic_car', notices);
  collectNotice(traffic.transit, 'traffic_transit', notices);
  collectNotice(traffic.expressway, 'traffic_expressway', notices);

  const recommendInput: Parameters<typeof recommendService.buildRecommendation>[0] = {};
  if (traffic.car) recommendInput.car = traffic.car;
  if (traffic.transit) recommendInput.transit = traffic.transit;
  if (traffic.expressway) recommendInput.expressway = traffic.expressway;
  if (typeof weather?.pop === 'number') recommendInput.pop = weather.pop;
  if (profile?.preferred_mode) recommendInput.preferred = profile.preferred_mode;

  const recommendation = recommendService.buildRecommendation(recommendInput);

  const summary = buildSummary({
    ...(weather ? { weather } : {}),
    ...(air ? { air } : {}),
    ...(traffic.car ? { car: traffic.car } : {}),
    ...(traffic.transit ? { transit: traffic.transit } : {}),
  });

  const briefing: Briefing = {
    summary,
    notices,
    traffic,
    recommendation,
  };

  if (weather) briefing.weather = weather;
  if (air) briefing.air = air;

  return briefing;
}

function unwrapResult<T>(
  result: PromiseSettledResult<T>,
  key: string,
  notices: string[]
): T | undefined {
  if (result.status === 'fulfilled') return result.value;
  notices.push(`${key}_error`);
  return undefined;
}

function collectNotice(brief: { source_status?: string } | undefined, slug: string, notices: string[]) {
  if (!brief) return;
  const status = brief.source_status;
  if (!status || status === 'ok') return;
  notices.push(`${slug}_${status}`);
}

function buildSummary(args: {
  weather?: WeatherBrief;
  air?: AirBrief;
  car?: TrafficBrief;
  transit?: TrafficBrief;
}): string {
  const parts: string[] = [];

  if (args.weather?.condition && args.weather.temp_c != null) {
    parts.push(`${capitalize(args.weather.condition)} ${Math.round(args.weather.temp_c)}°C`);
  }

  if (args.car?.eta_minutes != null) {
    parts.push(`Car ${args.car.eta_minutes}m`);
  }

  if (args.transit?.eta_minutes != null) {
    parts.push(`Transit ${args.transit.eta_minutes}m`);
  }

  if (args.air?.grade) {
    parts.push(`Air ${args.air.grade}`);
  }

  return parts.length ? parts.join(' · ') : 'Partial data returned';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function resolveProfileOrThrow(userId: string): Promise<UserProfile> {
  const profile = await profileService.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  return profile;
}
