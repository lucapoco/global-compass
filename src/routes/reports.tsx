import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/pages/Reports";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Intelligence Reports — Global Pulse" },
      {
        name: "description",
        content:
          "Generate, save, and export intelligence-style country reports, event reports, and global briefings.",
      },
    ],
  }),
  component: ReportsPage,
});
