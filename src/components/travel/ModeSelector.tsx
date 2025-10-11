import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TravelMode } from '@/lib/types/traffic';

type ModeSelectorProps = {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  disabled?: boolean;
  className?: string;
  recommendation?: TravelMode | 'tie';
};

const LABELS: Record<TravelMode, string> = {
  car: 'Car',
  transit: 'Transit',
};

export function ModeSelector({ value, onChange, disabled, className, recommendation }: ModeSelectorProps) {
  const handleValueChange = (next: string) => {
    if (!next) return;
    if (next === value) return;
    onChange(next as TravelMode);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={handleValueChange}
        className="w-fit rounded-lg border bg-card p-1 shadow-sm"
        disabled={disabled}
      >
        {Object.keys(LABELS).map((mode) => {
          const typed = mode as TravelMode;
          const isRecommended = recommendation === typed;
          return (
            <ToggleGroupItem
              key={mode}
              value={mode}
              className={cn(
                'min-w-[96px] justify-center rounded-md px-4 py-2 text-sm font-medium',
                value === mode && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isRecommended && 'ring-1 ring-primary/70'
              )}
              disabled={disabled}
            >
              <span>{LABELS[typed]}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {recommendation && recommendation !== 'tie' && (
        <Badge variant="outline" className="w-fit">
          {LABELS[recommendation as TravelMode]} recommended
        </Badge>
      )}
    </div>
  );
}
