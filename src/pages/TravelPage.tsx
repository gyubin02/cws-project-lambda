import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ModeSelector } from '@/components/travel/ModeSelector';
import { EtaCompareCard } from '@/components/travel/EtaCompareCard';
import { RecommendationBanner } from '@/components/travel/RecommendationBanner';
import { TollgatePanel } from '@/components/travel/TollgatePanel';
import { fetchCity } from '@/lib/api/traffic';
import type { CityTraffic, TravelMode } from '@/lib/types/traffic';

type CoordinatePair = [number, number];

const DEFAULT_FROM = '37.498,127.027';
const DEFAULT_TO = '37.566,126.978';

const parseCoordinate = (value: string): CoordinatePair => {
  const trimmed = value.trim();
  if (!trimmed.includes(',')) {
    throw new Error('Use "lat,lon" format (e.g., 37.566,126.978)');
  }
  const [latRaw, lonRaw] = trimmed.split(',').map((part) => part.trim());
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Latitude and longitude must be numbers.');
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Coordinates out of range.');
  }
  return [lat, lon];
};

const buildStatusHint = (city: CityTraffic | null, mode: TravelMode): string | null => {
  const brief = mode === 'car' ? city?.car ?? undefined : city?.transit ?? undefined;
  if (!brief) return null;
  if (!brief.source_status || brief.source_status === 'ok') return null;
  return `${mode === 'car' ? 'Car' : 'Transit'} data is ${brief.source_status}.`;
};

const computeRecommended = (city: CityTraffic | null): TravelMode | 'tie' | undefined => {
  const mode = city?.recommendation?.mode;
  if (!mode) return undefined;
  return mode;
};

export default function TravelPage() {
  const [fromInput, setFromInput] = useState(DEFAULT_FROM);
  const [toInput, setToInput] = useState(DEFAULT_TO);
  const [origin, setOrigin] = useState<CoordinatePair | null>(null);
  const [destination, setDestination] = useState<CoordinatePair | null>(null);
  const [mode, setMode] = useState<TravelMode>('car');
  const [city, setCity] = useState<CityTraffic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommended = computeRecommended(city);

  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const at = new Date().toISOString();
        const data = await fetchCity({ from: origin, to: destination, at });
        if (cancelled) return;
        setCity(data);
      } catch (err) {
        if (cancelled) return;
        setCity(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch traffic data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsedFrom = parseCoordinate(fromInput);
      const parsedTo = parseCoordinate(toInput);
      setOrigin(parsedFrom);
      setDestination(parsedTo);
      setCity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid coordinates.');
    }
  };

  const activeStatus = useMemo(() => buildStatusHint(city, mode), [city, mode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-background text-foreground">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Traffic</p>
            <h1 className="text-2xl font-semibold text-white">City Commute Comparison</h1>
            <p className="text-sm text-muted-foreground">
              Compare live car and transit ETAs with tollgate congestion insights.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/" className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border/40 bg-card/50 p-4 shadow-lg backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <MapPin className="h-4 w-4 text-primary" />
                Origin (lat,lon)
              </Label>
              <Input
                id="from"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
                placeholder="37.498,127.027"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <MapPin className="h-4 w-4 text-primary" />
                Destination (lat,lon)
              </Label>
              <Input
                id="to"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
                placeholder="37.566,126.978"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Loading…' : 'Fetch Commute'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </form>

        <ModeSelector
          className="mt-6"
          value={mode}
          onChange={setMode}
          disabled={loading}
          recommendation={recommended && recommended !== 'tie' ? recommended : undefined}
        />

        {city && <RecommendationBanner city={city} />}

        <EtaCompareCard
          car={city?.car || undefined}
          transit={city?.transit || undefined}
          selected={mode}
          onSelect={setMode}
          recommended={recommended}
          loading={loading}
        />

        {activeStatus && (
          <p className="text-xs text-muted-foreground">
            {activeStatus}
          </p>
        )}

        {mode === 'car' && (
          <TollgatePanel tollgates={city?.car?.tollgates} />
        )}

        <Separator className="bg-border/40" />

        {!origin && !destination && (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
            Enter coordinates above to fetch live commute data. Coordinates use latitude, longitude order.
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
            Fetching latest routes…
          </div>
        )}
      </div>
    </div>
  );
}
