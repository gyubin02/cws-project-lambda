import { Car, Train, Bike, Clock, Navigation } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrafficInfo, TravelMode } from '@/lib/types';

interface TrafficDetailModalProps {
  data: TrafficInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modeConfig = {
  car: { 
    label: '자동차', 
    icon: Car, 
    color: 'text-blue-500',
    pros: ['직통 경로', '유연한 일정', '편안함'],
    cons: ['교통 정체', '주차 비용', '높은 배출량'],
  },
  metro: { 
    label: '지하철', 
    icon: Train, 
    color: 'text-green-500',
    pros: ['교통 지연 없음', '예측 가능한 시간', '친환경'],
    cons: ['역까지 도보 이동', '환승 필요 가능', '고정된 일정'],
  },
  bike: { 
    label: '자전거', 
    icon: Bike, 
    color: 'text-orange-500',
    pros: ['유연한 경로', '운동 효과', '무배출'],
    cons: ['날씨 영향', '체력 소모', '제한된 적재량'],
  },
};

export function TrafficDetailModal({ data, open, onOpenChange }: TrafficDetailModalProps) {
  const etaEntries = Object.entries(data.eta).filter(([_, time]) => time !== undefined) as [TravelMode, number][];
  const sortedEntries = [...etaEntries].sort(([, timeA], [, timeB]) => timeA - timeB);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            경로 비교
          </DialogTitle>
          <DialogDescription>
            이동 옵션 상세 분석
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {data.notes && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary">
              <p className="text-sm text-foreground">{data.notes}</p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              이동 시간 비교
            </h3>
            <div className="space-y-3">
              {sortedEntries.map(([mode, time], index) => {
                const config = modeConfig[mode];
                const Icon = config.icon;
                const isRecommended = mode === data.recommend;
                const isFastest = index === 0;

                return (
                  <div
                    key={mode}
                    className={`p-4 rounded-lg transition-colors ${
                      isRecommended ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="font-semibold">{config.label}</span>
                        {isRecommended && (
                          <Badge variant="default" className="ml-2">추천</Badge>
                        )}
                        {isFastest && (
                          <Badge variant="outline" className="ml-2">최단시간</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-lg">{time}분</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">상세 분석</h3>
            <div className="space-y-4">
              {sortedEntries.map(([mode]) => {
                const config = modeConfig[mode];
                const Icon = config.icon;

                return (
                  <div key={mode} className="p-4 rounded-lg bg-gradient-card border">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <h4 className="font-semibold">{config.label}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-success mb-1">장점:</div>
                        <ul className="space-y-1">
                          {config.pros.map((pro, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-success">✓</span>
                              <span className="text-muted-foreground">{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-destructive mb-1">단점:</div>
                        <ul className="space-y-1">
                          {config.cons.map((con, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-destructive">✗</span>
                              <span className="text-muted-foreground">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
