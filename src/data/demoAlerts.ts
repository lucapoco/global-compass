import type { AlertItem } from "@/types";

export const demoAlerts: AlertItem[] = [
  {
    id: "demo-1",
    title: "Heat advisory — Southern Europe",
    type: "weather",
    severity: "Medium",
    location: "Mediterranean basin",
    description: "Temperatures above seasonal norms (demo data).",
    source: "Demo",
  },
  {
    id: "demo-2",
    title: "Grid stress reported",
    type: "infrastructure",
    severity: "Low",
    location: "Texas, USA",
    description: "Sample infrastructure alert for presentation (demo data).",
    source: "Demo",
  },
];
