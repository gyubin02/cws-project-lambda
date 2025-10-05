import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
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
import { getBriefing } from '@/lib/api';
import { Briefing, SearchParams } from '@/lib/types';

const Index = () => {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [airModalOpen, setAirModalOpen] = useState(false);
  const [trafficModalOpen, setTrafficModalOpen] = useState(false);

  const handleSearch = async (params: SearchParams) => {
    setLoading(true);
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
          <Button asChild variant="ghost" size="icon">
            <Link to="/settings" aria-label="User settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
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
            ) : briefing ? (
              <>
                <WeatherCard 
                  data={briefing.weather} 
                  onDetailClick={() => setWeatherModalOpen(true)}
                />
                <AirQualityCard 
                  data={briefing.air} 
                  onDetailClick={() => setAirModalOpen(true)}
                />
                <TrafficCard 
                  data={briefing.traffic} 
                  onDetailClick={() => setTrafficModalOpen(true)}
                />
              </>
            ) : null}
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
