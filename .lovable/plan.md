## Fix the blank white window in the packaged PDF Buddy desktop app

The screenshot shows the Electron window opens but renders nothing. The previous build enabled DevTools so we could read the actual error, but you're still seeing a white window without console output shared. Rather than keep guessing, I'll fix the two most likely root causes together and rebuild.

### Likely causes

1. **SPA index doesn't load assets under `file://`** — `dist/client/index.html` (produced by `scripts/make-spa-index.mjs`) may still reference assets with absolute `/assets/...` paths. Under `file://` those resolve to your filesystem root and 404, leaving a blank page.
2. **Client-side router hits a server-only path on load** — TanStack Start's SSR/loader code can throw in a pure `file://` context, blanking the tree before anything renders.

### Steps

1. Inspect `scripts/make-spa-index.mjs`, `vite.config.ts`, and the generated `dist/client/index.html` to confirm asset paths are relative (`./assets/...`), not absolute. Fix the script to rewrite `src="/…"` and `href="/…"` → `./…` if needed.
2. Confirm `vite.config.ts` has `base: './'` for the client build (required for `file://`). Add it if missing.
3. In `electron/main.cjs`, keep DevTools open and add a `console.log` of the resolved `index.html` path so any load failure is obvious.
4. Rebuild: `npx vite build` → run the SPA index script → repackage with `@electron/packager` → archive to `/mnt/documents/PDF24-Toolkit-linux-x64.tar.gz`.
5. Give you the extract + run commands. When you open it, DevTools will auto-open — if it's still blank, paste the red errors from the **Console** tab and I'll fix the specific failure.

### What you'll do after I rebuild

```bash
tar xzf PDF24-Toolkit-linux-x64.tar.gz
cd PDF24-Toolkit-linux-x64
./PDF24-Toolkit --no-sandbox
```

DevTools opens automatically. If the window is still blank, copy the red Console errors into chat.
