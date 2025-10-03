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
    label: 'Car', 
    icon: Car, 
    color: 'text-blue-500',
    pros: ['Direct route', 'Flexible schedule', 'Comfortable'],
    cons: ['Traffic congestion', 'Parking costs', 'Higher emissions'],
  },
  metro: { 
    label: 'Metro', 
    icon: Train, 
    color: 'text-green-500',
    pros: ['No traffic delays', 'Predictable timing', 'Eco-friendly'],
    cons: ['Walking to/from stations', 'May require transfers', 'Fixed schedule'],
  },
  bike: { 
    label: 'Bike', 
    icon: Bike, 
    color: 'text-orange-500',
    pros: ['Flexible route', 'Good exercise', 'Zero emissions'],
    cons: ['Weather dependent', 'Physical effort', 'Limited cargo'],
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
            Route Comparison
          </DialogTitle>
          <DialogDescription>
            Detailed analysis of travel options
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
              Travel Time Comparison
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
                          <Badge variant="default" className="ml-2">Recommended</Badge>
                        )}
                        {isFastest && (
                          <Badge variant="outline" className="ml-2">Fastest</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-lg">{time} min</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Detailed Analysis</h3>
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
                        <div className="font-medium text-success mb-1">Pros:</div>
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
                        <div className="font-medium text-destructive mb-1">Cons:</div>
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
