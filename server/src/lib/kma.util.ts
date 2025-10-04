import { UpstreamError } from './errors';

type SlotSelection = {
  base_date: string;
  ultra_base_time: string;
  ultra_base_date: string;
  village_base_time: string;
  village_base_date: string;
  usedPreviousVillageSlot: boolean;
};

export type UltraVillageMerge = {
  now: {
    temperature?: number;
    humidity?: number;
    sky?: number;
    precipType?: number;
    precipMm?: number;
    windSpeed?: number;
    windDegree?: number;
  };
  pop?: number;
  hourly: Array<{
    time: string;
    temperature?: number;
    pop?: number;
    sky?: number;
    precipType?: number;
    precipMm?: number;
  }>;
  minTemp?: number;
  maxTemp?: number;
  notes: string[];
};

type UltraItem = {
  category?: string;
  obsrValue?: string;
};

type VillageItem = {
  category?: string;
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
};

const DEGRAD = Math.PI / 180.0;

export function latLonToGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877; // 지구 반경 (km)
  const GRID = 5.0; // 격자 간격 (km)
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
};

export function selectBaseSlots(when: Date): SlotSelection {
  const reference = new Date(when);

  const ultraDate = new Date(reference);
  ultraDate.setMinutes(0, 0, 0);

  const slotHours = [2, 5, 8, 11, 14, 17, 20, 23] as const;
  const currentHour = reference.getHours();

  const candidate = [...slotHours].reverse().find((hour) => hour <= currentHour);
  let resolvedVillageHour = candidate;
  let usedPreviousDay = false;
  if (resolvedVillageHour === undefined) {
    resolvedVillageHour = slotHours[slotHours.length - 1];
    usedPreviousDay = true;
  }

  const villageDate = new Date(reference);
  if (usedPreviousDay) {
    villageDate.setDate(villageDate.getDate() - 1);
  }
  const villageHourNumber = resolvedVillageHour as number;
  villageDate.setHours(villageHourNumber, 0, 0, 0);

  const ultraHour = ultraDate.getHours().toString().padStart(2, '0');
  const villageHour = villageHourNumber.toString().padStart(2, '0');

  return {
    base_date: formatDate(ultraDate),
    ultra_base_time: `${ultraHour}00`,
    ultra_base_date: formatDate(ultraDate),
    village_base_time: `${villageHour}00`,
    village_base_date: formatDate(villageDate),
    usedPreviousVillageSlot: usedPreviousDay,
  };
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '강수없음') return 0;
    const parsed = Number(trimmed.replace(/[^0-9+\-.]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const extractItems = (payload: any): UltraItem[] | VillageItem[] => {
  const items = payload?.response?.body?.items?.item;
  if (Array.isArray(items)) return items;
  return [];
};

const toIsoTime = (fcstDate?: string, fcstTime?: string): string | undefined => {
  if (!fcstDate || !fcstTime) return undefined;
  if (fcstDate.length !== 8 || fcstTime.length !== 4) return undefined;
  const year = fcstDate.substring(0, 4);
  const month = fcstDate.substring(4, 6);
  const day = fcstDate.substring(6, 8);
  const hour = fcstTime.substring(0, 2);
  const minute = fcstTime.substring(2, 4);
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;
  return new Date(iso).toISOString();
};

export function mergeUltraAndVillage(
  ultraPayload: unknown,
  villagePayload: unknown,
  opts: { now?: Date } = {}
): UltraVillageMerge {
  const ultraItems = extractItems(ultraPayload) as UltraItem[];
  const villageItems = extractItems(villagePayload) as VillageItem[];

  if (!ultraItems.length || !villageItems.length) {
    throw new UpstreamError('KMA payload missing items', 'bad_response');
  }

  const nowMap = new Map<string, number>();
  for (const item of ultraItems) {
    if (!item?.category) continue;
    const value = toNumber(item.obsrValue);
    if (value == null) continue;
    nowMap.set(item.category, value);
  }

  const now: UltraVillageMerge['now'] = {};
  const tempNow = nowMap.get('T1H');
  if (tempNow != null) now.temperature = tempNow;
  const humidityNow = nowMap.get('REH');
  if (humidityNow != null) now.humidity = humidityNow;
  const skyNow = nowMap.get('SKY');
  if (skyNow != null) now.sky = skyNow;
  const ptyNow = nowMap.get('PTY');
  if (ptyNow != null) now.precipType = ptyNow;
  const precipMmNow = nowMap.get('RN1');
  if (precipMmNow != null) now.precipMm = precipMmNow;
  const windSpeedNow = nowMap.get('WSD');
  if (windSpeedNow != null) now.windSpeed = windSpeedNow;
  const windDegreeNow = nowMap.get('VEC');
  if (windDegreeNow != null) now.windDegree = windDegreeNow;

  const byTimestamp = new Map<string, Record<string, number>>();
  for (const item of villageItems) {
    if (!item?.category) continue;
    const key = `${item.fcstDate ?? ''}${item.fcstTime ?? ''}`;
    if (key.trim().length === 0) continue;
    const value = toNumber(item.fcstValue);
    if (value == null) continue;
    const entry = byTimestamp.get(key) ?? {};
    entry[item.category] = value;
    byTimestamp.set(key, entry);
  }

  const timestamps = Array.from(byTimestamp.keys()).sort();
  const hourlyRaw: UltraVillageMerge['hourly'] = [];
  for (const stamp of timestamps) {
    const entry = byTimestamp.get(stamp);
    if (!entry) continue;
    const fcstDate = stamp.substring(0, 8);
    const fcstTime = stamp.substring(8, 12);
    const iso = toIsoTime(fcstDate, fcstTime);
    if (!iso) continue;

    const hourlyEntry: UltraVillageMerge['hourly'][number] = { time: iso };
    const tmp = entry['TMP'] ?? entry['T1H'];
    if (tmp != null) {
      hourlyEntry.temperature = tmp;
    }
    if (entry['POP'] != null) {
      hourlyEntry.pop = entry['POP'];
    }
    if (entry['SKY'] != null) {
      hourlyEntry.sky = entry['SKY'];
    }
    if (entry['PTY'] != null) {
      hourlyEntry.precipType = entry['PTY'];
    }
    if (entry['PCP'] != null) {
      hourlyEntry.precipMm = entry['PCP'];
    }
    hourlyRaw.push(hourlyEntry);
  }

  const minTemp = villageItems.find((item) => item.category === 'TMN');
  const maxTemp = villageItems.find((item) => item.category === 'TMX');

  const result: UltraVillageMerge = {
    now,
    hourly: hourlyRaw,
    notes: [],
  };

  const firstPop = hourlyRaw[0]?.pop;
  if (firstPop != null) {
    result.pop = firstPop;
  }

  const minValue = minTemp ? toNumber(minTemp.fcstValue) : undefined;
  if (minValue != null) {
    result.minTemp = minValue;
  }
  const maxValue = maxTemp ? toNumber(maxTemp.fcstValue) : undefined;
  if (maxValue != null) {
    result.maxTemp = maxValue;
  }

  if (opts.now) {
    const nowIso = opts.now.toISOString();
    result.notes.push(`Weather merged at ${nowIso}`);
  }

  return result;
}
