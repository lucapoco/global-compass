import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { DataBadge } from "@/components/ui/DataBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — Global Pulse" }] }),
  component: AboutPage,
});

const SECTIONS: { title: string; body: string }[] = [
  { title: "What is Global Pulse?", body: "An educational real-time situational awareness dashboard that aggregates public planetary data — earthquakes, weather, countries and alerts — into a single polished interface." },
  { title: "The problem it solves", body: "Public data exists across many fragmented APIs. Global Pulse demonstrates how a thoughtful UI can turn raw feeds into actionable, glanceable insight." },
  { title: "Target users", body: "Students, educators, hobbyists in geopolitics, climate or seismology, and anyone curious about live world data." },
  { title: "Technologies used", body: "React 19, TypeScript, TanStack Router & Query, Tailwind CSS, MapLibre GL (Mapbox-ready), Recharts, lucide-react, and Lovable Cloud (Supabase)." },
  { title: "APIs used", body: "REST Countries (countries), USGS (earthquakes), OpenWeather (weather), and Supabase for persistence." },
  { title: "Supabase integration", body: "Four tables — saved_countries, saved_alerts, user_feedback, project_logs — with RLS enabled. All saves and deletes are audited into project_logs." },
  { title: "Why the map matters", body: "A professional dark map (MapLibre / Mapbox-compatible) gives spatial context to seismic and alert data — a hallmark of monitoring dashboards." },
  { title: "Educational value", body: "Demonstrates async data fetching, error/loading/empty states, charting, geospatial visualization, and database CRUD with RLS — all common topics in modern web courses." },
  { title: "Future improvements", body: "Authentication, per-user saved data, real-time websockets, forecast charts, satellite imagery overlays, internationalization." },
  { title: "Data limitations", body: "Free public APIs may rate-limit or lag; demo data is clearly labeled. This is not an operational tool." },
  { title: "Privacy and ethics", body: "No personal data is collected without consent. The feedback form is optional and demo-grade." },
  { title: "Credits / data sources", body: "USGS Earthquake Hazards Program · REST Countries · OpenWeather · OpenStreetMap (basemap tiles via CARTO) · Supabase." },
];

function AboutPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { toast.error("Please write a message."); return; }
    if (!isSupabaseConfigured()) { toast.error("Supabase not configured."); return; }
    setSubmitting(true);
    try {
      await supabaseService.submitFeedback({ name: name || null, message, rating });
      toast.success("Thank you for the feedback!");
      setName(""); setMessage(""); setRating(5);
    } catch (e: any) { toast.error(e.message ?? "Submit failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">About Global Pulse</h1>
          <p className="text-xs text-muted-foreground">An educational project for InfoEducație</p>
        </div>
        <DataBadge variant="source">Project info</DataBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <div key={s.title} className="glass-card p-4">
            <div className="text-sm font-semibold">{s.title}</div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <SectionHeader title="Send us feedback" subtitle="Stored in Supabase · user_feedback" />
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
            className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">Rating</span>
            <input type="range" min={1} max={5} value={rating} onChange={(e) => setRating(parseInt(e.target.value))} className="flex-1 accent-[color:var(--color-primary)]" />
            <span className="tabular-nums">{rating}/5</span>
          </div>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message" rows={4}
            className="md:col-span-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <button disabled={submitting} className="md:col-span-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary disabled:opacity-60">
            {submitting ? "Sending…" : "Send feedback"}
          </button>
        </form>
        {!isSupabaseConfigured() && <p className="mt-2 text-[11px] text-amber-glow">Connect Supabase to enable feedback submission.</p>}
      </div>
    </div>
  );
}
