/**
 * `/alerts` — superseded by the Global Alert & Crisis Management Center at
 * `/alert-center`, which is fully wired to the centralized Intelligence
 * Store (multi-provider alert generation, crisis detection, heatmap,
 * watchlists, notifications). Redirect rather than duplicate legacy,
 * single-provider alert logic.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/alerts")({
  beforeLoad: () => {
    throw redirect({ to: "/alert-center" });
  },
});
