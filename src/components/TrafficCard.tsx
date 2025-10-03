import { Car, Train, Bike, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrafficInfo, SourceStatus } from '@/lib/types';

interface TrafficCardProps {
  data: TrafficInfo;
  onDetailClick: () => void;
}

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

const congestionLabels: Record<string, string> = {
  LOW: '원활',
  MID: '보통',
  HIGH: '정체',
};

const congestionColors: Record<string, string> = {
  LOW: 'success',
  MID: 'warning',
  HIGH: 'destructive',
};

export function TrafficCard({ data, onDetailClick }: TrafficCardProps) {
  const isError = data.source_status !== 'ok';
  const hasData = data.eta_minutes !== undefined;

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-card"
      onClick={onDetailClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              교통 및 경로
            </CardTitle>
            <CardDescription>이동 시간 및 교통 상황</CardDescription>
          </div>
          <Badge variant={isError ? statusColors[data.source_status] as any : 'default'} className="ml-2 gap-1">
            {isError ? statusLabels[data.source_status] : '교통 정보'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{data.note || '교통 정보를 가져올 수 없습니다.'}</span>
          </div>
        ) : hasData ? (
          <>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold text-foreground">{data.eta_minutes}분</span>
              </div>
              <p className="text-sm text-muted-foreground">예상 소요 시간</p>
            </div>

            {data.congestion_level && (
              <div className="text-center">
                <Badge variant={congestionColors[data.congestion_level] as any} className="mb-2">
                  {congestionLabels[data.congestion_level]}
                </Badge>
                <p className="text-xs text-muted-foreground">교통 상황</p>
              </div>
            )}

            {data.note && (
              <div className="pt-4 border-t">
                <p className="text-sm text-center text-foreground">{data.note}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <span className="text-sm">교통 정보 없음</span>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          클릭하여 상세 정보 보기
        </p>
      </CardContent>
    </Card>
  );
}
