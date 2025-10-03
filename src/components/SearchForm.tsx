import { useState } from 'react';
import { MapPin, Calendar, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchParams, TravelMode } from '@/lib/types';

interface SearchFormProps {
  onSubmit: (params: SearchParams) => void;
  loading?: boolean;
}

export function SearchForm({ onSubmit, loading }: SearchFormProps) {
  const [from, setFrom] = useState('서울 강남역');
  const [to, setTo] = useState('서울 홍대');
  const [mode, setMode] = useState<TravelMode>('car');
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ from, to, time, mode });
  };

  const modes: { value: TravelMode; label: string; icon: string }[] = [
    { value: 'car', label: '자동차', icon: '🚗' },
    { value: 'metro', label: '지하철', icon: '🚇' },
    { value: 'bike', label: '자전거', icon: '🚴' },
  ];

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
        <Label htmlFor="time" className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          출발 시간
        </Label>
        <Input
          id="time"
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          className="transition-smooth"
        />
      </div>

      <div className="space-y-2">
        <Label>이동 수단</Label>
        <div className="flex gap-2">
          {modes.map((m) => (
            <Button
              key={m.value}
              type="button"
              variant={mode === m.value ? 'default' : 'outline'}
              onClick={() => setMode(m.value)}
              className="flex-1 transition-smooth"
            >
              <span className="mr-2 text-lg">{m.icon}</span>
              {m.label}
            </Button>
          ))}
        </div>
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
