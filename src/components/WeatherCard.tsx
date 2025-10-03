import { Cloud, Droplets, Wind, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Weather, SourceStatus } from '@/lib/types';

interface WeatherCardProps {
  data: Weather;
  onDetailClick: () => void;
}

const weatherIcons: Record<string, string> = {
  SUNNY: '☀️',
  CLOUDY: '☁️',
  RAINY: '🌧️',
};

const weatherLabels: Record<string, string> = {
  SUNNY: '맑음',
  CLOUDY: '흐림',
  RAINY: '비',
};

const statusLabels: Record<SourceStatus, string> = {
  ok: '정상',
  missing_api_key: 'API 키 없음',
  upstream_error: '서비스 오류',
  timeout: '시간 초과',
  bad_response: '응답 오류',
};

const statusColors: Record<SourceStatus, string> = {
  ok: 'success',
  missing_api_key: 'warning',
  upstream_error: 'destructive',
  timeout: 'destructive',
  bad_response: 'destructive',
};

export function WeatherCard({ data, onDetailClick }: WeatherCardProps) {
  const isError = data.source_status !== 'ok';
  const hasData = data.tmax_c !== undefined && data.tmin_c !== undefined;

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-card"
      onClick={onDetailClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-3xl">{data.sky ? weatherIcons[data.sky] : '🌤️'}</span>
              날씨
            </CardTitle>
            <CardDescription>
              {data.sky ? weatherLabels[data.sky] : '정보 없음'}
            </CardDescription>
          </div>
          <Badge variant={statusColors[data.source_status] as any} className="ml-2">
            {statusLabels[data.source_status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{data.note || '날씨 정보를 가져올 수 없습니다.'}</span>
          </div>
        ) : hasData ? (
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-foreground">
              {data.tmax_c}°/{data.tmin_c}°
            </span>
            <span className="text-lg text-muted-foreground">최고/최저</span>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <span className="text-sm">날씨 정보 없음</span>
          </div>
        )}

        {data.note && !isError && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            {data.note}
          </p>
        )}

        <p className="text-xs text-center text-muted-foreground pt-2">
          클릭하여 상세 정보 보기
        </p>
      </CardContent>
    </Card>
  );
}
