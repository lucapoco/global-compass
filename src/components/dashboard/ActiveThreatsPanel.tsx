/**
 * ActiveThreatsPanel — Threat landscape by operational domain.
 *
 * Aggregates intelligence events into 7 operational domains so operators
 * can see at a glance which sectors are generating the most activity.
 * Each domain row shows: count, top severity, and proportional bar.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Cpu, TrendingUp, Cloud, Heart, Globe2, Zap, AlertTriangle, ArrowRight } from "lucide-react";
import { useT } from "@/i18n";
import type { IntelligenceItem } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface Domain {
  id: string; label: string; icon: React.ElementType;
  categories: string[]; color: string; bg: string;
}

const DOMAINS: Domain[] = [
  { id: "military",  label: "Military",    icon: Shield,     categories: ["military"],                      color: "text-rose-400",    bg: "bg-rose-500/8" },
  { id: "geopolit",  label: "Geopolitics", icon: Globe2,     categories: ["geopolitics", "politics"],       color: "text-orange-400",  bg: "bg-orange-500/8" },
  { id: "cyber",     label: "Cyber",       icon: Cpu,        categories: ["cyber", "technology"],           color: "text-blue-400",    bg: "bg-blue-500/8" },
  { id: "economic",  label: "Economic",    icon: TrendingUp, categories: ["economy", "trade"],              color: "text-emerald-400", bg: "bg-emerald-500/8" },
  { id: "energy",    label: "Energy",      icon: Zap,        categories: ["energy"],                        color: "text-yellow-400",  bg: "bg-yellow-500/8" },
  { id: "climate",   label: "Climate",     icon: Cloud,      categories: ["climate", "disaster", "weather"],color: "text-cyan-400",    bg: "bg-cyan-500/8" },
  { id: "health",    label: "Health",      icon: Heart,      categories: ["health"],                        color: "text-pink-400",    bg: "bg-pink-500/8" },
];

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_STYLE: Record<string, string> = { critical: "text-rose-400", high: "text-amber-400", medium: "text-blue-400", low: "text-emerald-400" };

function topSeverity(items: IntelligenceItem[]): string | null {
  if (!items.length) return null;
  return items.reduce((best, i) => (SEV_RANK[i.severity] ?? 9) < (SEV_RANK[best.severity] ?? 9) ? i : best).severity;
}

function ThreatBar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-black/15" aria-hidden="true">
      <div className={`h-full rounded-full ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface Props { intel: IntelligenceItem[]; }

export function ActiveThreatsPanel({ intel }: Props) {
  const t = useT();
  const domainData = useMemo(() => {
    return DOMAINS.map((d) => {
      const items = intel.filter((i) => d.categories.some((cat) => i.category?.toLowerCase().includes(cat)));
      const critical = items.filter((i) => i.severity === "critical").length;
      const high = items.filter((i) => i.severity === "high").length;
      return { ...d, count: items.length, critical, high, topSev: topSeverity(items) };
    }).filter((d) => d.count > 0)
      .sort((a, b) => b.critical !== a.critical ? b.critical - a.critical : b.high !== a.high ? b.high - a.high : b.count - a.count);
  }, [intel]);

  const maxCount = Math.max(1, ...domainData.map((d) => d.count));

  return (
    <div className="glass-card p-4">
      <SectionHeader title={t("app.pages.dashboard.activeThreats.title")} subtitle={t("app.pages.dashboard.activeThreats.subtitle")} right={<AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />} size="sm" />
      {domainData.length === 0 ? (
        <EmptyState title={t("app.pages.dashboard.activeThreats.emptyTitle")} hint={t("app.pages.dashboard.activeThreats.emptyHint")} compact />
      ) : (
        <div className="space-y-1.5" role="list" aria-label={t("app.pages.dashboard.activeThreats.title")}>
          {domainData.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.id} role="listitem" className={`flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2 transition-colors ${d.bg}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/50 ${d.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${d.color}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{d.label}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ThreatBar count={d.count} max={maxCount} color={d.color} />
                      <span className={`text-sm font-bold tabular-nums ${d.color}`}>{d.count}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.topSev && <span className={`text-[9px] font-semibold uppercase ${SEV_STYLE[d.topSev] ?? "text-muted-foreground"}`}>Top: {d.topSev}</span>}
                    {d.critical > 0 && <span className="text-[9px] text-rose-400">{d.critical} critical</span>}
                    {d.high > 0 && d.critical === 0 && <span className="text-[9px] text-amber-400">{d.high} high</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3">
        <Link to="/intelligence" className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full">
          {t("app.pages.dashboard.activeThreats.viewAll")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
