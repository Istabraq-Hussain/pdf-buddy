## Goal

Replace the current "Page + Position dropdown" step of the Sign PDF tool with a full-screen placement view where the user sees the actual PDF page and clicks/drags to position the signature exactly.

## Flow

1. In the Sign tool card, user picks PDF + draws signature as today.
2. Instead of Page/Position inputs, click **"Place signature on document →"**.
3. A full-screen overlay (`SignaturePlacer`) opens:
   - Left sidebar: page thumbnails (rendered via pdf.js) to pick which page.
   - Main area: large rendered preview of the selected page.
   - Signature image overlaid as a draggable/resizable box (drag to move, corner handle to resize). Initial spot = bottom-right.
   - Toolbar: page selector, "Cancel", "Apply & download signed PDF".
4. On Apply: compute normalized (x, y, widthPct) for the chosen page and call an extended `signPdf` that accepts exact coordinates, then download.

## Technical

**`src/lib/pdf-tools.ts`** — extend `signPdf` to accept an alternate placement:
```ts
signPdf(file, sigDataUrl, {
  page: number,           // 1-indexed
  placement: { xPct: number; yPct: number; widthPct: number } // top-left of sig, page-relative
})
```
Keep existing `position` API for backward compat. When `placement` is provided, convert to pdf-lib coords (`y = pageHeight - yPct*pageHeight - sigHeight`).

**`src/components/pdf/SignaturePlacer.tsx`** (new) — fixed inset-0 overlay:
- Uses existing dynamic `pdfjs-dist` import (same worker setup as `pdfToImages`) to render pages to canvases.
- State: `pageIndex`, `box = {xPct, yPct, widthPct}`.
- Renders selected page canvas; overlays an absolutely-positioned `<img>` of the signature sized/positioned by `box` scaled to canvas rect.
- Pointer handlers on the sig box for drag; a small handle at bottom-right for resize. Constrain within page bounds.
- Thumbnails column (lower-res renders) with active highlight.
- Props: `{ file, signatureDataUrl, onCancel, onConfirm({page, placement}) }`.

**`src/components/pdf/PdfToolkitApp.tsx`** — update `Sign()`:
- Remove Page# input and Position dropdown.
- Add "Place signature on document" button (disabled until file + signature present).
- On click, mount `<SignaturePlacer .../>`; on confirm, call `signPdf` with `placement`, download `signed.pdf`, close overlay.

## Out of scope

- Multiple signatures per document.
- Typed/uploaded signatures (drawing pad stays as-is).
- Rotation of the signature.
