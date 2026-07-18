/**
 * TrendingTopicsPanel — Auto-extracted keyword frequency from intelligence events.
 *
 * Tokenises titles and descriptions, filters stopwords, and surfaces the most
 * frequently mentioned meaningful terms. Fully client-side — no API calls.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Hash, TrendingUp, ArrowRight } from "lucide-react";
import type { IntelligenceItem } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from",
  "is","are","was","were","be","been","has","have","had","do","does","did","will",
  "would","could","should","may","might","can","not","no","nor","as","if","it","its",
  "their","they","we","he","she","his","her","over","after","before","during","into",
  "through","amid","new","more","two","three","says","said","report","reports","news",
  "update","updates","about","that","this","which","when","where","what","who","how",
]);

const MIN_WORD_LEN = 4;
const MAX_TOPICS   = 12;

function extractKeywords(items: IntelligenceItem[]): Array<{ term: string; count: number; pct: number }> {
  const freq = new Map<string, number>();
  for (const item of items) {
    const text = `${item.title} ${item.description ?? ""} ${item.country ?? ""}`;
    const words = text
      .replace(/[^a-zA-Z\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.toLowerCase().replace(/^[-']+|[-']+$/g, ""))
      .filter((w) => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w));
    for (const word of words) freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, MAX_TOPICS);
  const maxCount = sorted[0]?.[1] ?? 1;
  return sorted.map(([term, count]) => ({
    term: term.charAt(0).toUpperCase() + term.slice(1),
    count,
    pct: Math.round((count / maxCount) * 100),
  }));
}

interface Props { intel: IntelligenceItem[]; }

export function TrendingTopicsPanel({ intel }: Props) {
  const t = useT();
  const topics = useMemo(() => extractKeywords(intel), [intel]);

  return (
    <div className="glass-card p-4">
      <SectionHeader title={t("app.pages.dashboard.trending.title")} subtitle={t("app.pages.dashboard.trending.subtitle")} right={<Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />} size="sm" />
      {topics.length === 0 ? (
        <EmptyState title={t("app.pages.dashboard.trending.emptyTitle")} hint={t("app.pages.dashboard.trending.emptyHint")} compact />
      ) : (
        <ol className="space-y-2" aria-label={t("app.pages.dashboard.trending.aria")}>
          {topics.map((topic, i) => (
            <li key={topic.term}>
              <div className="flex items-center gap-2 group">
                <span className="w-5 flex-shrink-0 text-[10px] font-bold text-muted-foreground/50 tabular-nums text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate">{topic.term}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground ml-2 flex-shrink-0">{topic.count}×</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/40">
                    <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${topic.pct}%` }} aria-hidden="true" />
                  </div>
                </div>
                <TrendingUp className="h-3 w-3 flex-shrink-0 text-muted-foreground/40" aria-hidden="true" />
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3">
        <Link to="/intelligence" className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors w-full">
          {t("app.pages.dashboard.trending.exploreFeed")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
