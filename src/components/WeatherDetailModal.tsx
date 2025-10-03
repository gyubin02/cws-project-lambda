import { Cloud, Droplets, Wind } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Weather } from '@/lib/types';

interface WeatherDetailModalProps {
  data: Weather;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const weatherIcons: Record<string, string> = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
};

const weatherLabels: Record<string, string> = {
  clear: '맑음',
  cloudy: '흐림',
  rain: '비',
  snow: '눈',
};

export function WeatherDetailModal({ data, open, onOpenChange }: WeatherDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">{weatherIcons[data.condition]}</span>
            날씨 예보
          </DialogTitle>
          <DialogDescription>
            여행을 위한 시간별 상세 정보
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-3xl font-bold text-foreground">{data.temp}°</div>
              <div className="text-sm text-muted-foreground">기온</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-3xl font-bold text-foreground">{data.feels_like}°</div>
              <div className="text-sm text-muted-foreground">체감 온도</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-3xl font-bold text-foreground">{Math.round(data.pop * 100)}%</div>
              <div className="text-sm text-muted-foreground">강수 확률</div>
            </div>
          </div>

          {(data.wind_speed || data.humidity) && (
            <div className="grid grid-cols-2 gap-4">
              {data.wind_speed && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Wind className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">{data.wind_speed} km/h</div>
                    <div className="text-xs text-muted-foreground">풍속</div>
                  </div>
                </div>
              )}
              {data.humidity && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Cloud className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">{data.humidity}%</div>
                    <div className="text-xs text-muted-foreground">습도</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-primary" />
              시간별 예보
            </h3>
            <div className="space-y-2">
              {data.hourly.map((hour, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{weatherIcons[hour.condition]}</span>
                    <span className="font-medium">{hour.time}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{hour.temp}°</span>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Droplets className="h-3 w-3" />
                      {Math.round(hour.pop * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
