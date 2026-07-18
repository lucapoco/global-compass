import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

interface Props {
  className?: string;
}

/** Opens the browser print dialog (user can save as PDF). Pair with print CSS on #report-print-root. */
export function ReportExportButton({ className }: Props) {
  const t = useT();
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={() => window.print()}>
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      {t("app.pages.reports.printExportPdf")}
    </Button>
  );
}
