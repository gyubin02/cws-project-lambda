import { useState } from 'react';
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
      toast.success('Briefing generated successfully!');
    } catch (error) {
      toast.error('Failed to fetch briefing. Please try again.');
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
            <h1 className="text-2xl font-bold text-foreground">Outing Briefing</h1>
            <p className="text-sm text-muted-foreground">Plan your perfect trip</p>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Search Form */}
        <div className="mb-8 p-6 rounded-xl bg-card shadow-md">
          <h2 className="text-xl font-semibold mb-4">Where are you going?</h2>
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
            <h3 className="text-xl font-semibold mb-2">Ready to plan your trip?</h3>
            <p className="text-muted-foreground">
              Enter your destination details above to get weather, air quality, and traffic insights.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Outing Briefing. Data sources: Weather API, Air Quality API, Traffic API</p>
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
