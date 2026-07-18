/**
 * Mission Control — Type Definitions
 *
 * Mission Control is the primary operational command interface of Global Pulse.
 * All types used by widgets, hooks, and layout are defined here.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { GlobalStabilityIndex } from "@/domain/decision/models/StabilityIndex";
import type { IntelligenceSummary } from "@/domain/decision/summary/summaryEngine";

// ─── Widget descriptor ────────────────────────────────────────────────────────

export type WidgetId =
  | "live_media"
  | "threat_panel"
  | "critical_events"
  | "ai_briefing"
  | "regional_activity"
  | "earthquake_activity"
  | "system_status"
  | "knowledge_graph_preview"
  | "timeline_preview";

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  visible: boolean;
  refreshIntervalMs: number;
}

// ─── Mission Control state ────────────────────────────────────────────────────

export type MCLoadState = "idle" | "loading" | "loaded" | "error";

export interface MissionControlState {
  events: GlobalEvent[];
  criticalEvents: GlobalEvent[];
  recentEvents: GlobalEvent[];         // last 24h
  gsi: GlobalStabilityIndex | null;
  summary: IntelligenceSummary | null;
  providerStatus: ProviderStatus[];
  lastRefreshed: Date | null;
  nextRefreshIn: number;               // seconds
  loadState: MCLoadState;
  error: string | null;
  totalProcessed: number;
  countriesCovered: number;
}

// ─── Provider health ──────────────────────────────────────────────────────────

export type ProviderHealthStatus = "online" | "degraded" | "offline" | "unknown";

export interface ProviderStatus {
  id: string;
  label: string;
  status: ProviderHealthStatus;
  lastEventAt: string | null;
  eventCount: number;
}

// ─── Presentation mode ────────────────────────────────────────────────────────

export interface PresentationConfig {
  enabled: boolean;
  scale: number;     // font scale multiplier
  hideControls: boolean;
  highContrast: boolean;
  fullscreen: boolean;
}

export const DEFAULT_PRESENTATION: PresentationConfig = {
  enabled: false,
  scale: 1,
  hideControls: false,
  highContrast: false,
  fullscreen: false,
};

// ─── Auto refresh ─────────────────────────────────────────────────────────────

export const REFRESH_INTERVALS = {
  fast:   3 * 60_000,   // 3 min — critical events
  normal: 5 * 60_000,   // 5 min — stability, news
  slow:   10 * 60_000,  // 10 min — earthquake, weather
  ai:     15 * 60_000,  // 15 min — AI briefing (expensive)
} as const;
