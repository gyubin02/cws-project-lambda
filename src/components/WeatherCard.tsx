import { Cloud, Droplets, Wind, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Weather } from '@/lib/types';

interface WeatherCardProps {
  data: Weather;
  onDetailClick: () => void;
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

export function WeatherCard({ data, onDetailClick }: WeatherCardProps) {
  const precipitationLevel = data.pop > 0.7 ? '높음' : data.pop > 0.3 ? '보통' : '낮음';
  const precipitationColor = data.pop > 0.7 ? 'destructive' : data.pop > 0.3 ? 'warning' : 'success';

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-card"
      onClick={onDetailClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-3xl">{weatherIcons[data.condition]}</span>
              날씨
            </CardTitle>
            <CardDescription>{weatherLabels[data.condition] || data.condition}</CardDescription>
          </div>
          <Badge variant={precipitationColor as any} className="ml-2">
            강수확률 {precipitationLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-foreground">{data.temp}°</span>
          <span className="text-lg text-muted-foreground">체감 {data.feels_like}°</span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="flex flex-col items-center gap-1">
            <Droplets className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">강수</span>
            <span className="text-sm font-medium">{Math.round(data.pop * 100)}%</span>
          </div>
          {data.wind_speed && (
            <div className="flex flex-col items-center gap-1">
              <Wind className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">풍속</span>
              <span className="text-sm font-medium">{data.wind_speed} km/h</span>
            </div>
          )}
          {data.humidity && (
            <div className="flex flex-col items-center gap-1">
              <Cloud className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">습도</span>
              <span className="text-sm font-medium">{data.humidity}%</span>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground pt-2">
          클릭하여 시간별 예보 보기
        </p>
      </CardContent>
    </Card>
  );
}
