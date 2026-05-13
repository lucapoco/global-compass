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
  type: "earthquake" | "weather" | "country" | "alert" | "intelligence";
  title: string;
  description?: string;
  severity?: Severity;
  category?: IntelligenceCategory;
  url?: string;
}

export type ApiState = "idle" | "loading" | "success" | "error";

// ---------------- Intelligence ----------------
export type IntelligenceCategory =
  | "geopolitics"
  | "military"
  | "economy"
  | "technology"
  | "energy"
  | "climate"
  | "disaster"
  | "cyber"
  | "health"
  | "general";

export type IntelligenceSeverity = "low" | "medium" | "high" | "critical";

export interface IntelligenceItem {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  severity: IntelligenceSeverity;
  country?: string;
  source: string;
  url?: string;
  imageUrl?: string;
  publishedAt: string;
  latitude?: number;
  longitude?: number;
  isLive: boolean;
}

export interface SavedIntelligence {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string | null;
  country: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string | null;
}

export interface CountryRisk {
  country: string;
  score: number;
  label: Severity;
  factors: string[];
}
