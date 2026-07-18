/**
 * QuickCommandsBar — Operational quick-action buttons (light theme).
 */
import { useNavigate } from "@tanstack/react-router";
import {
  Globe2, Sparkles, FileText, Network, Flag,
  BarChart2, Map, Activity,
} from "lucide-react";
import { useT } from "@/i18n";

interface QuickCommand {
  key: string;
  icon: React.ElementType;
  to: string;
}

const COMMANDS: QuickCommand[] = [
  { key: "globe",           icon: Globe2,     to: "/map" },
  { key: "ai",              icon: Sparkles,   to: "/ai-news" },
  { key: "reports",         icon: FileText,   to: "/reports" },
  { key: "knowledgeGraph",  icon: Network,    to: "/knowledge-graph" },
  { key: "countries",       icon: Flag,       to: "/countries" },
  { key: "analytics",       icon: BarChart2,  to: "/analytics" },
  { key: "liveMap",         icon: Map,        to: "/map" },
  { key: "earthquakes",     icon: Activity,   to: "/earthquakes" },
];

interface Props {
  compact?: boolean;
}

export function QuickCommandsBar({ compact }: Props) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[#E2E8F0] bg-white px-4 py-2.5">
      <span className="mr-1 shrink-0 text-[9px] font-semibold uppercase tracking-widest text-[#64748B]">
        {t("app.pages.missionControl.quick")}
      </span>
      {COMMANDS.map((cmd) => {
        const Icon = cmd.icon;
        const label = t(`app.pages.missionControl.commands.${cmd.key}`);
        return (
          <button
            key={cmd.key}
            onClick={() => void navigate({ to: cmd.to })}
            className="group flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-medium text-[#64748B] transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
          >
            <Icon
              className="shrink-0 text-[#64748B] transition-colors group-hover:text-primary"
              style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
