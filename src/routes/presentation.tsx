import { createFileRoute } from "@tanstack/react-router";
import { PresentationPage } from "@/pages/Presentation";
import en from "@/locales/en.json";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: en.app.pages.presentation.metaTitle },
      {
        name: "description",
        content: en.app.pages.presentation.metaDescription,
      },
    ],
  }),
  component: PresentationPage,
});
