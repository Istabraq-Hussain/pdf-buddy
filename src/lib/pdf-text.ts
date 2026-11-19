import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export type TextColor = "ink" | "green" | "blue" | "red";
export type PdfText = {
  id: string;
  page: number;
  text: string;
  x: number;
  y: number;
  size: number;
  bold: boolean;
  italic: boolean;
  color: TextColor;
};

const colors: Record<TextColor, [number, number, number]> = {
  ink: [0, 0, 0], green: [0.02, 0.45, 0.3], blue: [0.1, 0.3, 0.75], red: [0.75, 0.12, 0.16],
};

export function textFont(bold: boolean, italic: boolean) {
  return bold ? (italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold)
    : (italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
}

// Coordinates are top-left PDF.js viewport points, including crop and rotation.
export function textPosition(crop: { x: number; y: number; width: number; height: number }, rotation: number, x: number, y: number) {
  const angle = ((rotation % 360) + 360) % 360;
  switch (angle) {
    case 90: return { x: crop.x + y, y: crop.y + x, angle: 90 };
    case 180: return { x: crop.x + crop.width - x, y: crop.y + y, angle: 180 };
    case 270: return { x: crop.x + crop.width - y, y: crop.y + crop.height - x, angle: 270 };
    default: return { x: crop.x + x, y: crop.y + crop.height - y, angle: 0 };
  }
}

export async function addPdfText(file: File, entries: PdfText[]): Promise<Uint8Array> {
  if (!entries.length) throw new Error("Add some text first.");
  const doc = await PDFDocument.load(await file.arrayBuffer());
  for (const entry of entries) {
    if (!entry.text.trim()) throw new Error("Text cannot be empty.");
    if (!Number.isInteger(entry.page) || entry.page < 1 || entry.page > doc.getPageCount()) throw new Error("Choose a valid page.");
    if (!Number.isFinite(entry.size) || entry.size < 6 || entry.size > 96) throw new Error("Choose a text size between 6 and 96.");
    const page = doc.getPage(entry.page - 1);
    const font = await doc.embedFont(textFont(entry.bold, entry.italic));
    const position = textPosition(page.getCropBox(), page.getRotation().angle, entry.x, entry.y + entry.size);
    try {
      font.encodeText(entry.text.replace(/\r?\n/g, ""));
    } catch {
      throw new Error("This font supports Western European text only. Please remove unsupported characters.");
    }
    page.drawText(entry.text.replace(/\r\n/g, "\n"), {
      x: position.x, y: position.y, rotate: degrees(position.angle), font,
      size: entry.size, lineHeight: entry.size * 1.2, color: rgb(...colors[entry.color]),
    });
  }
  return doc.save();
}