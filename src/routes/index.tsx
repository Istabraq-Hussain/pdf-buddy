import { createFileRoute } from "@tanstack/react-router";

import { PdfToolkitApp } from "@/components/pdf/PdfToolkitApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF24 Toolkit — Offline PDF tools" },
      {
        name: "description",
        content:
          "All-in-one offline PDF toolkit: merge, split, rotate, compress, watermark, convert and more. Runs entirely in your browser.",
      },
      { property: "og:title", content: "PDF24 Toolkit — Offline PDF tools" },
      {
        property: "og:description",
        content: "Merge, split, rotate, compress, watermark and convert PDFs — all offline.",
      },
    ],
  }),
  component: PdfToolkitApp,
});