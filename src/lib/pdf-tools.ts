// Client-side PDF tools. Works fully offline once the page is loaded.
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { Document as DocxDocument, Packer, Paragraph, TextRun, PageBreak } from "docx";
import { zipSync, strToU8 } from "fflate";

export async function readFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function download(bytes: Uint8Array | Blob, filename: string, mime = "application/pdf") {
  const blob =
    bytes instanceof Blob ? bytes : new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await readFile(f), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return await out.save();
}

// ranges: "1-3,5,7-9" (1-indexed)
export function parseRanges(input: string, total: number): number[] {
  const idx = new Set<number>();
  for (const part of input.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      if (isNaN(a) || isNaN(b)) continue;
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let i = lo; i <= hi; i++) idx.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= total) idx.add(n - 1);
    }
  }
  return [...idx].sort((a, b) => a - b);
}

export async function splitPdf(file: File, ranges: string): Promise<Uint8Array> {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const indices = parseRanges(ranges, src.getPageCount());
  if (indices.length === 0) throw new Error("No valid pages in range.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function extractEachPage(file: File): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const results: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    results.push({ name: `page-${i + 1}.pdf`, bytes: await out.save() });
  }
  return results;
}

export async function rotatePdf(file: File, angle: 90 | 180 | 270, ranges?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = doc.getPageCount();
  const targets = ranges && ranges.trim() ? parseRanges(ranges, total) : doc.getPageIndices();
  for (const i of targets) {
    const p = doc.getPage(i);
    const current = p.getRotation().angle;
    p.setRotation(degrees((current + angle) % 360));
  }
  return await doc.save();
}

export async function deletePages(file: File, ranges: string): Promise<Uint8Array> {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const remove = new Set(parseRanges(ranges, total));
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  if (keep.length === 0) throw new Error("Cannot remove all pages.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function reorderPages(file: File, order: string): Promise<Uint8Array> {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const seq = order
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= total)
    .map((n) => n - 1);
  if (seq.length === 0) throw new Error("Provide page order like: 3,1,2");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, seq);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const bytes = await readFile(f);
    const isPng = f.type.includes("png") || f.name.toLowerCase().endsWith(".png");
    const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return await out.save();
}

export async function pdfToImages(
  file: File,
  scale = 2,
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjsLib: any = await import("pdfjs-dist");
  // Use worker via bundler
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
    out.push({ name: `page-${i}.png`, blob });
  }
  return out;
}

export async function addWatermark(
  file: File,
  text: string,
  opts: { opacity?: number; fontSize?: number; angle?: number } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = opts.fontSize ?? 60;
  const opacity = opts.opacity ?? 0.25;
  const angle = opts.angle ?? 45;
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.2, 0.5, 0.3),
      opacity,
      rotate: degrees(angle),
    });
  }
  return await doc.save();
}

export async function addPageNumbers(file: File): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const { width } = p.getSize();
    const label = `${i + 1} / ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 10);
    p.drawText(label, { x: width - w - 20, y: 15, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  });
  return await doc.save();
}

export type CompressionLevel = "minimum" | "low" | "medium" | "strong" | "maximum";

type Preset = { dpi: number; quality: number; gray?: boolean };

const COMPRESSION_PRESETS: Record<CompressionLevel, Preset[]> = {
  minimum: [], // lossless: object streams only
  low: [{ dpi: 120, quality: 0.62 }],
  medium: [{ dpi: 90, quality: 0.45 }],
  strong: [{ dpi: 72, quality: 0.28 }],
  maximum: [{ dpi: 42, quality: 0.1, gray: true }],
};

const EMERGENCY_PRESET: Preset = { dpi: 32, quality: 0.06, gray: true };

async function rasterizeToPdf(
  pdfjsLib: any,
  data: Uint8Array,
  preset: Preset,
): Promise<Uint8Array> {
  const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  const out = await PDFDocument.create();
  const scale = preset.dpi / 72;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This system could not create an image canvas.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (preset.gray) {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        for (let p = 0; p < d.length; p += 4) {
          const v = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
          d[p] = d[p + 1] = d[p + 2] = v;
        }
        ctx.putImageData(img, 0, 0);
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("JPEG encoding failed.")),
          "image/jpeg",
          preset.quality,
        ),
      );
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const outputPage = out.addPage([base.width, base.height]);
      outputPage.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
    }
    return await out.save({ useObjectStreams: true, addDefaultPage: false });
  } finally {
    await pdf.destroy();
  }
}

export async function compressPdf(
  file: File,
  level: CompressionLevel = "low",
): Promise<{ bytes: Uint8Array; originalSize: number; newSize: number; level: CompressionLevel }> {
  const data = await readFile(file);
  const originalSize = data.byteLength;

  const lossless = await PDFDocument.load(data, { ignoreEncryption: true });
  const losslessBytes = await lossless.save({ useObjectStreams: true, addDefaultPage: false });

  let best = losslessBytes.byteLength <= originalSize ? losslessBytes : data;

  const presets = COMPRESSION_PRESETS[level];
  if (presets.length) {
    const pdfjsLib: any = await import("pdfjs-dist");
    const PdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?worker")).default;
    if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
    }
    let successfulAttempts = 0;
    let lastError: unknown;
    for (const preset of presets) {
      try {
        const candidate = await rasterizeToPdf(pdfjsLib, data, preset);
        successfulAttempts += 1;
        if (candidate.byteLength < best.byteLength) best = candidate;
      } catch (error) {
        lastError = error;
      }
    }

    // If the selected passes did not beat the source, continue with progressively
    // smaller page images. This guarantees a real reduction whenever the PDF can
    // be rendered, instead of returning the unchanged input without explanation.
    if (best.byteLength >= originalSize) {
      try {
        const candidate = await rasterizeToPdf(pdfjsLib, data, EMERGENCY_PRESET);
        successfulAttempts += 1;
        if (candidate.byteLength < best.byteLength) best = candidate;
      } catch (error) {
        lastError = error;
      }
    }

    if (successfulAttempts === 0) {
      const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
      throw new Error(`The PDF pages could not be compressed.${detail}`);
    }
  }

  return { bytes: best, originalSize, newSize: best.byteLength, level };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export async function setMetadata(
  file: File,
  meta: { title?: string; author?: string; subject?: string; keywords?: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  if (meta.title !== undefined) doc.setTitle(meta.title);
  if (meta.author !== undefined) doc.setAuthor(meta.author);
  if (meta.subject !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) doc.setKeywords(meta.keywords.split(",").map((s) => s.trim()));
  doc.setModificationDate(new Date());
  return await doc.save();
}

export async function extractText(file: File): Promise<string> {
  const pdfjsLib: any = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += `--- Page ${i} ---\n`;
    out += content.items.map((it: any) => it.str).join(" ");
    out += "\n\n";
  }
  return out;
}

export async function getPageCount(file: File): Promise<number> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function signPdf(
  file: File,
  signatureDataUrl: string,
  opts: {
    page: number; // 1-indexed; 0 or negative means last page
    position?: "bottom-right" | "bottom-left" | "bottom-center";
    widthPct?: number; // width relative to page width (0-1)
    // Exact placement (top-left of signature, page-relative 0..1). Overrides `position`.
    placement?: { xPct: number; yPct: number; widthPct: number };
  } = { page: 0 },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const pages = doc.getPages();
  const total = pages.length;
  const idx = opts.page && opts.page > 0 ? Math.min(opts.page, total) - 1 : total - 1;
  const page = pages[idx];
  const { width, height } = page.getSize();

  const pngBytes = Uint8Array.from(atob(signatureDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const png = await doc.embedPng(pngBytes);

  let x: number, y: number, w: number, h: number;
  if (opts.placement) {
    w = width * opts.placement.widthPct;
    h = (png.height / png.width) * w;
    x = width * opts.placement.xPct;
    y = height - opts.placement.yPct * height - h;
  } else {
    const targetW = width * (opts.widthPct ?? 0.35);
    const scale = targetW / png.width;
    w = png.width * scale;
    h = png.height * scale;
    const margin = 40;
    const pos = opts.position ?? "bottom-right";
    x =
      pos === "bottom-left"
        ? margin
        : pos === "bottom-center"
          ? (width - w) / 2
          : width - w - margin;
    y = margin;
  }
  page.drawImage(png, { x, y, width: w, height: h });
  return await doc.save();
}

// ---------- PDF → Word / ODT (text-only) ----------

async function extractParagraphsPerPage(file: File): Promise<string[][]> {
  const pdfjsLib: any = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group by y-coordinate into lines
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, s: it.str });
    }
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    const paras: string[] = [];
    for (const [, parts] of sorted) {
      parts.sort((a, b) => a.x - b.x);
      const line = parts.map((p) => p.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) paras.push(line);
    }
    pages.push(paras);
  }
  return pages;
}

export async function pdfToDocx(file: File): Promise<Blob> {
  const pages = await extractParagraphsPerPage(file);
  const children: Paragraph[] = [];
  pages.forEach((paras, idx) => {
    if (idx > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    for (const p of paras) {
      children.push(new Paragraph({ children: [new TextRun(p)] }));
    }
  });
  const doc = new DocxDocument({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}

export async function pdfToDoc(file: File): Promise<Blob> {
  const pages = await extractParagraphsPerPage(file);
  const body = pages
    .map(
      (paras) =>
        `<div>${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>`,
    )
    .join('<br style="page-break-before:always" clear="all">');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Document</title></head><body>${body}</body></html>`;
  return new Blob([html], { type: "application/msword" });
}

export async function pdfToOdt(file: File): Promise<Blob> {
  const pages = await extractParagraphsPerPage(file);
  const paras: string[] = [];
  pages.forEach((page, idx) => {
    const style = idx > 0 ? ' text:style-name="PageBreak"' : "";
    page.forEach((p, i) => {
      const s = i === 0 && idx > 0 ? style : "";
      paras.push(`<text:p${s}>${escapeXml(p)}</text:p>`);
    });
    if (page.length === 0 && idx > 0) paras.push(`<text:p${style}/>`);
  });
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
<office:automatic-styles>
<style:style style:name="PageBreak" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:break-before="page"/></style:style>
</office:automatic-styles>
<office:body><office:text>${paras.join("")}</office:text></office:body>
</office:document-content>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
  const zipped = zipSync({
    mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
    "content.xml": strToU8(content),
    "META-INF/manifest.xml": strToU8(manifest),
  });
  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/vnd.oasis.opendocument.text" });
}
