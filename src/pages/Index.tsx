import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchForm } from '@/components/SearchForm';
import { WeatherCard } from '@/components/WeatherCard';
import { AirQualityCard } from '@/components/AirQualityCard';
import { TrafficCard } from '@/components/TrafficCard';
import { WeatherDetailModal } from '@/components/WeatherDetailModal';
import { AirQualityDetailModal } from '@/components/AirQualityDetailModal';
import { TrafficDetailModal } from '@/components/TrafficDetailModal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RecommendationBanner } from '@/components/travel/RecommendationBanner';
import { EtaCompareCard } from '@/components/travel/EtaCompareCard';
import { TollgatePanel } from '@/components/travel/TollgatePanel';
import { ModeSelector } from '@/components/travel/ModeSelector';
import { getBriefing, type BriefingWithModes } from '@/lib/api';
import { SearchParams } from '@/lib/types';
import type { TravelMode } from '@/lib/types/traffic';

const Index = () => {
  const [briefing, setBriefing] = useState<BriefingWithModes | null>(null);
  const [loading, setLoading] = useState(false);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [airModalOpen, setAirModalOpen] = useState(false);
  const [trafficModalOpen, setTrafficModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TravelMode>(() => {
    if (typeof window === 'undefined') {
      return 'car';
    }
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('mode') === 'transit' ? 'transit' : 'car';
    } catch {
      return 'car';
    }
  });

  const sourceLabels: Record<string, string> = {
    stored: '저장 좌표',
    geocoded: '지오코딩',
    request: '요청값',
  };

  const syncModeToUrl = (mode: TravelMode) => {
    if (typeof window === 'undefined') return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('mode', mode);
    window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };

  const handleModeChange = (mode: TravelMode) => {
    if (mode === selectedMode) return;
    setSelectedMode(mode);
    syncModeToUrl(mode);
  };

  const car = useMemo(() => briefing?.traffic_modes?.car ?? null, [briefing]);
  const transit = useMemo(() => briefing?.traffic_modes?.transit ?? null, [briefing]);
  const recommendation = useMemo(() => briefing?.recommendation ?? null, [briefing]);
  const recommendedMode = recommendation?.mode ?? null;
  const showRecommendationBanner =
    recommendedMode !== null && recommendedMode !== 'tie' && recommendedMode !== selectedMode;
  const bannerRecommendedMode = showRecommendationBanner
    ? (recommendedMode as TravelMode)
    : null;
  const hasDualTraffic = Boolean(car || transit);

  const handleSearch = async (params: SearchParams) => {
    setLoading(true);
    if (params.mode) {
      setSelectedMode(params.mode);
      syncModeToUrl(params.mode);
    }
    setTrafficModalOpen(false);
    try {
      const data = await getBriefing(params);
      setBriefing(data);
      toast.success('브리핑이 생성되었습니다!');
    } catch (error) {
      toast.error('브리핑을 가져오는데 실패했습니다. 다시 시도해주세요.');
      console.error('Error fetching briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-sky">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">외출 브리핑</h1>
            <p className="text-sm text-muted-foreground">완벽한 여행을 계획하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/travel">City Commute</Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/settings" aria-label="User settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Search Form */}
        <div className="mb-8 p-6 rounded-xl bg-card shadow-md">
          <h2 className="text-xl font-semibold mb-4">어디로 가시나요?</h2>
          <SearchForm onSubmit={handleSearch} loading={loading} />
        </div>

        {/* Summary */}
        {briefing && !loading && (
          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary">
            <p className="text-center text-foreground font-medium">{briefing.summary}</p>
            {briefing.meta && (
              <div className="mt-2 text-xs text-muted-foreground text-center space-y-1">
                <p>
                  출발지: {sourceLabels[briefing.meta.origin?.source ?? 'request']} · 도착지: {sourceLabels[briefing.meta.destination?.source ?? 'request']}
                </p>
                {briefing.meta.warnings && briefing.meta.warnings.length > 0 && (
                  <p className="flex items-center justify-center gap-1 text-amber-500">
                    ⚠️ {briefing.meta.warnings.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Cards */}
        {(loading || briefing) && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <>
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-[400px]" />
              </>
            ) : null}
            {!loading && briefing && (
              <>
                <WeatherCard
                  data={briefing.weather}
                  onDetailClick={() => setWeatherModalOpen(true)}
                />
                <AirQualityCard
                  data={briefing.air}
                  onDetailClick={() => setAirModalOpen(true)}
                />
                {hasDualTraffic ? (
                  <Card className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-card">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            교통 및 경로
                          </CardTitle>
                          <CardDescription>자동차 · 대중교통 ETA 비교</CardDescription>
                        </div>

                        <ModeSelector
                          value={selectedMode}
                          onChange={handleModeChange}
                          disabled={loading}
                          recommendation={recommendation?.mode ?? undefined}
                          className="mt-1"
                        />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {showRecommendationBanner && bannerRecommendedMode && (
                        <RecommendationBanner
                          preferred={selectedMode}
                          recommended={bannerRecommendedMode}
                          carEtaMinutes={car?.eta_minutes ?? null}
                          transitEtaMinutes={transit?.eta_minutes ?? null}
                          deltaMinutes={recommendation?.delta_min ?? null}
                          reason={recommendation?.reason ?? null}
                        />
                      )}

                      <EtaCompareCard
                        car={car || undefined}
                        transit={transit || undefined}
                        selected={selectedMode}
                        onSelect={handleModeChange}
                        recommended={recommendation?.mode ?? undefined}
                        loading={loading}
                      />

                      {selectedMode === 'car' && car?.tollgates && car.tollgates.length > 0 && (
                        <TollgatePanel tollgates={car.tollgates} />
                      )}
                    </CardContent>
                  </Card>
                ) : briefing.traffic ? (
                  <TrafficCard
                    data={briefing.traffic}
                    onDetailClick={() => setTrafficModalOpen(true)}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
                    교통 정보를 불러오지 못했습니다.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !briefing && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-semibold mb-2">여행을 계획할 준비가 되셨나요?</h3>
            <p className="text-muted-foreground">
              위에서 목적지 정보를 입력하면 날씨, 공기질, 교통 정보를 확인할 수 있습니다.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 외출 브리핑. 데이터 출처: 기상청, 에어코리아, 교통정보</p>
        </div>
      </footer>

      {/* Detail Modals */}
      {briefing && (
        <>
          <WeatherDetailModal
            data={briefing.weather}
            open={weatherModalOpen}
            onOpenChange={setWeatherModalOpen}
          />
          <AirQualityDetailModal
            data={briefing.air}
            open={airModalOpen}
            onOpenChange={setAirModalOpen}
          />
          <TrafficDetailModal
            data={briefing.traffic}
            open={trafficModalOpen}
            onOpenChange={setTrafficModalOpen}
          />
        </>
      )}
    </div>
  );
};

export default Index;
