import { Car, Train, Bike, Clock, Navigation, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrafficInfo, SourceStatus } from '@/lib/types';

interface TrafficDetailModalProps {
  data: TrafficInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function TrafficDetailModal({ data, open, onOpenChange }: TrafficDetailModalProps) {
  const isError = data.source_status !== 'ok';
  const hasData = data.eta_minutes !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            교통 정보
          </DialogTitle>
          <DialogDescription>
            고속도로 교통 정보 및 예상 소요 시간
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
              <span>{data.note || '교통 정보를 가져올 수 없습니다.'}</span>
            </div>
          ) : hasData ? (
            <>
              <div className="p-4 rounded-lg bg-gradient-card border text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-6 w-6 text-primary" />
                  <span className="text-4xl font-bold text-foreground">{data.eta_minutes}분</span>
                </div>
                <p className="text-sm text-muted-foreground">예상 소요 시간</p>
              </div>

              {data.congestion_level && (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Badge variant={congestionColors[data.congestion_level] as any} className="mb-2">
                    {congestionLabels[data.congestion_level]}
                  </Badge>
                  <p className="text-sm text-muted-foreground">교통 상황</p>
                </div>
              )}

              {data.note && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary">
                  <h3 className="font-semibold mb-2">추가 정보</h3>
                  <p className="text-sm text-foreground">{data.note}</p>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-3">교통 정보 안내</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• 고속도로 교통 정보는 실시간으로 업데이트됩니다</p>
                  <p>• 예상 소요 시간은 현재 교통 상황을 기준으로 합니다</p>
                  <p>• 공사, 사고 등으로 인한 지연이 발생할 수 있습니다</p>
                  <p>• 정확한 도착 시간은 여유를 두고 계획하세요</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground p-4">
              <span>교통 정보가 없습니다.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
