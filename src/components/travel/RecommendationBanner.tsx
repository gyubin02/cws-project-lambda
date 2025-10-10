import { cn } from '@/lib/utils';
import type { CityTraffic } from '@/lib/types/traffic';

type RecommendationBannerProps = {
  city: CityTraffic;
  className?: string;
};

const DEFAULT_MESSAGE = 'Limited data available. Choose the mode that fits your plans.';

const buildMessage = (city: CityTraffic): string => {
  const rec = city.recommendation;
  if (!rec) return DEFAULT_MESSAGE;

  if (rec.mode === 'tie') {
    if (rec.delta_min != null && Number.isFinite(rec.delta_min)) {
      return `Similar ETA (±${rec.delta_min} min). Choose based on comfort or cost.`;
    }
    return 'Similar ETA. Choose based on comfort or cost.';
  }

  const delta = rec.delta_min != null && Number.isFinite(rec.delta_min) ? Math.abs(rec.delta_min) : null;
  const modeLabel = rec.mode === 'car' ? 'Car' : 'Transit';
  if (delta != null && delta > 0) {
    return `${modeLabel} is ${delta} min faster. Recommended.`;
  }

  if (rec.reasons && rec.reasons.includes('transit_unavailable')) {
    return 'Transit data unavailable right now. Car recommended.';
  }
  if (rec.reasons && rec.reasons.includes('car_unavailable')) {
    return 'Car data unavailable right now. Transit recommended.';
  }

  return `${modeLabel} route recommended based on current conditions.`;
};

export function RecommendationBanner({ city, className }: RecommendationBannerProps) {
  if (!city) return null;
  const message = buildMessage(city);
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary',
        className
      )}
    >
      {message}
    </div>
  );
}
