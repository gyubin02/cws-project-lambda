import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CarBrief, TransitBrief, TravelMode } from '@/lib/types/traffic';

type EtaCompareCardProps = {
  car?: CarBrief;
  transit?: TransitBrief;
  selected?: TravelMode;
  onSelect?: (mode: TravelMode) => void;
  recommended?: TravelMode | 'tie';
  loading?: boolean;
  readOnly?: boolean;
};

type ModeBrief = {
  mode: TravelMode;
  label: string;
  brief?: CarBrief | TransitBrief;
};

const MODE_LABEL: Record<TravelMode, string> = {
  car: 'Car',
  transit: 'Transit',
};

const formatEta = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  return `${value} min`;
};

const formatDistance = (value?: number): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `${value.toFixed(1)} km`;
};

const formatFare = (value?: number): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return `${value.toLocaleString()}₩`;
};

const formatTransfers = (value?: number): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value === 0) return 'No transfers';
  if (value === 1) return '1 transfer';
  return `${value} transfers`;
};

export function EtaCompareCard({ car, transit, selected = 'car', onSelect, recommended, loading, readOnly }: EtaCompareCardProps) {
  const modes: ModeBrief[] = [
    { mode: 'car', label: MODE_LABEL.car, brief: car },
    { mode: 'transit', label: MODE_LABEL.transit, brief: transit },
  ];

  return (
    <Card className="divide-y border shadow-sm">
      {modes.map(({ mode, label, brief }) => {
        const active = !readOnly && selected === mode;
        const isRecommended = recommended === mode;
        const disabled = !brief;
        const showStatus = brief?.source_status && brief.source_status !== 'ok';
        const clickable = !!onSelect && !readOnly && !disabled && !loading;
        const content = (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-2xl font-bold leading-tight tracking-tight">{formatEta(brief?.eta_minutes)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isRecommended && (
                  <Badge variant="default" className="uppercase">
                    Recommended
                  </Badge>
                )}
                {active && <Badge variant="outline">Selected</Badge>}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {mode === 'car' ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {formatDistance(brief?.distance_km) && <span>{formatDistance(brief?.distance_km)}</span>}
                  {car?.tollgates && car.tollgates.length > 0 && (
                    <span>{car.tollgates.length} tollgate{car.tollgates.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {formatDistance(brief?.distance_km) && <span>{formatDistance(brief?.distance_km)}</span>}
                  {formatFare((brief as TransitBrief | undefined)?.fare_krw) && (
                    <span>{formatFare((brief as TransitBrief | undefined)?.fare_krw)}</span>
                  )}
                  {formatTransfers((brief as TransitBrief | undefined)?.transfers) && (
                    <span>{formatTransfers((brief as TransitBrief | undefined)?.transfers)}</span>
                  )}
                </div>
              )}
            </div>
            {showStatus && (
              <p className="text-xs text-muted-foreground">
                Data status: {brief?.source_status}
              </p>
            )}
          </>
        );

        if (clickable) {
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled || loading}
              onClick={() => onSelect(mode)}
              className={cn(
                'flex w-full flex-col gap-2 p-4 text-left transition-colors',
                !disabled && 'hover:bg-muted/60',
                active && 'bg-muted/70',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={mode}
            className={cn(
              'flex w-full flex-col gap-2 p-4 text-left',
              disabled && 'opacity-60'
            )}
          >
            {content}
          </div>
        );
      })}
    </Card>
  );
}
