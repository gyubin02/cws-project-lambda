/**
 * 대기질 서비스
 */

import { AirKoreaAdapter } from '../adapters/airkorea.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { AirKoreaData, Coordinates } from '../types';

export class AirService {
  private airKoreaAdapter: AirKoreaAdapter;

  constructor() {
    this.airKoreaAdapter = new AirKoreaAdapter();
  }

  async getAirQualityData(coordinates: Coordinates, district?: string): Promise<AirKoreaData> {
    try {
      logger.debug({ 
        lat: coordinates.lat, 
        lon: coordinates.lon, 
        district 
      }, 'Fetching air quality data');

      const airData = await this.airKoreaAdapter.getAirQualityData(
        district,
        coordinates.lat,
        coordinates.lon
      );

      logger.info({
        pm10: airData.pm10,
        pm25: airData.pm25,
        grade: airData.grade,
      }, 'Air quality data retrieved successfully');

      return airData;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        coordinates,
        district,
      }, 'Failed to get air quality data');
      
      throw new UpstreamError('Air quality service unavailable', 'upstream_error');
    }
  }

  async getAirQualitySummary(coordinates: Coordinates, district?: string): Promise<string> {
    try {
      const airData = await this.getAirQualityData(coordinates, district);
      
      const gradeText = this.getGradeText(airData.grade);
      const pmText = `PM10: ${airData.pm10}㎍/㎥, PM2.5: ${airData.pm25}㎍/㎥`;
      
      return `${gradeText} (${pmText})`;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to generate air quality summary');
      return '대기질 정보를 가져올 수 없습니다.';
    }
  }

  private getGradeText(grade: 'good' | 'normal' | 'bad' | 'verybad'): string {
    const gradeMap: Record<string, string> = {
      'good': '좋음',
      'normal': '보통',
      'bad': '나쁨',
      'verybad': '매우 나쁨',
    };
    
    return gradeMap[grade] || '알 수 없음';
  }
}
