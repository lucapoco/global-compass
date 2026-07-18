import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { GlobalEvent, GlobalEventCategory, GlobalEventProvider, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { eventEngine } from "@/domain/services/event-engine";
import { filterEvents, type EventFilterOptions } from "@/domain/services/event-engine/filters/eventFilters";
import { searchEvents } from "@/domain/services/event-engine/search/searchEvents";
import type { ProviderStatusSnapshot } from "@/domain/services/event-engine/providers";
import {
  clusterEvents,
  DEFAULT_TIMELINE_RANGE,
  filterByTimeline,
  type EventCluster,
  type HeatmapWeightMode,
  type MapVisualizationMode,
  type MapViewport,
  type TimelineRange,
} from "@/domain/services/map-engine";
import { collectGlobalMapEvents } from "@/services/mapDataService";
import { DEFAULT_ENABLED_LAYER_GROUPS, filterEventsByLayerGroups, providerIdsForLayerGroups } from "@/utils/filterEvents";

const DEFAULT_VIEWPORT: MapViewport = { center: [10, 20], zoom: 1.6 };

export interface MapEngineFilterState extends EventFilterOptions {
  searchQuery: string;
}

const EMPTY_FILTER_STATE: MapEngineFilterState = { searchQuery: "" };

/**
 * The single "MapEngine" the map page (and any future map surface) should drive.
 * Owns loading, timeline windowing, filtering, search, clustering and selection so
 * the UI never has to touch raw events or manipulate markers directly — components
 * only render whatever `visibleEvents` / `clusters` / `selectedEvent` this hook hands
 * them.
 */
export function useMapEngine() {
  const [allEvents, setAllEvents] = useState<GlobalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusSnapshot[]>([]);

  const [filterState, setFilterState] = useState<MapEngineFilterState>(EMPTY_FILTER_STATE);
  const [timeline, setTimeline] = useState<TimelineRange>(DEFAULT_TIMELINE_RANGE);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT);
  const [visualizationMode, setVisualizationMode] = useState<MapVisualizationMode>("markers");
  const [heatmapWeightMode, setHeatmapWeightMode] = useState<HeatmapWeightMode>("density");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [enabledLayerGroups, setEnabledLayerGroups] = useState<string[]>(DEFAULT_ENABLED_LAYER_GROUPS);
  const [layerOpacity, setLayerOpacityState] = useState<Record<string, number>>({});

  // Only fetch providers required by the layers currently switched on —
  // toggling on a new layer for the first time triggers exactly one network
  // round-trip for its provider(s); everything else is served from that
  // provider's own TTL cache (Performance: avoid unnecessary requests).
  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const providerIds = providerIdsForLayerGroups(enabledLayerGroups);
      const events = await collectGlobalMapEvents(force, providerIds);
      setAllEvents(events);
      setProviderStatus(eventEngine.getProviderStatus());
      setLastUpdated(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load map data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [enabledLayerGroups]);

  useEffect(() => {
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy layer loading: whenever the enabled layer set changes (after the
  // initial mount), re-run the (non-forced) load so newly-enabled layers
  // fetch their provider for the first time — cached providers resolve instantly.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledLayerGroups]);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayerOpacityState((prev) => ({ ...prev, [layerId]: Math.min(1, Math.max(0, opacity)) }));
  }, []);

  const getLayerOpacity = useCallback((layerId: string) => layerOpacity[layerId] ?? 1, [layerOpacity]);

  /** Timeline -> layer groups (provider + category/subCategory) -> shared filters -> search. */
  const filteredEvents = useMemo(() => {
    const inWindow = filterByTimeline(allEvents, timeline);
    const layered = filterEventsByLayerGroups(inWindow, enabledLayerGroups);
    const filtered = filterEvents(layered, filterState);
    return filterState.searchQuery.trim() ? searchEvents(filtered, filterState.searchQuery) : filtered;
  }, [allEvents, timeline, filterState, enabledLayerGroups]);

  const clusters: EventCluster[] = useMemo(
    () => clusterEvents(filteredEvents, viewport.zoom),
    [filteredEvents, viewport.zoom],
  );

  const selectedEvent = useMemo(
    () => (selectedEventId ? allEvents.find((e) => e.id === selectedEventId) ?? null : null),
    [allEvents, selectedEventId],
  );

  const relatedEvents = useMemo(
    () => (selectedEventId ? eventEngine.getRelated(allEvents, selectedEventId) : []),
    [allEvents, selectedEventId],
  );

  const select = useCallback((id: string | null) => setSelectedEventId(id), []);

  const setCategories = useCallback((categories: GlobalEventCategory[]) => {
    setFilterState((s) => ({ ...s, categories: categories.length ? categories : undefined }));
  }, []);

  const toggleCategory = useCallback((category: GlobalEventCategory) => {
    setFilterState((s) => {
      const current = new Set(s.categories ?? []);
      if (current.has(category)) current.delete(category);
      else current.add(category);
      return { ...s, categories: current.size ? [...current] : undefined };
    });
  }, []);

  const setSeverities = useCallback((severities: GlobalEventSeverity[]) => {
    setFilterState((s) => ({ ...s, severities: severities.length ? severities : undefined }));
  }, []);

  const toggleSeverity = useCallback((severity: GlobalEventSeverity) => {
    setFilterState((s) => {
      const current = new Set(s.severities ?? []);
      if (current.has(severity)) current.delete(severity);
      else current.add(severity);
      return { ...s, severities: current.size ? [...current] : undefined };
    });
  }, []);

  const setProviders = useCallback((providers: GlobalEventProvider[]) => {
    setFilterState((s) => ({ ...s, providers: providers.length ? providers : undefined }));
  }, []);

  const setCountries = useCallback((countries: string[]) => {
    setFilterState((s) => ({ ...s, countries: countries.length ? countries : undefined }));
  }, []);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setFilterState((s) => ({ ...s, searchQuery }));
  }, []);

  const setMinRiskScore = useCallback((minRiskScore: number | undefined) => {
    setFilterState((s) => ({ ...s, minRiskScore }));
  }, []);

  const setMinConfidence = useCallback((minConfidence: number | undefined) => {
    setFilterState((s) => ({ ...s, minConfidence }));
  }, []);

  const toggleVerifiedOnly = useCallback(() => {
    setFilterState((s) => ({ ...s, verifiedOnly: !s.verifiedOnly }));
  }, []);

  const toggleLiveOnly = useCallback(() => {
    setFilterState((s) => ({ ...s, liveOnly: !s.liveOnly }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(EMPTY_FILTER_STATE);
    setTimeline(DEFAULT_TIMELINE_RANGE);
    setSelectedEventId(null);
    setEnabledLayerGroups(DEFAULT_ENABLED_LAYER_GROUPS);
  }, []);

  const toggleLayerGroup = useCallback((groupId: string) => {
    setEnabledLayerGroups((prev) => (prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]));
  }, []);

  const enableAllLayerGroups = useCallback(() => setEnabledLayerGroups(DEFAULT_ENABLED_LAYER_GROUPS), []);

  const flyTo = useCallback((lng: number, lat: number, zoom = 4) => {
    setViewport({ center: [lng, lat], zoom });
  }, []);

  const resetView = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
    setSelectedEventId(null);
  }, []);

  const categoryCounts = useMemo(() => {
    const inWindow = filterByTimeline(allEvents, timeline);
    const layered = filterEventsByLayerGroups(inWindow, enabledLayerGroups);
    const base = filterEvents(layered, { ...filterState, categories: undefined });
    const counts = new Map<GlobalEventCategory, number>();
    for (const e of base) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return counts;
  }, [allEvents, timeline, filterState, enabledLayerGroups]);

  const showRiskIndexLayer = enabledLayerGroups.includes("risk_index");

  return {
    // data
    allEvents,
    filteredEvents,
    clusters,
    categoryCounts,
    loading,
    error,
    lastUpdated,
    providerStatus,
    refresh,

    // filters / search / timeline
    filterState,
    setFilterState,
    setCategories,
    toggleCategory,
    setSeverities,
    toggleSeverity,
    setProviders,
    setCountries,
    setSearchQuery,
    setMinRiskScore,
    setMinConfidence,
    toggleVerifiedOnly,
    toggleLiveOnly,
    clearFilters,
    timeline,
    setTimeline,
    enabledLayerGroups,
    toggleLayerGroup,
    enableAllLayerGroups,
    layerOpacity,
    setLayerOpacity,
    getLayerOpacity,
    showRiskIndexLayer,

    // viewport
    viewport,
    setViewport,
    flyTo,
    resetView,

    // visualization
    visualizationMode,
    setVisualizationMode,
    heatmapWeightMode,
    setHeatmapWeightMode,

    // selection / replay
    selectedEventId,
    selectedEvent,
    relatedEvents,
    select,
    replayActive,
    setReplayActive,
  };
}

export type UseMapEngineResult = ReturnType<typeof useMapEngine>;
