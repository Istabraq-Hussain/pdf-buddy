// Electron packaging build — produces a runnable Node SSR server
// instead of a Cloudflare Worker so it can be started inside Electron.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
    output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
  },
});
