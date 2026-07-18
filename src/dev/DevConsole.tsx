/**
 * Consolă dezvoltator ascunsă — doar în DEV.
 * Activare: Ctrl+Shift+D · Konami · window.GCI.debug()
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Radio,
  X,
} from "lucide-react";
import { useAuth } from "@/auth";
import { useI18n } from "@/i18n";
import { useViewMode } from "@/context/ViewModeContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { getNewsDebugSnapshot, subscribeNewsDebug, type NewsDebugSnapshot } from "@/services/newsApi";
import { DataBadge } from "@/components/ui/DataBadge";

declare global {
  interface Window {
    GCI?: {
      debug: () => void;
      closeDebug: () => void;
    };
  }
}

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const OPEN_EVENT = "gci:open-dev-console";

function isDevBuild(): boolean {
  return !!import.meta.env.DEV;
}

export function DevConsoleHost() {
  if (!isDevBuild()) return null;
  return <DevConsoleInner />;
}

function DevConsoleInner() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const [size, setSize] = useState({ w: 420, h: 480 });
  const [news, setNews] = useState<NewsDebugSnapshot>(() => getNewsDebugSnapshot());
  const [perf, setPerf] = useState({ mem: "—", timing: "—" });
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [logs, setLogs] = useState<string[]>([]);
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);
  const konamiIdx = useRef(0);

  const { user, session, isAuthenticated, profile, loading: authLoading } = useAuth();
  const { locale } = useI18n();
  const { viewMode } = useViewMode();

  const openConsole = useCallback(() => setOpen(true), []);
  const closeConsole = useCallback(() => setOpen(false), []);

  // window.GCI.debug()
  useEffect(() => {
    window.GCI = {
      debug: () => openConsole(),
      closeDebug: () => closeConsole(),
    };
    return () => {
      delete window.GCI;
    };
  }, [openConsole, closeConsole]);

  // Custom event + keyboard + Konami
  useEffect(() => {
    const onOpen = () => openConsole();
    window.addEventListener(OPEN_EVENT, onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[konamiIdx.current]) {
        konamiIdx.current += 1;
        if (konamiIdx.current >= KONAMI.length) {
          konamiIdx.current = 0;
          openConsole();
        }
      } else {
        konamiIdx.current = key === KONAMI[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [openConsole]);

  // Live news debug + network + perf while open
  useEffect(() => {
    if (!open) return;
    const unsub = subscribeNewsDebug(setNews);
    const tick = window.setInterval(() => {
      setNews(getNewsDebugSnapshot());
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setPerf({
        mem: mem ? `${Math.round(mem.usedJSHeapSize / 1024 / 1024)} MB heap` : "n/a",
        timing: nav ? `${Math.round(nav.domContentLoadedEventEnd)} ms DCL` : "n/a",
      });
    }, 1000);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const pushLog = (level: string, args: unknown[]) => {
      const line = `[${level}] ${args.map((a) => {
        try {
          return typeof a === "string" ? a : JSON.stringify(a);
        } catch {
          return String(a);
        }
      }).join(" ")}`.slice(0, 240);
      setLogs((prev) => [line, ...prev].slice(0, 40));
    };

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = (...args: unknown[]) => { pushLog("log", args); origLog(...args); };
    console.warn = (...args: unknown[]) => { pushLog("warn", args); origWarn(...args); };
    console.error = (...args: unknown[]) => { pushLog("error", args); origError(...args); };

    return () => {
      unsub();
      window.clearInterval(tick);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, [open]);

  function onDragStart(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y };
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    setPos({
      x: Math.max(0, dragRef.current.sx + dx),
      y: Math.max(0, dragRef.current.sy + dy),
    });
  }
  function onDragEnd() {
    dragRef.current = null;
  }

  function onResizeStart(e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { ox: e.clientX, oy: e.clientY, sw: size.w, sh: size.h };
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    setSize({
      w: Math.max(320, resizeRef.current.sw + (e.clientX - resizeRef.current.ox)),
      h: Math.max(240, resizeRef.current.sh + (e.clientY - resizeRef.current.oy)),
    });
  }
  function onResizeEnd() {
    resizeRef.current = null;
  }

  if (!open) return null;

  const style: CSSProperties = {
    left: pos.x,
    top: pos.y,
    width: size.w,
    height: collapsed ? "auto" : size.h,
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: "Environment", value: import.meta.env.MODE },
    { label: "Supabase", value: isSupabaseConfigured() ? "configured" : "missing" },
    { label: "Auth", value: authLoading ? "loading" : isAuthenticated ? "signed-in" : "guest" },
    { label: "User", value: profile?.email ?? user?.email ?? "—" },
    { label: "User ID", value: user?.id?.slice(0, 8) ?? "—" },
    { label: "Session", value: session ? "active" : "none" },
    { label: "Language", value: locale },
    { label: "Theme", value: "light (app default)" },
    { label: "View mode", value: viewMode },
    { label: "Network", value: online ? "online" : "offline" },
    { label: "GNews status", value: news.currentStatus },
    { label: "GNews calls", value: String(news.sessionGNewsCalls) },
    { label: "Cache items", value: String(news.cacheItems) },
    { label: "Rate limit", value: news.rateLimitActive ? "active" : "clear" },
    { label: "Performance", value: `${perf.mem} · ${perf.timing}` },
    {
      label: "Feature flags",
      value: "auth=on · mc-sync=on · billing=off · email-notify=off",
    },
  ];

  return (
    <div
      className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-amber-300/60 bg-card shadow-xl"
      style={style}
      role="dialog"
      aria-label="Developer Console"
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-border bg-amber-50 px-3 py-2 active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-amber-700/70" aria-hidden="true" />
        <Radio className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
        <span className="flex-1 text-xs font-semibold text-amber-900">Developer Console</span>
        <DataBadge variant="neutral">DEV</DataBadge>
        <button
          type="button"
          className="rounded p-1 text-amber-800 hover:bg-amber-100"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="rounded p-1 text-amber-800 hover:bg-amber-100"
          onClick={closeConsole}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Ctrl+Shift+D · Konami · window.GCI.debug()
          </div>

          <div className="space-y-1.5">
            {rows.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-[120px_1fr] gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-[11px]"
              >
                <span className="font-medium text-muted-foreground">{r.label}</span>
                <span className="break-all font-mono text-foreground">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent console
            </div>
            <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border/60 bg-slate-950 p-2 font-mono text-[10px] text-slate-200">
              {logs.length === 0 ? (
                <div className="text-slate-500">No captured logs yet…</div>
              ) : (
                logs.map((line, i) => (
                  <div key={`${i}-${line.slice(0, 24)}`} className="break-all">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-amber-200/80"
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
