## Plan

The repeated white screen means the embedded SSR server approach is still failing in the packaged Electron app. Since this PDF toolkit is fully client-side/offline, the most reliable fix is to stop running a web server inside Electron and package a static Electron renderer instead.

## What I will change

1. **Remove SSR from the Electron app path**
   - Electron will no longer spawn `dist/server/index.mjs`.
   - It will load a local `file://` HTML app instead, which avoids localhost server startup failures entirely.

2. **Extract the PDF toolkit UI into a reusable component**
   - Move the current home-page PDF tools into a shared component.
   - Keep the normal web preview route working by rendering that component from `/`.
   - Render the same component from a separate Electron-only entry point.

3. **Create an Electron-specific static build**
   - Add an Electron HTML entry and renderer entry.
   - Build with relative asset paths so scripts/CSS work under `file://`.
   - Keep all PDF processing offline in the browser window.

4. **Rewrite Electron main process for static loading**
   - Load the built local HTML file directly.
   - Add a visible fallback screen if loading fails instead of leaving a blank white window.
   - Log renderer console errors and failed loads to the terminal for debugging.

5. **Repackage and verify the archive contents**
   - Confirm the app archive contains the static HTML and assets.
   - Produce a new `PDF24-Toolkit-linux-x64.tar.gz` download.

## Expected result

This should be much more reliable than the current SSR-in-Electron approach because there is no server process, no random port, no Node SSR runtime, and no localhost page to wait for. The Electron app should open directly to the PDF toolkit UI.