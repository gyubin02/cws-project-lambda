export type Coordinates = {
  lat: number;
  lon: number;
  label?: string;
  district?: string;
};

export type WorkLocation = Omit<Coordinates, "district">;

export type UserProfile = {
  user_id: string;
  home: Coordinates;
  work?: WorkLocation;
};
