export interface UserLocationSetting {
  name: string;
  lat?: number;
  lon?: number;
  lastGeocodedAt?: string;
}

export interface UserSettings {
  defaultOrigin?: UserLocationSetting;
  defaultDestination?: UserLocationSetting;
  coordinateLock?: boolean;
}
