## Goal

Repackage the working Linux Electron app so it includes the new full-screen interactive signature placement mode.

## Steps

1. Run `npx vite build` to produce a fresh `dist/` bundle containing:
   - `SignaturePlacer.tsx` (draggable/resizable signature overlay with page thumbnails)
   - Updated `signPdf` in `src/lib/pdf-tools.ts` with `placement` support
   - Updated `PdfToolkitApp.tsx` with the "Place signature on document →" button

2. Re-run `npx @electron/packager` with the same options as the previous working build (`--platform=linux --arch=x64`, ignoring `src/`, `public/`, `electron-release/`, `node_modules`).

3. Archive: `tar czf /mnt/documents/PDF24-Toolkit-linux-x64.tar.gz -C /dev-server/electron-release PDF24-Toolkit-linux-x64/`.

4. Sanity check the archive lists the `PDF24-Toolkit` binary and updated `resources/app/dist/` assets.

## Not doing

- No code changes to the signature feature itself (already implemented).
- No macOS/Windows builds unless you ask.
- No changes to Vite/Electron config — reusing the setup that worked last time.

## Result

You download the same `PDF24-Toolkit-linux-x64.tar.gz`, extract, and run `./PDF24-Toolkit --no-sandbox` — the Sign tool now opens the new placement screen.
