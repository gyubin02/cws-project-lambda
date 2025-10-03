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
  const [from, setFrom] = useState('Gangnam Station, Seoul');
  const [to, setTo] = useState('Hongdae, Seoul');
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
    { value: 'car', label: 'Car', icon: '🚗' },
    { value: 'metro', label: 'Metro', icon: '🚇' },
    { value: 'bike', label: 'Bike', icon: '🚴' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            From
          </Label>
          <Input
            id="from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Starting location"
            required
            className="transition-smooth"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to" className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-accent" />
            To
          </Label>
          <Input
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Destination"
            required
            className="transition-smooth"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="time" className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Departure Time
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
        <Label>Travel Mode</Label>
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
        {loading ? 'Loading...' : 'Get Briefing'}
      </Button>
    </form>
  );
}
