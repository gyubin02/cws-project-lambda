import { cn } from '@/lib/utils';
import type { TravelMode } from '@/lib/types/traffic';

type RecommendationBannerProps = {
  preferred: TravelMode;
  recommended: TravelMode;
  carEtaMinutes?: number | null;
  transitEtaMinutes?: number | null;
  deltaMinutes?: number | null;
  reason?: string | null;
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

const modeLabel = (mode: TravelMode): string => (mode === 'car' ? 'Car' : 'Transit');
const modeIcon = (mode: TravelMode): string => (mode === 'car' ? '🚗' : '🚇');

export function RecommendationBanner({
  preferred,
  recommended,
  carEtaMinutes,
  transitEtaMinutes,
  deltaMinutes,
  reason,
  className,
}: RecommendationBannerProps) {
  if (recommended === preferred) return null;

  const deltaText = formatDelta(deltaMinutes);
  const etaText =
    recommended === 'car'
      ? formatEta(carEtaMinutes)
      : formatEta(transitEtaMinutes);

  const messageParts = [
    `${modeIcon(recommended)} ${modeLabel(recommended)} looks faster than ${modeLabel(preferred)}${deltaText ? ` (by ${deltaText})` : ''}.`,
  ];
  if (etaText) {
    messageParts.push(`ETA ≈ ${etaText}.`);
  }
  if (reason) {
    messageParts.push(reason);
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
