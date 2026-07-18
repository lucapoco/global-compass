import { FileText, Trash2 } from "lucide-react";
import type { GeneratedReport } from "@/types";
import { reportTypeLabel } from "@/services/reportService";
import { DataBadge } from "@/components/ui/DataBadge";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

interface Props {
  report: GeneratedReport;
  onOpen: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

export function ReportCard({ report, onOpen, onDelete, deleting }: Props) {
  const t = useT();
  const preview = report.content.replace(/^#+\s/gm, "").slice(0, 140);
  return (
    <div className="glass-card flex flex-col gap-2 p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-semibold">{report.title}</h3>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{reportTypeLabel(report.type)}</p>
        </div>
        <DataBadge variant="neutral">{report.data_status}</DataBadge>
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">{preview}…</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={onOpen}>
          {t("app.pages.reports.view")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("app.pages.reports.delete")}
        </Button>
      </div>
      {report.created_at ? (
        <p className="text-[10px] text-muted-foreground">{new Date(report.created_at).toLocaleString()}</p>
      ) : null}
    </div>
  );
}
