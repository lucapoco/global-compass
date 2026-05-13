import { useMemo, useState } from "react";
import { ExternalLink, Maximize2, PlayCircle, Tv2 } from "lucide-react";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { VIDEO_SOURCES, type VideoCategory, type VideoSource } from "@/data/videoSources";

const CATEGORIES: Array<{ k: VideoCategory | "all"; label: string }> = [
  { k: "all", label: "All" },
  { k: "news", label: "News" },
  { k: "space", label: "Space" },
  { k: "weather", label: "Weather" },
  { k: "city", label: "Cities" },
  { k: "disaster", label: "Disaster" },
  { k: "education", label: "Education" },
];

export function LiveVideoPanel() {
  const [selectedId, setSelectedId] = useState<string>(VIDEO_SOURCES[0]?.id ?? "");
  const [cat, setCat] = useState<VideoCategory | "all">("all");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const sources = useMemo(
    () => (cat === "all" ? VIDEO_SOURCES : VIDEO_SOURCES.filter((s) => s.category === cat)),
    [cat],
  );
  const selected: VideoSource | undefined = VIDEO_SOURCES.find((s) => s.id === selectedId) ?? sources[0];

  function pick(s: VideoSource) {
    if (s.id === selectedId) return;
    setSelectedId(s.id);
    setIframeLoaded(false);
    setIframeError(false);
  }

  function openFullscreen() {
    if (!selected) return;
    window.open(selected.sourceUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title="Live Video Monitor"
        subtitle="Public situational awareness feeds — only the selected stream loads"
        right={<Tv2 className="h-4 w-4 text-cyan-glow" />}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.k}
            onClick={() => setCat(c.k)}
            className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
              cat === c.k
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main player */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-black">
            {selected ? (
              <>
                {!iframeLoaded && !iframeError && (
                  <div className="absolute inset-0 flex animate-pulse items-center justify-center text-xs text-muted-foreground">
                    Loading {selected.provider}…
                  </div>
                )}
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="text-xs text-muted-foreground">Embed blocked by provider.</div>
                    <a href={selected.sourceUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                    </a>
                  </div>
                ) : (
                  <iframe
                    key={selected.id}
                    src={selected.embedUrl}
                    title={selected.title}
                    loading="lazy"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setIframeError(true)}
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No source selected
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {selected.isLive && <DataBadge variant="live">Live</DataBadge>}
                  <DataBadge variant="source">{selected.provider}</DataBadge>
                  <span className="truncate text-[11px] text-muted-foreground">{selected.region} · {selected.category}</span>
                </div>
                <div className="mt-1 truncate text-sm font-medium">{selected.title}</div>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{selected.description}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={openFullscreen} title="Open in new tab"
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1.5 text-[11px] hover:text-primary">
                  <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
                </button>
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-[11px] text-primary">
                  <ExternalLink className="h-3.5 w-3.5" /> Open source
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Source list */}
        <div className="max-h-[420px] space-y-1.5 overflow-auto pr-1">
          {sources.map((s) => {
            const active = s.id === selected?.id;
            return (
              <button
                key={s.id}
                onClick={() => pick(s)}
                className={`group w-full rounded-md border p-2 text-left transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/50 bg-secondary/20 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <PlayCircle className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{s.title}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{s.region} · {s.provider}</div>
                  </div>
                  {s.isLive && <span className="ml-auto rounded-full bg-emerald-glow/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-glow">Live</span>}
                </div>
              </button>
            );
          })}
          {sources.length === 0 && <div className="rounded-md border border-dashed border-border/50 p-3 text-center text-[11px] text-muted-foreground">No sources in this category.</div>}
        </div>
      </div>

      {import.meta.env.DEV && (
        <div className="mt-3 rounded-md border border-dashed border-border/50 bg-secondary/10 px-2 py-1 text-[10px] text-muted-foreground">
          Video debug — selected: <span className="text-foreground">{selected?.id ?? "—"}</span> · iframe loaded:{" "}
          <span className="text-foreground">{iframeLoaded ? "yes" : iframeError ? "error" : "no"}</span>
        </div>
      )}
    </div>
  );
}
