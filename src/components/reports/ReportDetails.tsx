import type { ReportGenerationResult } from "@/services/reportService";
import type { GeneratedReport } from "@/types";
import type { AIChatStatus } from "@/lib/aiChatTypes";
import { DataBadge } from "@/components/ui/DataBadge";
import { ReportExportButton } from "./ReportExportButton";
import { reportTypeLabel } from "@/services/reportService";
import { useT } from "@/i18n";

function statusBadge(status?: AIChatStatus | string) {
  if (!status) return null;
  if (status === "GEMINI LIVE")
    return <DataBadge variant="live">GEMINI LIVE</DataBadge>;
  if (status === "GEMINI FALLBACK MODEL")
    return <DataBadge variant="live">GEMINI FALLBACK MODEL</DataBadge>;
  if (status === "LOCAL FALLBACK" || status === "GEMINI TEMPORARILY BUSY")
    return <DataBadge variant="neutral">{status}</DataBadge>;
  if (status === "GEMINI ERROR") return <DataBadge variant="error">GEMINI ERROR</DataBadge>;
  return <DataBadge variant="neutral">{status}</DataBadge>;
}

function renderMarkdownSimple(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="mb-3 mt-4 text-xl font-semibold first:mt-0">
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mb-2 mt-4 text-base font-semibold text-foreground">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed text-foreground/90">
          {line.slice(2).replace(/\*\*([^*]+)\*\*/g, "$1")}
        </li>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return (
      <p key={i} className="text-sm leading-relaxed text-foreground/90">
        {line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/_([^_]+)_/g, "$1")}
      </p>
    );
  });
}

type Props = {
  report: ReportGenerationResult | GeneratedReport;
  aiStatus?: AIChatStatus | string;
  onSave?: () => void;
  saving?: boolean;
  showSave?: boolean;
};

export function ReportDetails({ report, aiStatus, onSave, saving, showSave }: Props) {
  const t = useT();
  const content = "content" in report ? report.content : "";
  const title = report.title;
  const dataStatus = "data_status" in report ? report.data_status : (report as ReportGenerationResult).dataStatus;
  const type = report.type;
  const status = aiStatus ?? ("aiStatus" in report ? (report as ReportGenerationResult).aiStatus : undefined);

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-print-root, #report-print-root * { visibility: visible; }
          #report-print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; background: white; color: black; }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(status)}
          <DataBadge variant="neutral">{dataStatus}</DataBadge>
          <span className="text-xs text-muted-foreground">{reportTypeLabel(type)}</span>
        </div>
        <div className="flex gap-2">
          <ReportExportButton />
          {showSave && onSave ? (
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-border/60 bg-secondary/40 px-3 text-xs hover:bg-secondary/60 disabled:opacity-50"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? t("app.pages.reports.saving") : t("app.pages.reports.saveToSupabase")}
            </button>
          ) : null}
        </div>
      </div>

      <div
        id="report-print-root"
        className="glass-card max-h-[60vh] overflow-y-auto p-5 md:max-h-[70vh] print:max-h-none print:overflow-visible print:border-0 print:shadow-none"
      >
        <h1 className="mb-4 text-lg font-semibold print:text-black">{title}</h1>
        <div className="prose prose-invert max-w-none space-y-1 print:text-black">{renderMarkdownSimple(content)}</div>
      </div>
    </div>
  );
}
