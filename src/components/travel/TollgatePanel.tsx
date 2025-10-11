import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TollgateInfo } from '@/lib/types/traffic';
import { TollgateLegend } from './TollgateLegend';

type TollgatePanelProps = {
  tollgates?: TollgateInfo[] | null;
};

const CONGESTION_VARIANT: Record<NonNullable<TollgateInfo['congestion']>, string> = {
  SMOOTH: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  MODERATE: 'bg-amber-100 text-amber-700 border border-amber-300',
  CONGESTED: 'bg-rose-100 text-rose-700 border border-rose-300',
  BLOCKED: 'bg-rose-200 text-rose-800 border border-rose-400',
};

const formatUpdatedAt = (value?: string): string | null => {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

export function TollgatePanel({ tollgates }: TollgatePanelProps) {
  if (!tollgates || tollgates.length === 0) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Tollgate Congestion</CardTitle>
        <TollgateLegend />
      </CardHeader>
      <CardContent className="space-y-3">
        {tollgates.map((tollgate) => {
          const congestion = tollgate.congestion;
          const badgeClass =
            congestion && CONGESTION_VARIANT[congestion]
              ? CONGESTION_VARIANT[congestion]
              : 'bg-muted text-muted-foreground';
          const updated = formatUpdatedAt(tollgate.updated_at);
          return (
            <div
              key={tollgate.code || tollgate.name}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 transition hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{tollgate.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tollgate.lat.toFixed(3)}, {tollgate.lon.toFixed(3)}
                  </p>
                </div>
                {congestion && (
                  <Badge className={cn('text-xs font-semibold uppercase', badgeClass)}>
                    {congestion.toLowerCase()}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {typeof tollgate.speed_kph === 'number' && (
                  <span>Speed {Math.round(tollgate.speed_kph)} km/h</span>
                )}
                {typeof tollgate.delay_min === 'number' && (
                  <span>Delay {Math.round(tollgate.delay_min)} min</span>
                )}
                {updated && <span>Updated {updated}</span>}
                {tollgate.source && <span className="uppercase">Source: {tollgate.source}</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
