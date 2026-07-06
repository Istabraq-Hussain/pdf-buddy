// Electron packaging build — static offline renderer loaded via file://.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), tsConfigPaths()],
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    rollupOptions: {
      input: "electron/index.html",
    },
  },
});
