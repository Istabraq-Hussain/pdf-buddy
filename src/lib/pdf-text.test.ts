import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { addPdfText, textPosition } from "./pdf-text";

describe("PDF text placement", () => {
  test("maps top-left coordinates for each page rotation", () => {
    const crop = { x: 10, y: 20, width: 600, height: 800 };
    assert.deepEqual(textPosition(crop, 0, 30, 50), { x: 40, y: 770, angle: 0 });
    assert.deepEqual(textPosition(crop, 90, 30, 50), { x: 60, y: 50, angle: 90 });
    assert.deepEqual(textPosition(crop, 180, 30, 50), { x: 580, y: 70, angle: 180 });
    assert.deepEqual(textPosition(crop, 270, 30, 50), { x: 560, y: 790, angle: 270 });
  });
  test("adds text while preserving both original pages", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 800]); pdf.addPage([600, 800]);
    const file = new File([new Uint8Array(await pdf.save()).buffer], "original.pdf");
    const edited = await addPdfText(file, [{ id: "1", page: 2, text: "Hello Ubuntu", x: 30, y: 50, size: 18, bold: false, italic: false, color: "ink" }]);
    const result = await PDFDocument.load(edited);
    assert.equal(result.getPageCount(), 2);
    assert.ok(result.getPage(1).node.Contents());
    assert.equal(result.getPage(0).node.Contents(), undefined);
  });
});