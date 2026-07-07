## Goal

Add a new tool "PDF to Word / ODT" that converts an uploaded PDF into `.doc`, `.docx`, or `.odt`, fully offline in the browser and in the Electron build.

## Approach

Real layout-preserving PDF → Word conversion needs LibreOffice, which isn't bundled. So the tool does a **text-based conversion**:

1. Reuse the existing `pdfjs-dist` pipeline (like `extractText`) to pull text per page, grouping items by y-coordinate into lines/paragraphs and marking page breaks.
2. Emit one of three formats:
   - **`.docx`** — built with the `docx` npm package (`Document`, `Paragraph`, `TextRun`, `PageBreak`) via `Packer.toBlob()`.
   - **`.doc`** — a Word-compatible HTML file served with `application/msword` MIME + `.doc` extension. Word, Google Docs and LibreOffice all open it correctly. No extra dependency needed.
   - **`.odt`** — a minimal valid OpenDocument Text zip (`mimetype` + `content.xml` + `META-INF/manifest.xml`) built with `fflate`.

All outputs contain text only — no images, fonts, or original layout. The card will say so.

## Files to change

- `bun add docx fflate`
- `src/lib/pdf-tools.ts` — add `pdfToDocx(file)`, `pdfToDoc(file)`, `pdfToOdt(file)` sharing an `extractParagraphsPerPage(file)` helper that reuses the pdfjs worker setup already in `extractText`.
- `src/components/pdf/PdfToolkitApp.tsx` — add a `ToolCard` "PDF to Word / ODT" with a file input, a format selector (`.docx` / `.doc` / `.odt`), a Convert button, and a short "text only — no images/layout" note.

No changes to routing, signature tool, or Electron config.

## Rebuild

After implementation I will also rebuild the Linux Electron package the same way as last time, so the downloadable app gets the new tool.

## Not doing

- No layout-preserving conversion (would require bundling LibreOffice).
- No image extraction into the output.
- No OCR of scanned PDFs.
