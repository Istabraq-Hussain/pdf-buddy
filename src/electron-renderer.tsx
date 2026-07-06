import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/ui/sonner";
import { PdfToolkitApp } from "@/routes/index";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <>
    <PdfToolkitApp />
    <Toaster />
  </>,
);