import { Cloud, Droplets, Wind, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Weather, SourceStatus } from '@/lib/types';

interface WeatherDetailModalProps {
  data: Weather;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function WeatherDetailModal({ data, open, onOpenChange }: WeatherDetailModalProps) {
  const isError = data.source_status !== 'ok';
  const hasData = data.tmax_c !== undefined && data.tmin_c !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">{data.sky ? weatherIcons[data.sky] : '🌤️'}</span>
            날씨 정보
          </DialogTitle>
          <DialogDescription>
            기상청 데이터 기반 날씨 정보
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <Badge variant={statusColors[data.source_status] as any}>
              {statusLabels[data.source_status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              업데이트: {new Date(data.updated_at).toLocaleString()}
            </span>
          </div>

          {isError ? (
            <div className="flex items-center gap-2 text-muted-foreground p-4 rounded-lg bg-muted/50">
              <AlertCircle className="h-5 w-5" />
              <span>{data.note || '날씨 정보를 가져올 수 없습니다.'}</span>
            </div>
          ) : hasData ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold text-foreground">{data.tmax_c}°</div>
                  <div className="text-sm text-muted-foreground">최고 기온</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold text-foreground">{data.tmin_c}°</div>
                  <div className="text-sm text-muted-foreground">최저 기온</div>
                </div>
              </div>

              {data.sky && (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl mb-2">{weatherIcons[data.sky]}</div>
                  <div className="font-semibold">{weatherLabels[data.sky]}</div>
                  <div className="text-sm text-muted-foreground">하늘 상태</div>
                </div>
              )}

              {data.note && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h3 className="font-semibold mb-2">추가 정보</h3>
                  <p className="text-sm text-muted-foreground">{data.note}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground p-4">
              <span>날씨 정보가 없습니다.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
