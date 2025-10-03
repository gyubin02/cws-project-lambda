import { Wind, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AirQuality } from '@/lib/types';

interface AirQualityCardProps {
  data: AirQuality;
  onDetailClick: () => void;
}

const gradeConfig = {
  good: { label: '좋음', color: 'success', icon: CheckCircle, emoji: '😊' },
  normal: { label: '보통', color: 'secondary', icon: AlertCircle, emoji: '😐' },
  bad: { label: '나쁨', color: 'warning', icon: AlertCircle, emoji: '😷' },
  verybad: { label: '매우 나쁨', color: 'destructive', icon: XCircle, emoji: '🚨' },
};

export function AirQualityCard({ data, onDetailClick }: AirQualityCardProps) {
  const config = gradeConfig[data.grade];
  const Icon = config.icon;

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
          <Badge variant={config.color as any} className="ml-2 gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <span className="text-6xl">{config.emoji}</span>
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

        <div className="pt-4 border-t">
          <p className="text-sm text-center text-foreground">{data.advice}</p>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          클릭하여 상세 기준 보기
        </p>
      </CardContent>
    </Card>
  );
}
