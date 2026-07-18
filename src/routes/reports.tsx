import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/pages/Reports";
import en from "@/locales/en.json";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: en.app.pages.reports.metaTitle },
      {
        name: "description",
        content: en.app.pages.reports.metaDescription,
      },
    ],
  }),
  component: ReportsPage,
});
