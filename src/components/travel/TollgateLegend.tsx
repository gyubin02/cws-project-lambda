import { cn } from '@/lib/utils';

type LegendItem = {
  label: string;
  color: string;
};

const LEGEND: LegendItem[] = [
  { label: 'Smooth', color: 'bg-emerald-500' },
  { label: 'Moderate', color: 'bg-amber-500' },
  { label: 'Congested', color: 'bg-rose-500' },
  { label: 'Blocked', color: 'bg-rose-700' },
];

export function TollgateLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}>
      {LEGEND.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-full', item.color)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
