/**
 * LiveMediaWidget — Live news stream embed (light theme shell).
 */
import { useState, useCallback } from "react";
import { ExternalLink, WifiOff, Monitor } from "lucide-react";
import { VIDEO_SOURCES, type VideoSource } from "@/data/videoSources";
import { useT } from "@/i18n";

interface Props {
  presentationMode?: boolean;
}

const DEFAULT_SOURCE: VideoSource =
  VIDEO_SOURCES.find((s) => s.id === "skynews") ?? VIDEO_SOURCES[0];

const NEWS_SOURCES = VIDEO_SOURCES.filter((s) => s.category === "news");

type StreamState = "loading" | "live" | "error";

export function LiveMediaWidget({ presentationMode }: Props) {
  const t = useT();
  const [source, setSource] = useState<VideoSource>(DEFAULT_SOURCE);
  const [streamState, setStreamState] = useState<StreamState>("loading");

  const embedUrl = `${source.embedUrl}?autoplay=1&mute=1&rel=0&modestbranding=1`;
  const handleLoad = useCallback(() => setStreamState("live"), []);
  const handleError = useCallback(() => setStreamState("error"), []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#E2E8F0] bg-white px-4 py-3">
        <span className="live-dot shrink-0" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate font-semibold tracking-tight text-[#0F172A] ${presentationMode ? "text-sm" : "text-xs"}`}>
          {t("app.pages.missionControl.widgets.liveMedia")}
        </span>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">{t("app.pages.missionControl.live")}</span>
        </div>
        {streamState === "error" && <WifiOff className="h-3 w-3 shrink-0 text-red-500" />}
      </div>

      <div className="relative min-h-0 flex-1 bg-[#0F172A]">
        {streamState === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]">
            <Monitor className="h-8 w-8 text-[#94A3B8]" />
            <span className="text-xs text-[#64748B]">{t("app.pages.missionControl.widgets.streamUnavailable")}</span>
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
            >
              <ExternalLink className="h-3 w-3" />
              {t("app.pages.missionControl.widgets.openInNewTab")}
            </a>
          </div>
        ) : (
          <iframe
            key={source.id}
            src={embedUrl}
            title={source.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
        {streamState === "live" && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-sm">
            <span className="text-[10px] font-medium text-white/90">{source.title}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
        {NEWS_SOURCES.slice(0, 5).map((s) => (
          <button
            key={s.id}
            onClick={() => { setSource(s); setStreamState("loading"); }}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
              source.id === s.id
                ? "border-primary/30 bg-primary/10 font-medium text-primary"
                : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-primary/25 hover:text-primary"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
