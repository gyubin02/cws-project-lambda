import { Car, Train, Bike, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrafficInfo, TravelMode } from '@/lib/types';

interface TrafficCardProps {
  data: TrafficInfo;
  onDetailClick: () => void;
}

const modeConfig = {
  car: { label: 'Car', icon: Car, color: 'text-blue-500' },
  metro: { label: 'Metro', icon: Train, color: 'text-green-500' },
  bike: { label: 'Bike', icon: Bike, color: 'text-orange-500' },
};

export function TrafficCard({ data, onDetailClick }: TrafficCardProps) {
  const recommendedConfig = modeConfig[data.recommend];
  const RecommendedIcon = recommendedConfig.icon;

  const etaEntries = Object.entries(data.eta).filter(([_, time]) => time !== undefined) as [TravelMode, number][];
  const maxEta = Math.max(...etaEntries.map(([_, time]) => time));

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
              Traffic & Routes
            </CardTitle>
            <CardDescription>Travel time comparison</CardDescription>
          </div>
          <Badge variant="default" className="ml-2 gap-1">
            <RecommendedIcon className="h-3 w-3" />
            Best: {recommendedConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {etaEntries.map(([mode, time]) => {
            const config = modeConfig[mode];
            const Icon = config.icon;
            const isRecommended = mode === data.recommend;
            const widthPercent = (time / maxEta) * 100;

            return (
              <div key={mode} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={isRecommended ? 'font-semibold' : ''}>{config.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={isRecommended ? 'font-semibold' : ''}>{time} min</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isRecommended ? 'bg-primary' : 'bg-muted-foreground'
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {data.notes && (
          <div className="pt-4 border-t">
            <p className="text-sm text-center text-foreground">{data.notes}</p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Click for route alternatives
        </p>
      </CardContent>
    </Card>
  );
}
