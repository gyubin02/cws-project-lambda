import type { Recommendation, TrafficBrief, TrafficMode } from '../types';

export type CityRecommendation = {
  mode: 'car' | 'transit' | 'tie';
  delta_min?: number;
  reasons: string[];
  reason?: string;
};

export type RecommendInput = {
  car?: TrafficBrief;
  transit?: TrafficBrief;
  expressway?: TrafficBrief;
  pop?: number;
  preferred?: TrafficMode;
};

function isUsable(brief: TrafficBrief | undefined): brief is TrafficBrief {
  return (
    !!brief &&
    brief.source_status !== 'upstream_error' &&
    brief.source_status !== 'timeout' &&
    brief.source_status !== 'bad_response' &&
    brief.source_status !== 'error'
  );
}

function eta(brief: TrafficBrief | undefined): number | undefined {
  return isUsable(brief) ? brief.eta_minutes : undefined;
}

function chooseFaster(a: TrafficBrief | undefined, b: TrafficBrief | undefined): TrafficBrief | undefined {
  const etaA = eta(a);
  const etaB = eta(b);
  if (etaA == null && etaB == null) return undefined;
  if (etaA == null) return b;
  if (etaB == null) return a;
  return etaA <= etaB ? a : b;
}

function etaGap(a: TrafficBrief | undefined, b: TrafficBrief | undefined): number | undefined {
  const etaA = eta(a);
  const etaB = eta(b);
  if (etaA == null || etaB == null) return undefined;
  return Math.abs(etaA - etaB);
}

export class RecommendService {
  pickMode(input: { car?: TrafficBrief | null; transit?: TrafficBrief | null; tieThresholdMin?: number }): CityRecommendation {
    const car = input.car ?? undefined;
    const transit = input.transit ?? undefined;
    const threshold = Number.isFinite(input.tieThresholdMin)
      ? Math.max(0, Math.floor(Number(input.tieThresholdMin)))
      : 3;

    const carEta = eta(car);
    const transitEta = eta(transit);

    if (carEta == null && transitEta == null) {
      return { mode: 'tie', reasons: ['insufficient_data'], reason: 'no data' };
    }

    if (carEta != null && transitEta != null) {
      const delta = Math.abs(carEta - transitEta);
      if (delta <= threshold) {
        return { mode: 'tie', delta_min: delta, reasons: ['eta_tie'], reason: 'within tie margin' };
      }
      const recommendedMode = carEta <= transitEta ? 'car' : 'transit';
      const deltaRounded = Math.round(delta);
      return {
        mode: recommendedMode,
        delta_min: delta,
        reasons: ['eta_gap'],
        reason:
          recommendedMode === 'car'
            ? `car faster by ${deltaRounded}m`
            : `transit faster by ${deltaRounded}m`,
      };
    }

    if (carEta != null) {
      return { mode: 'car', reasons: ['transit_unavailable'], reason: 'transit missing' };
    }

    return { mode: 'transit', reasons: ['car_unavailable'], reason: 'car missing' };
  }

  buildRecommendation(input: RecommendInput): Recommendation {
    const { car, transit, expressway, pop, preferred } = input;
    const fastest = chooseFaster(car, transit) ?? car ?? transit ?? expressway;
    const usableFastestEta = eta(fastest);
    const diff = etaGap(car, transit);

    let headline = 'Limited commute data';
    const details: string[] = [];
    let suggestedMode: TrafficMode | undefined = fastest?.mode;
    let leaveEarlier: number | undefined;

    if (fastest && usableFastestEta != null) {
      headline = `${capitalize(fastest.mode)} route ~${usableFastestEta} min`;
    }

    if (diff != null && diff >= 5 && car && transit) {
      const fasterMode = chooseFaster(car, transit);
      if (fasterMode && eta(fasterMode) != null) {
        const slowerMode = fasterMode === car ? transit : car;
        const slowerEta = eta(slowerMode);
        const fasterEta = eta(fasterMode)!;
        const delta = slowerEta! - fasterEta;
        if (delta >= 5) {
          suggestedMode = fasterMode.mode;
          headline = `${capitalize(fasterMode.mode)} is ~${delta} min faster`;
          details.push(`${capitalize(fasterMode.mode)} ETA ${fasterEta} min vs ${capitalize(slowerMode!.mode)} ${slowerEta} min.`);
        }
      }
    }

    if (pop != null && pop >= 0.6 && transit && eta(transit) != null) {
      suggestedMode = 'transit';
      details.push('Rain likely (POP ≥ 60%). Transit recommended to avoid weather exposure.');
    }

    const preferredBrief = preferred === 'transit' ? transit : preferred === 'car' ? car : undefined;
    if (preferredBrief && eta(preferredBrief) != null && usableFastestEta != null) {
      const delta = eta(preferredBrief)! - usableFastestEta;
      if (delta >= 10) {
        leaveEarlier = 10;
        details.push(`Preferred mode is running ~${delta} min slower than best option.`);
      }
    }

    if (car && expressway && eta(car) != null && eta(expressway) != null) {
      const gap = Math.abs(eta(car)! - eta(expressway)!);
      if (gap <= 5) {
        details.push('Highway route is comparable and may save time later.');
      }
    }

    if (details.length === 0) {
      details.push('No major delays detected based on stub data.');
    }

    const recommendation: Recommendation = {
      headline,
      details,
    };

    if (suggestedMode) {
      recommendation.suggested_mode = suggestedMode;
    }
    if (leaveEarlier) {
      recommendation.leave_earlier_min = leaveEarlier;
    }

    return recommendation;
  }
}

function capitalize(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export const recommendService = new RecommendService();
