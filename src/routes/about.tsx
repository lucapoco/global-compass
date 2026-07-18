import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import { useT } from "@/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — Global Pulse" }] }),
  component: AboutPage,
});

const SECTION_IDS = [
  "what", "problem", "users", "tech", "apis", "supabase",
  "map", "education", "authors", "future", "limits", "privacy", "credits",
] as const;

function AboutPage() {
  const t = useT();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) { toast.error(t("app.toasts.feedbackMessageRequired")); return; }
    if (trimmedMessage.length > 4000) { toast.error(t("app.toasts.feedbackMessageTooLong")); return; }
    if (name.trim().length > 200) { toast.error(t("app.toasts.feedbackNameTooLong")); return; }
    if (!isSupabaseConfigured()) { toast.error(t("app.ui.notConfigured")); return; }
    setSubmitting(true);
    try {
      await supabaseService.submitFeedback({ name: name.trim() || null, message: trimmedMessage, rating });
      toast.success(t("app.toasts.feedbackThanks"));
      setName(""); setMessage(""); setRating(5);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : t("app.toasts.submitFailed")); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.pages.about.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("app.pages.about.subtitle")}</p>
        </div>
        <DataBadge variant="source">{t("app.pages.about.projectInfo")}</DataBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SECTION_IDS.map((id) => (
          <div key={id} className="glass-card p-4">
            <div className="text-sm font-semibold">{t(`app.pages.about.sections.${id}.title`)}</div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t(`app.pages.about.sections.${id}.body`)}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <SectionHeader title={t("app.pages.about.feedbackTitle")} subtitle={t("app.pages.about.feedbackSubtitle")} />
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder={t("app.pages.about.namePlaceholder")}
            className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">{t("app.pages.about.rating")}</span>
            <input type="range" min={1} max={5} value={rating} onChange={(e) => setRating(parseInt(e.target.value))} className="flex-1 accent-[color:var(--color-primary)]" />
            <span className="tabular-nums">{rating}/5</span>
          </div>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("app.pages.about.messagePlaceholder")} rows={4}
            className="md:col-span-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <button disabled={submitting} className="md:col-span-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary disabled:opacity-60">
            {submitting ? t("app.pages.about.feedbackSending") : t("app.pages.about.feedbackSend")}
          </button>
        </form>
        {!isSupabaseConfigured() && <p className="mt-2 text-[11px] text-amber-glow">{t("app.pages.about.connectHint")}</p>}
      </div>
    </div>
  );
}
