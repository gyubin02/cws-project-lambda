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
    { max: 30, grade: 'good', label: 'Good', icon: CheckCircle, color: 'text-success' },
    { max: 80, grade: 'normal', label: 'Normal', icon: AlertCircle, color: 'text-secondary' },
    { max: 150, grade: 'bad', label: 'Bad', icon: AlertCircle, color: 'text-warning' },
    { max: Infinity, grade: 'verybad', label: 'Very Bad', icon: XCircle, color: 'text-destructive' },
  ],
  pm25: [
    { max: 15, grade: 'good', label: 'Good', icon: CheckCircle, color: 'text-success' },
    { max: 35, grade: 'normal', label: 'Normal', icon: AlertCircle, color: 'text-secondary' },
    { max: 75, grade: 'bad', label: 'Bad', icon: AlertCircle, color: 'text-warning' },
    { max: Infinity, grade: 'verybad', label: 'Very Bad', icon: XCircle, color: 'text-destructive' },
  ],
};

const recommendations = {
  good: {
    title: 'Excellent air quality',
    tips: [
      'Perfect day for outdoor activities',
      'All outdoor exercise is safe',
      'Great time for walks and cycling',
      'Open windows for fresh air',
    ],
  },
  normal: {
    title: 'Acceptable air quality',
    tips: [
      'Generally safe for outdoor activities',
      'Sensitive individuals should monitor symptoms',
      'Consider reducing prolonged outdoor exertion',
      'Indoor activities are perfectly safe',
    ],
  },
  bad: {
    title: 'Unhealthy for sensitive groups',
    tips: [
      'Wear a KF94 or N95 mask outdoors',
      'Limit prolonged outdoor activities',
      'Sensitive groups should stay indoors',
      'Keep windows closed if possible',
    ],
  },
  verybad: {
    title: 'Unhealthy air quality',
    tips: [
      'Wear a KF94 or N95 mask if going outside',
      'Avoid all outdoor activities',
      'Stay indoors with air purifier running',
      'Postpone outdoor plans if possible',
    ],
  },
};

export function AirQualityDetailModal({ data, open, onOpenChange }: AirQualityDetailModalProps) {
  const guidance = recommendations[data.grade];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Air Quality Details</DialogTitle>
          <DialogDescription>
            Understanding particulate matter levels and health guidance
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
            <h3 className="font-semibold mb-3">PM10 Thresholds</h3>
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
            <h3 className="font-semibold mb-3">PM2.5 Thresholds</h3>
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
            <h3 className="font-semibold mb-3">Recommended Actions</h3>
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
