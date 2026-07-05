// Client-side PDF tools. Works fully offline once the page is loaded.
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

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

export async function compressPdf(file: File): Promise<Uint8Array> {
  // Basic object-stream compression via pdf-lib re-save with useObjectStreams.
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return await doc.save({ useObjectStreams: true, addDefaultPage: false });
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
