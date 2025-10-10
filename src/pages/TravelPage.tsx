import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModeSelector } from '@/components/travel/ModeSelector';
import { EtaCompareCard } from '@/components/travel/EtaCompareCard';
import { RecommendationBanner } from '@/components/travel/RecommendationBanner';
import { TollgatePanel } from '@/components/travel/TollgatePanel';
import { fetchCar, fetchCity } from '@/lib/api/traffic';
import type {
  CarBrief,
  CityRecommendation,
  TransitBrief,
  TravelMode,
} from '@/lib/types/traffic';

const DEFAULT_FROM = '강남역';
const DEFAULT_TO = '서울역';

const sanitize = (value: string | null): string => (value ?? '').trim();

const buildStatusHint = (mode: TravelMode, car: CarBrief | null, transit: TransitBrief | null): string | null => {
  const brief = mode === 'car' ? car : transit;
  if (!brief?.source_status || brief.source_status === 'ok') return null;
  const modeLabel = mode === 'car' ? 'Car' : 'Transit';
  return `${modeLabel} data status: ${brief.source_status}.`;
};

const formatMinutes = (minutes?: number | null): string | null => {
  if (minutes == null || Number.isNaN(minutes)) return null;
  return `${Math.round(minutes)} min`;
};

const formatDistance = (distanceKm?: number | null): string | null => {
  if (distanceKm == null || Number.isNaN(distanceKm)) return null;
  return `${distanceKm.toFixed(1)} km`;
};

const formatFare = (fare?: number | null): string | null => {
  if (fare == null || Number.isNaN(fare)) return null;
  return `${fare.toLocaleString()}₩`;
};

export default function TravelPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = sanitize(searchParams.get('from'));
  const toParam = sanitize(searchParams.get('to'));
  const modeParam = searchParams.get('mode') === 'transit' ? 'transit' : 'car';

  const [fromInput, setFromInput] = useState(fromParam || DEFAULT_FROM);
  const [toInput, setToInput] = useState(toParam || DEFAULT_TO);
  const [mode, setMode] = useState<TravelMode>(modeParam);

  const [carBrief, setCarBrief] = useState<CarBrief | null>(null);
  const [transitBrief, setTransitBrief] = useState<TransitBrief | null>(null);
  const [recommendation, setRecommendation] = useState<CityRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromInput(fromParam || DEFAULT_FROM);
  }, [fromParam]);

  useEffect(() => {
    setToInput(toParam || DEFAULT_TO);
  }, [toParam]);

  useEffect(() => {
    setMode(modeParam);
  }, [modeParam]);

  useEffect(() => {
    if (!fromParam || !toParam) {
      setCarBrief(null);
      setTransitBrief(null);
      setRecommendation(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (mode === 'car') {
          const car = await fetchCar({ from: fromParam, to: toParam, signal });
          if (cancelled) return;
          setCarBrief(car);
          setTransitBrief(null);
          setRecommendation(null);
        } else {
          const city = await fetchCity({ from: fromParam, to: toParam, signal });
          if (cancelled) return;
          setCarBrief(city.car ?? null);
          setTransitBrief(city.transit ?? null);
          setRecommendation(city.recommendation ?? null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to fetch traffic data.');
        setCarBrief(null);
        setTransitBrief(null);
        setRecommendation(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fromParam, toParam, mode]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFrom = fromInput.trim();
    const nextTo = toInput.trim();

    if (!nextFrom || !nextTo) {
      setError('Please provide both origin and destination.');
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('from', nextFrom);
    next.set('to', nextTo);
    next.set('mode', mode);
    setSearchParams(next);
  };

  const handleModeChange = (nextMode: TravelMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    const next = new URLSearchParams(searchParams);
    if (fromParam) next.set('from', fromParam);
    if (toParam) next.set('to', toParam);
    next.set('mode', nextMode);
    setSearchParams(next);
  };

  const activeStatus = useMemo(() => buildStatusHint(mode, carBrief, transitBrief), [mode, carBrief, transitBrief]);

  const showEmptyState = !fromParam || !toParam;
  const carEtaLabel = formatMinutes(carBrief?.eta_minutes);
  const transitEtaLabel = formatMinutes(transitBrief?.eta_minutes);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-background text-foreground">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Traffic</p>
            <h1 className="text-2xl font-semibold text-white">City Commute Briefing</h1>
            <p className="text-sm text-muted-foreground">
              Choose your preferred mode to tailor the briefing and recommendations.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/" className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border/40 bg-card/50 p-4 shadow-lg backdrop-blur"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <MapPin className="h-4 w-4 text-primary" />
                Origin
              </Label>
              <Input
                id="from"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
                placeholder="예: 강남역"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <MapPin className="h-4 w-4 text-primary" />
                Destination
              </Label>
              <Input
                id="to"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
                placeholder="예: 서울역"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Loading…' : 'Get Briefing'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </form>

        <ModeSelector
          className="mt-6"
          value={mode}
          onChange={handleModeChange}
          disabled={loading}
          recommendation={recommendation?.mode && recommendation.mode !== 'tie' ? recommendation.mode : undefined}
        />

        {mode === 'transit' && recommendation?.mode === 'car' && (
          <RecommendationBanner
            mode={mode}
            recommendation={recommendation}
            carEtaMinutes={carBrief?.eta_minutes ?? null}
          />
        )}

        {mode === 'car' && carBrief && (
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">Driving ETA</CardTitle>
                {carEtaLabel && <Badge variant="secondary">{carEtaLabel}</Badge>}
              </div>
              {formatDistance(carBrief.distance_km) && (
                <CardDescription>{formatDistance(carBrief.distance_km)}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4">
                {carBrief.tollgates && carBrief.tollgates.length > 0 && (
                  <span>{carBrief.tollgates.length} tollgate{carBrief.tollgates.length > 1 ? 's' : ''} on route</span>
                )}
                {carBrief.source && <span>Source: {carBrief.source}</span>}
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'transit' && transitBrief && (
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">Transit ETA</CardTitle>
                {transitEtaLabel && <Badge variant="secondary">{transitEtaLabel}</Badge>}
              </div>
              <CardDescription>
                {[
                  formatDistance(transitBrief.distance_km),
                  formatFare(transitBrief.fare_krw),
                  transitBrief.transfers != null ? `${transitBrief.transfers} transfer${transitBrief.transfers === 1 ? '' : 's'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {transitBrief.notes && transitBrief.notes.length > 0 && (
                <ul className="list-inside list-disc space-y-1">
                  {transitBrief.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              {transitBrief.source && <p>Source: {transitBrief.source}</p>}
            </CardContent>
          </Card>
        )}

        {mode === 'transit' && (carBrief || transitBrief) && (
          <EtaCompareCard
            car={carBrief || undefined}
            transit={transitBrief || undefined}
            selected="transit"
            onSelect={handleModeChange}
            recommended={recommendation?.mode}
            loading={loading}
          />
        )}

        {activeStatus && (
          <p className="text-xs text-muted-foreground">{activeStatus}</p>
        )}

        {mode === 'car' && <TollgatePanel tollgates={carBrief?.tollgates} />}

        <Separator className="bg-border/40" />

        {showEmptyState && (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
            Enter an origin and destination to preview live commute data. Geocoding happens automatically on the server.
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
