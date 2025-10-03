import { Wind, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AirQuality, SourceStatus } from '@/lib/types';

interface AirQualityCardProps {
  data: AirQuality;
  onDetailClick: () => void;
}

const gradeConfig = {
  GOOD: { label: '좋음', color: 'success', icon: CheckCircle, emoji: '😊' },
  MODERATE: { label: '보통', color: 'secondary', icon: AlertCircle, emoji: '😐' },
  BAD: { label: '나쁨', color: 'warning', icon: AlertCircle, emoji: '😷' },
  VERY_BAD: { label: '매우 나쁨', color: 'destructive', icon: XCircle, emoji: '🚨' },
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

export function AirQualityCard({ data, onDetailClick }: AirQualityCardProps) {
  const isError = data.source_status !== 'ok';
  const hasData = data.pm10 !== undefined && data.pm25 !== undefined && data.grade !== undefined;
  const config = data.grade ? gradeConfig[data.grade] : null;
  const Icon = config?.icon || AlertCircle;

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-card"
      onClick={onDetailClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-primary" />
              공기질
            </CardTitle>
            <CardDescription>미세먼지 농도</CardDescription>
          </div>
          <Badge variant={isError ? statusColors[data.source_status] as any : config?.color as any} className="ml-2 gap-1">
            <Icon className="h-3 w-3" />
            {isError ? statusLabels[data.source_status] : config?.label || '정보 없음'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{data.note || '공기질 정보를 가져올 수 없습니다.'}</span>
          </div>
        ) : hasData ? (
          <>
            <div className="flex items-center justify-center gap-4">
              <span className="text-6xl">{config?.emoji || '🌫️'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{data.pm10}</div>
                <div className="text-xs text-muted-foreground">PM10 µg/m³</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{data.pm25}</div>
                <div className="text-xs text-muted-foreground">PM2.5 µg/m³</div>
              </div>
            </div>

            {data.note && (
              <div className="pt-4 border-t">
                <p className="text-sm text-center text-foreground">{data.note}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <span className="text-sm">공기질 정보 없음</span>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          클릭하여 상세 기준 보기
        </p>
      </CardContent>
    </Card>
  );
}
