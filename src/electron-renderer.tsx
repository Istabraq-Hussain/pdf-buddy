import { createRoot } from "react-dom/client";

import { PdfToolkitApp } from "@/components/pdf/PdfToolkitApp";
import { Toaster } from "@/components/ui/sonner";
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