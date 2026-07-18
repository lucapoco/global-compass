import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/landing/LandingPage";

const SITE_URL = "https://global-pulse.app";
const TITLE = "Global Pulse — Planetary Intelligence Platform";
const DESCRIPTION =
  "Understand a changing world before it becomes a crisis. Live global monitoring, AI briefings, and decision support for teams that cannot afford blind spots.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "planetary intelligence, global monitoring, AI briefings, geopolitical analysis, earthquake tracking, mission control" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#0284c7" },
      /* Open Graph */
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:site_name", content: "Global Pulse" },
      { property: "og:locale", content: "en_US" },
      /* Twitter */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: LandingPage,
});
