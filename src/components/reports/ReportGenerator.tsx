import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ReportType } from "@/types";
import { generateReport, type ReportGenerationResult } from "@/services/reportService";
import { buildNewsContext } from "@/services/aiNewsAnalystService";
import { Button } from "@/components/ui/button";
import { ReportDetails } from "./ReportDetails";
import { useT } from "@/i18n";

interface Props {
  onGenerated?: (result: ReportGenerationResult) => void;
}

export function ReportGenerator({ onGenerated }: Props) {
  const t = useT();
  const [type, setType] = useState<ReportType>("global_briefing");
  const [country, setCountry] = useState("Ukraine");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportGenerationResult | null>(null);

  const types = useMemo(
    () => [
      { id: "global_briefing" as const, label: t("app.pages.reports.custom.globalBriefing"), hint: t("app.pages.reports.custom.globalBriefingHint") },
      { id: "country" as const, label: t("app.pages.reports.custom.countryReport"), hint: t("app.pages.reports.custom.countryReportHint") },
      { id: "event" as const, label: t("app.pages.reports.custom.eventReport"), hint: t("app.pages.reports.custom.eventReportHint") },
    ],
    [t],
  );

  useEffect(() => {
    if (type !== "event") return;
    let cancelled = false;
    (async () => {
      setLoadingEvents(true);
      try {
        const ctx = await buildNewsContext();
        if (cancelled) return;
        const list = ctx.intelligenceItems.slice(0, 40).map((e) => ({ id: e.id, title: e.title }));
        setEvents(list);
        if (list.length) setEventId((prev) => prev || list[0]!.id);
      } catch {
        if (!cancelled) toast.error(t("app.toasts.reportEventsLoadFailed"));
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, t]);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);
    try {
      let generated: ReportGenerationResult;
      if (type === "country") {
        if (!country.trim()) {
          toast.error(t("app.toasts.reportEnterCountry"));
          setGenerating(false);
          return;
        }
        generated = await generateReport({ type: "country", country: country.trim() });
      } else if (type === "event") {
        if (!eventId) {
          toast.error(t("app.toasts.reportSelectEvent"));
          setGenerating(false);
          return;
        }
        generated = await generateReport({ type: "event", eventId });
      } else {
        generated = await generateReport({ type: "global_briefing" });
      }
      setResult(generated);
      onGenerated?.(generated);
      if (generated.aiStatus === "LOCAL FALLBACK") {
        toast.message(t("app.toasts.reportLocalFallback"));
      } else if (generated.aiStatus === "GEMINI FALLBACK MODEL") {
        toast.message(t("app.toasts.reportFallbackModel"));
      } else {
        toast.success(t("app.toasts.reportGenerated"));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("app.toasts.reportGenerationFailed"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {types.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setType(item.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              type === item.id
                ? "border-primary/50 bg-primary/10"
                : "border-border/50 bg-secondary/15 hover:border-primary/30"
            }`}
          >
            <div className="text-sm font-medium">{item.label}</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p>
          </button>
        ))}
      </div>

      {type === "country" ? (
        <div>
          <label className="text-xs text-muted-foreground">{t("app.pages.reports.custom.countryLabel")}</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
            placeholder={t("app.pages.reports.custom.countryPlaceholder")}
          />
        </div>
      ) : null}

      {type === "event" ? (
        <div>
          <label className="text-xs text-muted-foreground">{t("app.pages.reports.custom.selectHeadline")}</label>
          {loadingEvents ? (
            <p className="mt-1 text-xs text-muted-foreground">{t("app.pages.reports.custom.loadingEvents")}</p>
          ) : (
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title.slice(0, 80)}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      <Button type="button" onClick={() => void handleGenerate()} disabled={generating} className="w-full sm:w-auto">
        {generating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("app.pages.reports.custom.generating")}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" /> {t("app.pages.reports.custom.generate")}
          </>
        )}
      </Button>

      {result ? <ReportDetails report={result} aiStatus={result.aiStatus} showSave={false} /> : null}
    </div>
  );
}
