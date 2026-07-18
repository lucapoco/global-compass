/**
 * CommandVideoPlayer — Premium live video hero for the Operations Dashboard.
 *
 * Design principles:
 *  • Video is the STAR — full aspect-ratio container, no chrome clutter
 *  • Auto-loads Sky News immediately on mount (embed URL has autoplay=1)
 *  • Overlaid LIVE badge pulses when stream is active
 *  • Compact channel quick-picker below the player
 *  • Architecture-ready for future channels: just add to VIDEO_SOURCES
 *
 * Current curated channels shown in the picker:
 *   News:    Sky News · DW · Al Jazeera
 *   World:   ISS / NASA
 *   Weather: NOAA GOES-East
 *   Cities:  Times Square · Shibuya
 *   Event:   Iceland Volcano
 *
 * Adding a new channel requires only editing src/data/videoSources.ts.
 */
import { useCallback, useState } from "react";
import {
  Radio, Maximize2, ExternalLink, WifiOff, Monitor,
} from "lucide-react";
import { VIDEO_SOURCES, type VideoSource, type VideoCategory } from "@/data/videoSources";
import { useT } from "@/i18n";

const CV = "app.pages.dashboard.commandVideo";

/* ── Channel groups for the picker ─────────────────────────────────────── */

const PICKER_GROUPS: Array<{ labelKey: string; cat: VideoCategory | null }> = [
  { labelKey: `${CV}.news`,    cat: "news"      },
  { labelKey: `${CV}.space`,   cat: "space"     },
  { labelKey: `${CV}.weather`, cat: "weather"   },
  { labelKey: `${CV}.cities`,  cat: "city"      },
  { labelKey: `${CV}.events`,  cat: "disaster"  },
];

function getSourcesByCategory(cat: VideoCategory | null): VideoSource[] {
  return cat === null ? VIDEO_SOURCES : VIDEO_SOURCES.filter((s) => s.category === cat);
}

/* ── Sky News is the default "situational awareness" channel ─────────────── */
const DEFAULT_SOURCE: VideoSource =
  VIDEO_SOURCES.find((s) => s.id === "skynews") ?? VIDEO_SOURCES[0];

/* ── Connection status badge ─────────────────────────────────────────────── */

function StatusBadge({
  state,
  provider,
  t,
}: {
  state: "loading" | "live" | "error";
  provider: string;
  t: ReturnType<typeof useT>;
}) {
  const statusLabel =
    state === "live"
      ? t(`${CV}.live`)
      : state === "loading"
      ? t(`${CV}.loading`)
      : t(`${CV}.offline`);

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-sm">
      {state === "live" && (
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      )}
      {state === "loading" && (
        <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-400" />
      )}
      {state === "error" && (
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rose-600" />
      )}
      <span className="text-[10px] font-bold tracking-widest text-white/90">
        {statusLabel}
      </span>
      {state === "live" && (
        <span className="text-[10px] text-white/50">·</span>
      )}
      {state === "live" && (
        <span className="text-[10px] font-medium text-white/70">{provider}</span>
      )}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface Props {
  /** Initial source override. Defaults to Sky News. */
  defaultId?: string;
}

export function CommandVideoPlayer({ defaultId }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<VideoSource>(
    () => VIDEO_SOURCES.find((s) => s.id === defaultId) ?? DEFAULT_SOURCE,
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [activeCat, setActiveCat] = useState<VideoCategory | null>("news");
  const [showControls, setShowControls] = useState(false);

  const channelList = getSourcesByCategory(activeCat);
  const connectionState: "loading" | "live" | "error" = error
    ? "error"
    : loaded
    ? "live"
    : "loading";

  const activeGroup = PICKER_GROUPS.find((g) => g.cat === activeCat);
  const activeCatLabel = activeGroup ? t(activeGroup.labelKey) : activeCat ?? "all";

  const switchTo = useCallback((src: VideoSource) => {
    if (src.id === selected.id) return;
    setSelected(src);
    setLoaded(false);
    setError(false);
    setShowControls(false);
  }, [selected.id]);

  return (
    <div className="glass-card overflow-hidden" aria-label={t(`${CV}.aria`)}>
      {/* ── Video stage ── */}
      <div
        className="relative w-full bg-black"
        style={{ aspectRatio: "16 / 9" }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* LIVE badge — top left */}
        <div
          className={[
            "absolute left-3 top-3 z-20 transition-opacity duration-300",
            showControls || !loaded ? "opacity-100" : "opacity-60",
          ].join(" ")}
        >
          <StatusBadge state={connectionState} provider={selected.provider} t={t} />
        </div>

        {/* Source name + fullscreen — top right, fade on idle */}
        <div
          className={[
            "absolute right-3 top-3 z-20 flex items-center gap-1.5 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <span className="rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white/70 backdrop-blur-sm">
            {selected.region}
          </span>
          <button
            type="button"
            onClick={() => window.open(selected.sourceUrl, "_blank", "noopener,noreferrer")}
            className="rounded-md border border-white/10 bg-black/60 p-1.5 text-white/60 backdrop-blur-sm hover:text-white transition-colors"
            title={t(`${CV}.openNewTab`)}
            aria-label={t(`${CV}.openStreamAria`)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Iframe — auto-loads, autoplay handled by YouTube ?autoplay=1 param */}
        {!error ? (
          <iframe
            key={selected.id}
            src={selected.embedUrl}
            title={selected.title}
            allow="accelerometer; encrypted-media; picture-in-picture; autoplay"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className="absolute inset-0 h-full w-full border-0"
            aria-label={`Live stream: ${selected.title}`}
          />
        ) : (
          /* Error state */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6">
            <WifiOff className="h-10 w-10 text-rose-400" aria-hidden="true" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/90">{t(`${CV}.streamUnavailable`)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(`${CV}.embedBlocked`, { provider: selected.provider })}
              </p>
            </div>
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20 transition-colors"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t(`${CV}.openProvider`, { provider: selected.provider })}
            </a>
          </div>
        )}

        {/* Loading overlay — fades when iframe fires onLoad */}
        {!loaded && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 pointer-events-none">
            <div className="relative">
              <Radio
                className="h-10 w-10 text-primary animate-pulse"
                aria-hidden="true"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-14 w-14 animate-ping rounded-full border border-primary/30 opacity-50" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`${CV}.connecting`, { provider: selected.provider })}
            </p>
          </div>
        )}

        {/* Bottom gradient for caption legibility */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent"
          aria-hidden="true"
        />

        {/* Stream title — bottom left, visible on hover */}
        <div
          className={[
            "absolute bottom-3 left-3 z-20 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <p className="text-xs font-semibold text-white drop-shadow-lg line-clamp-1">
            {selected.title}
          </p>
        </div>
      </div>

      {/* ── Channel controls ─────────────────────────────────────────── */}
      <div className="border-t border-border/25 bg-black/25 px-4 py-3">
        {/* Category tabs */}
        <div className="mb-2.5 flex min-w-0 items-center gap-2">
          <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <div
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain"
            role="tablist"
            aria-label={t(`${CV}.categoriesAria`)}
          >
            {PICKER_GROUPS.map((g) => (
              <button
                key={g.cat ?? "all"}
                type="button"
                role="tab"
                aria-selected={activeCat === g.cat}
                onClick={() => setActiveCat(g.cat)}
                className={[
                  "flex-shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  activeCat === g.cat
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60",
                ].join(" ")}
              >
                {t(g.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Channel buttons */}
        <div
          className="flex flex-wrap gap-1.5"
          role="tabpanel"
          aria-label={t(`${CV}.channelsAria`, { cat: activeCatLabel })}
        >
          {channelList.map((ch) => {
            const isActive = ch.id === selected.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => switchTo(ch)}
                className={[
                  "group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/40 bg-transparent text-muted-foreground hover:border-border/70 hover:text-foreground",
                ].join(" ")}
                title={ch.title}
                aria-pressed={isActive}
                aria-label={t(`${CV}.switchTo`, { provider: ch.provider })}
              >
                {ch.isLive && (
                  <span
                    className={[
                      "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      isActive ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                )}
                {ch.provider}
              </button>
            );
          })}

          {channelList.length === 0 && (
            <span className="text-xs text-muted-foreground/60 py-1">
              {t(`${CV}.emptyCategory`)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
