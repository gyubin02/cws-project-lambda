/**
 * AirKorea (한국환경공단) API 응답 타입들
 */

import type { AirBrief } from './briefing';

export type AirKoreaResponse = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      totalCount: number;
      items: Array<{
        stationName: string;
        mangName: string;
        dataTime: string;
        so2Value: string;
        coValue: string;
        o3Value: string;
        no2Value: string;
        pm10Value: string;
        pm25Value: string;
        khaiValue: string;
        khaiGrade: string;
        so2Grade: string;
        coGrade: string;
        o3Grade: string;
        no2Grade: string;
        pm10Grade: string;
        pm25Grade: string;
      }>;
    };
  };
};

export type AirKoreaData = AirBrief;

export type AirKoreaStation = {
  stationName: string;
  mangName: string;
  lat: number;
  lon: number;
};
