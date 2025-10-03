/**
 * 날씨 서비스
 */

import { KMAAdapter } from '../adapters/kma.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { KMAWeatherData, Coordinates } from '../types';

export class WeatherService {
  private kmaAdapter: KMAAdapter;

  constructor() {
    this.kmaAdapter = new KMAAdapter();
  }

  async getWeatherData(coordinates: Coordinates, time?: Date): Promise<KMAWeatherData> {
    try {
      logger.debug({ 
        lat: coordinates.lat, 
        lon: coordinates.lon, 
        time: time?.toISOString() 
      }, 'Fetching weather data');

      const weatherData = await this.kmaAdapter.getWeatherData(
        coordinates.lat,
        coordinates.lon,
        time
      );

      logger.info({
        temp: weatherData.temp,
        condition: weatherData.condition,
        pop: weatherData.pop,
      }, 'Weather data retrieved successfully');

      return weatherData;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        coordinates,
      }, 'Failed to get weather data');
      
      throw new UpstreamError('Weather service unavailable', 'upstream_error');
    }
  }

  async getWeatherSummary(coordinates: Coordinates, time?: Date): Promise<string> {
    try {
      const weatherData = await this.getWeatherData(coordinates, time);
      
      const conditionText = this.getConditionText(weatherData.condition);
      const popText = this.getPopText(weatherData.pop);
      const tempText = `${Math.round(weatherData.temp)}°C (체감 ${Math.round(weatherData.feels_like)}°C)`;
      
      return `${conditionText}, ${tempText}. ${popText}`;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to generate weather summary');
      return '날씨 정보를 가져올 수 없습니다.';
    }
  }

  private getConditionText(condition: string): string {
    const conditionMap: Record<string, string> = {
      'clear': '맑음',
      'cloudy': '구름많음',
      'rain': '비',
      'snow': '눈',
      'storm': '소나기',
      'fog': '안개',
    };
    
    return conditionMap[condition] || '알 수 없음';
  }

  private getPopText(pop: number): string {
    if (pop === 0) {
      return '강수확률 0%';
    } else if (pop < 0.3) {
      return `강수확률 ${Math.round(pop * 100)}% (낮음)`;
    } else if (pop < 0.7) {
      return `강수확률 ${Math.round(pop * 100)}% (보통)`;
    } else {
      return `강수확률 ${Math.round(pop * 100)}% (높음)`;
    }
  }
}
