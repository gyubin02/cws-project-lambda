import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModeSelector } from '@/components/travel/ModeSelector';
import type { TravelMode } from '@/lib/types/traffic';
import { SearchParams } from '@/lib/types';

interface SearchFormProps {
  onSubmit: (params: SearchParams) => void;
  loading?: boolean;
}

export function SearchForm({ onSubmit, loading }: SearchFormProps) {
  const [from, setFrom] = useState('서울특별시 중구 세종대로 110');
  const [to, setTo] = useState('서울특별시 송파구 올림픽로 300');
  const [mode, setMode] = useState<TravelMode>('car');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ from, to, mode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            출발지
          </Label>
          <Input
            id="from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="출발 위치"
            required
            className="transition-smooth"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to" className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-accent" />
            도착지
          </Label>
          <Input
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="목적지"
            required
            className="transition-smooth"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preferred Mode
        </Label>
        <ModeSelector value={mode} onChange={setMode} disabled={loading} />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full transition-smooth"
        disabled={loading}
      >
        {loading ? '로딩 중...' : '브리핑 받기'}
      </Button>
    </form>
  );
}
