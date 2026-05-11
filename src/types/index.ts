export interface Country {
  name: { common: string; official: string };
  cca2?: string;
  cca3?: string;
  capital?: string[];
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  languages?: Record<string, string>;
  currencies?: Record<string, { name: string; symbol?: string }>;
  timezones?: string[];
  borders?: string[];
  flags?: { png?: string; svg?: string };
  maps?: { googleMaps?: string };
  latlng?: [number, number];
}

export interface Earthquake {
  id: string;
  place: string;
  magnitude: number;
  time: number;
  depth: number;
  longitude: number;
  latitude: number;
  url?: string;
}

export interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  isDemo?: boolean;
}

export type Severity = "Low" | "Medium" | "High" | "Critical";

export interface AlertItem {
  id: string;
  title: string;
  type: string;
  severity: Severity;
  location?: string;
  description?: string;
  source: string;
  time?: number;
  lat?: number;
  lng?: number;
}

export interface SavedCountry {
  id: string;
  country_name: string;
  country_code: string | null;
  capital: string | null;
  region: string | null;
  population: number | null;
  flag_url: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface SavedAlert {
  id: string;
  title: string;
  type: string;
  severity: string;
  location: string | null;
  description: string | null;
  source: string | null;
  created_at: string | null;
}

export interface FeedbackMessage {
  id: string;
  name: string | null;
  message: string;
  rating: number | null;
  created_at: string | null;
}

export interface ProjectLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string | null;
}

export interface MapEvent {
  id: string;
  lat: number;
  lng: number;
  type: "earthquake" | "weather" | "country" | "alert";
  title: string;
  description?: string;
  severity?: Severity;
}

export type ApiState = "idle" | "loading" | "success" | "error";
