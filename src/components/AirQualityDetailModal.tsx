import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AirQuality } from '@/lib/types';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface AirQualityDetailModalProps {
  data: AirQuality;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const thresholds = {
  pm10: [
    { max: 30, grade: 'good', label: '좋음', icon: CheckCircle, color: 'text-success' },
    { max: 80, grade: 'normal', label: '보통', icon: AlertCircle, color: 'text-secondary' },
    { max: 150, grade: 'bad', label: '나쁨', icon: AlertCircle, color: 'text-warning' },
    { max: Infinity, grade: 'verybad', label: '매우 나쁨', icon: XCircle, color: 'text-destructive' },
  ],
  pm25: [
    { max: 15, grade: 'good', label: '좋음', icon: CheckCircle, color: 'text-success' },
    { max: 35, grade: 'normal', label: '보통', icon: AlertCircle, color: 'text-secondary' },
    { max: 75, grade: 'bad', label: '나쁨', icon: AlertCircle, color: 'text-warning' },
    { max: Infinity, grade: 'verybad', label: '매우 나쁨', icon: XCircle, color: 'text-destructive' },
  ],
};

const recommendations = {
  good: {
    title: '매우 좋은 공기질',
    tips: [
      '야외 활동하기 완벽한 날입니다',
      '모든 실외 운동이 안전합니다',
      '산책과 자전거 타기 좋은 시간입니다',
      '신선한 공기를 위해 창문을 여세요',
    ],
  },
  normal: {
    title: '보통 수준의 공기질',
    tips: [
      '야외 활동이 일반적으로 안전합니다',
      '민감한 분들은 증상을 모니터링하세요',
      '장시간 야외 활동은 줄이는 것을 고려하세요',
      '실내 활동은 완전히 안전합니다',
    ],
  },
  bad: {
    title: '민감군에게 나쁜 공기질',
    tips: [
      '외출 시 KF94 마스크를 착용하세요',
      '장시간 야외 활동을 제한하세요',
      '민감군은 실내에 머무르세요',
      '가능하면 창문을 닫아두세요',
    ],
  },
  verybad: {
    title: '나쁜 공기질',
    tips: [
      '외출 시 KF94 마스크 필수 착용',
      '모든 야외 활동을 피하세요',
      '공기청정기를 가동하고 실내에 머무르세요',
      '가능하면 야외 계획을 연기하세요',
    ],
  },
};

export function AirQualityDetailModal({ data, open, onOpenChange }: AirQualityDetailModalProps) {
  const guidance = recommendations[data.grade];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">공기질 상세정보</DialogTitle>
          <DialogDescription>
            미세먼지 농도 및 건강 가이드
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-semibold mb-2">{guidance.title}</h3>
            <p className="text-sm text-foreground">{data.advice}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-gradient-card border">
              <div className="text-4xl font-bold text-foreground mb-1">{data.pm10}</div>
              <div className="text-sm text-muted-foreground">PM10 µg/m³</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-card border">
              <div className="text-4xl font-bold text-foreground mb-1">{data.pm25}</div>
              <div className="text-sm text-muted-foreground">PM2.5 µg/m³</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">PM10 기준</h3>
            <div className="space-y-2">
              {thresholds.pm10.map((threshold, index) => {
                const Icon = threshold.icon;
                const prevMax = index > 0 ? thresholds.pm10[index - 1].max : 0;
                const isCurrentLevel = data.pm10 > prevMax && data.pm10 <= threshold.max;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isCurrentLevel ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${threshold.color}`} />
                      <span className={isCurrentLevel ? 'font-semibold' : ''}>{threshold.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {prevMax} - {threshold.max === Infinity ? '150+' : threshold.max} µg/m³
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">PM2.5 기준</h3>
            <div className="space-y-2">
              {thresholds.pm25.map((threshold, index) => {
                const Icon = threshold.icon;
                const prevMax = index > 0 ? thresholds.pm25[index - 1].max : 0;
                const isCurrentLevel = data.pm25 > prevMax && data.pm25 <= threshold.max;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isCurrentLevel ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${threshold.color}`} />
                      <span className={isCurrentLevel ? 'font-semibold' : ''}>{threshold.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {prevMax} - {threshold.max === Infinity ? '75+' : threshold.max} µg/m³
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gradient-card border">
            <h3 className="font-semibold mb-3">권장 행동</h3>
            <ul className="space-y-2">
              {guidance.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
