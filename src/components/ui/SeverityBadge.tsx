import type { Severity } from "@/types";

const map: Record<Severity, string> = {
  Low: "bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30",
  Medium: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  High: "bg-amber-glow/15 text-amber-glow border-amber-glow/30",
  Critical: "bg-rose-glow/20 text-rose-glow border-rose-glow/40",
};

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const cls = map[(severity as Severity)] ?? map.Low;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}
