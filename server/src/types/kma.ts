/**
 * KMA (기상청) API 응답 타입들
 */

import type { WeatherBrief } from './briefing';

export type KMAUltraSrtNcstResponse = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      dataType: string;
      items: {
        item: Array<{
          baseDate: string;
          baseTime: string;
          category: string;
          nx: number;
          ny: number;
          obsrValue: string;
        }>;
      };
    };
  };
};

export type KMAUltraSrtFcstResponse = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      dataType: string;
      items: {
        item: Array<{
          baseDate: string;
          baseTime: string;
          category: string;
          fcstDate: string;
          fcstTime: string;
          fcstValue: string;
          nx: number;
          ny: number;
        }>;
      };
    };
  };
};

export type KMAVilageFcstResponse = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      dataType: string;
      items: {
        item: Array<{
          baseDate: string;
          baseTime: string;
          category: string;
          fcstDate: string;
          fcstTime: string;
          fcstValue: string;
          nx: number;
          ny: number;
        }>;
      };
    };
  };
};

export type KMAWeatherData = WeatherBrief;

export type KMAGridCoordinates = {
  nx: number;
  ny: number;
};
