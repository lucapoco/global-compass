import { createFileRoute } from "@tanstack/react-router";
import { PresentationPage } from "@/pages/Presentation";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "Presentation Mode — Global Pulse" },
      {
        name: "description",
        content:
          "Guided step-by-step demo for InfoEducație jury presentations — explore Global Pulse features in order.",
      },
    ],
  }),
  component: PresentationPage,
});
