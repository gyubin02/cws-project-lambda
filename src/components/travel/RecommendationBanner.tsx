import { cn } from '@/lib/utils';
import type { CityRecommendation, TravelMode } from '@/lib/types/traffic';

type RecommendationBannerProps = {
  mode: TravelMode;
  recommendation?: CityRecommendation | null;
  carEtaMinutes?: number | null;
  className?: string;
};

const formatDelta = (delta?: number | null): string | null => {
  if (delta == null || Number.isNaN(delta) || delta === 0) return null;
  return `${Math.abs(Math.round(delta))} min`;
};

const formatEta = (eta?: number | null): string | null => {
  if (eta == null || Number.isNaN(eta)) return null;
  return `${Math.round(eta)} min`;
};

export function RecommendationBanner({ mode, recommendation, carEtaMinutes, className }: RecommendationBannerProps) {
  if (mode !== 'transit') return null;
  if (!recommendation || recommendation.mode !== 'car') return null;

  const deltaText = formatDelta(recommendation.delta_min);
  const etaText = formatEta(carEtaMinutes);

  const messageParts = [`🚗 Car might be faster${deltaText ? ` (by ${deltaText})` : ''}.`];
  if (etaText) {
    messageParts.push(`ETA ≈ ${etaText}.`);
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary',
        className
      )}
    >
      {messageParts.join(' ')}
    </div>
  );
}
