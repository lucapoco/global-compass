/** Shared types for Global Pulse AI chat (client + server). */

export type AIChatRole = "user" | "assistant" | "system";

export type AIChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CompactIntelItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  severity: string;
  source: string;
  country?: string;
  location?: string;
  publishedAt: string;
  dataLabel: "LIVE" | "CACHED" | "DEMO";
  url?: string;
};

export type LLMChatContextPayload = {
  dataStatus: {
    news: string;
    earthquakes: string;
    supabase: string;
    overall: string;
  };
  newsSource: string;
  lastUpdated: string | null;
  intelligenceItems: CompactIntelItem[];
  criticalAlerts: CompactIntelItem[];
  earthquakes: CompactIntelItem[];
  countryRisks: { country: string; score: number; label: string; factors: string[] }[];
  savedDataSummary: {
    intelligenceCount: number;
    alertsCount: number;
    countriesCount: number;
  };
  apiHealth: {
    gnews: string;
    usgs: string;
    supabase: string;
    openWeather: string;
    map: string;
  };
};

export type AIChatRequestBody = {
  messages: AIChatTurn[];
  context: LLMChatContextPayload;
};

export type AIChatStatus =
  | "GEMINI LIVE"
  | "GEMINI FALLBACK MODEL"
  | "GEMINI TEMPORARILY BUSY"
  | "GEMINI ERROR"
  | "LOCAL FALLBACK";

/** Status shown in the context panel when Gemini is not configured. */
export type GeminiProviderStatus = AIChatStatus | "GEMINI NOT CONFIGURED";

export type AIChatSuccessResponse = {
  answer: string;
  provider: "Google Gemini";
  model: string;
  status: "GEMINI LIVE" | "GEMINI FALLBACK MODEL";
  usedContext: {
    newsItems: number;
    alerts: number;
    earthquakes: number;
    dataStatus: string;
  };
  retryCount?: number;
};

export type GeminiErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "BAD_REQUEST"
  | "RATE_LIMIT"
  | "HIGH_DEMAND"
  | "NETWORK"
  | "MALFORMED_RESPONSE"
  | "UNKNOWN";

export type AIProviderStatusResponse = {
  configured: boolean;
  provider: "Google Gemini";
  model: string;
  fallbackModel?: string;
  status: GeminiProviderStatus;
};

export type AIChatErrorResponse = {
  error: string;
  errorCode?: GeminiErrorCode;
  status?: AIChatStatus | "GEMINI NOT CONFIGURED";
  errorMessage?: string;
  retryCount?: number;
  fallbackAnswer?: string;
  configured: boolean;
};
