/**
 * Expressway (고속도로) API 응답 타입들
 */

export type ExpresswayResponse = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: Array<{
          routeId: string;
          routeName: string;
          sectionId: string;
          sectionName: string;
          avgSpeed: number;
          congestion: number;
          roadWork: string;
          incident: string;
          weather: string;
        }>;
      };
    };
  };
};

export type ExpresswayData = {
  eta: {
    car?: number;
    metro?: number;
    bike?: number;
  };
  recommend: 'car' | 'metro' | 'bike';
  notes?: string;
};

export type ExpresswayRoute = {
  routeId: string;
  routeName: string;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    distance: number; // km
    avgSpeed: number; // km/h
    congestion: number; // 0-4
    roadWork: boolean;
    incident: boolean;
  }>;
};

export type ExpresswayTrafficInfo = {
  routeId: string;
  sectionId: string;
  avgSpeed: number;
  congestion: number;
  roadWork: string;
  incident: string;
  weather: string;
};
