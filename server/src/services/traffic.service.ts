/**
 * 교통 서비스
 */

import { ExpresswayAdapter } from '../adapters/expressway.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { ExpresswayData, Coordinates } from '../types';

export class TrafficService {
  private expresswayAdapter: ExpresswayAdapter;

  constructor() {
    this.expresswayAdapter = new ExpresswayAdapter();
  }

  async getTrafficData(
    from: Coordinates,
    to: Coordinates,
    time?: Date
  ): Promise<ExpresswayData> {
    try {
      logger.debug({ 
        from: { lat: from.lat, lon: from.lon },
        to: { lat: to.lat, lon: to.lon },
        time: time?.toISOString()
      }, 'Fetching traffic data');

      const trafficData = await this.expresswayAdapter.getTrafficData(
        from.lat,
        from.lon,
        to.lat,
        to.lon,
        time
      );

      logger.info({
        eta: trafficData.eta,
        recommend: trafficData.recommend,
        notes: trafficData.notes,
      }, 'Traffic data retrieved successfully');

      return trafficData;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        from,
        to,
      }, 'Failed to get traffic data');
      
      throw new UpstreamError('Traffic service unavailable', 'upstream_error');
    }
  }

  async getTrafficSummary(
    from: Coordinates,
    to: Coordinates,
    time?: Date
  ): Promise<string> {
    try {
      const trafficData = await this.getTrafficData(from, to, time);
      
      const etaText = this.formatEtaText(trafficData.eta);
      const recommendText = this.getRecommendText(trafficData.recommend);
      const notesText = trafficData.notes ? ` (${trafficData.notes})` : '';
      
      return `${recommendText} 추천. ${etaText}${notesText}`;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to generate traffic summary');
      return '교통 정보를 가져올 수 없습니다.';
    }
  }

  private formatEtaText(eta: { car?: number; metro?: number; bike?: number }): string {
    const etaParts: string[] = [];
    
    if (eta.car !== undefined) {
      etaParts.push(`자동차 ${eta.car}분`);
    }
    if (eta.metro !== undefined) {
      etaParts.push(`지하철 ${eta.metro}분`);
    }
    if (eta.bike !== undefined) {
      etaParts.push(`자전거 ${eta.bike}분`);
    }
    
    return etaParts.join(', ');
  }

  private getRecommendText(recommend: 'car' | 'metro' | 'bike'): string {
    const recommendMap: Record<string, string> = {
      'car': '자동차',
      'metro': '지하철',
      'bike': '자전거',
    };
    
    return recommendMap[recommend] || '알 수 없음';
  }
}
