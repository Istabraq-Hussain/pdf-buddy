import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Plus, Trash2, Download, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addPdfText, textFont, type PdfText, type TextColor } from "@/lib/pdf-text";
import { download } from "@/lib/pdf-tools";

const palette: { id: TextColor; label: string }[] = [
  { id: "ink", label: "Black" }, { id: "green", label: "Green" },
  { id: "blue", label: "Blue" }, { id: "red", label: "Red" },
];

export function TextEditor({ file, onClose }: { file: File; onClose: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<PdfText[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const fontDoc = useRef<PDFDocument | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; startX: number; startY: number } | null>(null);
  const active = entries.find((entry) => entry.id === selected);

  useEffect(() => {
    let disposed = false;
    let loaded: PDFDocumentProxy | undefined;
    let destroyTask: (() => void) | undefined;
    (async () => {
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        destroyTask = () => { void task.destroy(); };
        loaded = await task.promise;
        if (disposed) { await loaded.destroy(); return; }
        fontDoc.current = await PDFDocument.create();
        setPdf(loaded);
      } catch (e) {
        if (!disposed) { setError(e instanceof Error ? e.message : "Could not open this PDF."); setLoading(false); }
      }
    })();
    return () => { disposed = true; if (loaded) void loaded.destroy(); else destroyTask?.(); };
  }, [file]);

  useEffect(() => {
    if (!pdf) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setLoading(true);
    setDimensions({ width: 0, height: 0 });
    (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (disposed) return;
        const viewport = pdfPage.getViewport({ scale: 1 });
        const target = canvas.current;
        const ctx = target?.getContext("2d");
        if (!target || !ctx) throw new Error("Page preview is unavailable.");
        const rendered = pdfPage.getViewport({ scale: 1.5 });
        target.width = Math.ceil(rendered.width);
        target.height = Math.ceil(rendered.height);
        task = pdfPage.render({ canvas: target, canvasContext: ctx, viewport: rendered });
        await task.promise;
        if (!disposed) { setDimensions({ width: viewport.width, height: viewport.height }); setLoading(false); }
      } catch (e) {
        if (!disposed) { setError(e instanceof Error ? e.message : "Could not display this page."); setLoading(false); }
      }
    })();
    return () => { disposed = true; task?.cancel(); };
  }, [pdf, page]);

  function update(values: Partial<PdfText>) {
    setEntries((current) => current.map((entry) => entry.id === selected ? { ...entry, ...values } : entry));
  }

  function addText() {
    const id = crypto.randomUUID();
    setEntries((current) => [...current, {
      id, page, text: "", x: 30, y: 30, size: 18, bold: false, italic: false, color: "ink",
    }]);
    setSelected(id);
  }

  async function save() {
    setSaving(true);
    try {
      // Keep text within the displayed page and reject unsupported glyphs before exporting.
      const fonts = fontDoc.current;
      if (!pdf || !fonts) throw new Error("Wait for the PDF to load.");
      for (const entry of entries) {
        const viewport = (await pdf.getPage(entry.page)).getViewport({ scale: 1 });
        const font = await fonts.embedFont(textFont(entry.bold, entry.italic));
        let width: number;
        try { width = Math.max(...entry.text.split(/\r?\n/).map((line) => font.widthOfTextAtSize(line, entry.size))); }
        catch { throw new Error("This font supports Western European text only. Please remove unsupported characters."); }
        const height = entry.size + (entry.text.split(/\r?\n/).length - 1) * entry.size * 1.2;
        if (entry.x + width > viewport.width || entry.y + height > viewport.height) {
          throw new Error(`Text on page ${entry.page} goes outside the page. Move it or reduce its size.`);
        }
      }
      const bytes = await addPdfText(file, entries);
      download(bytes, file.name.replace(/\.pdf$/i, "") + "-with-text.pdf");
      toast.success("PDF saved with your text.");
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save this PDF."); }
    finally { setSaving(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Add text to PDF" className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">Add text <span className="ml-2 text-sm font-normal text-muted-foreground">{file.name}</span></h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}><X /> Close</Button>
          <Button variant="pdf" onClick={save} disabled={saving || loading || !!error || !entries.length}><Download />{saving ? "Saving…" : "Save PDF"}</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[40vh] shrink-0 flex-col gap-3 overflow-y-auto border-b p-4 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2">
            <Button size="icon" variant="outline" aria-label="Previous page" disabled={page === 1 || loading} onClick={() => { setPage(page - 1); setSelected(null); }}><ChevronLeft /></Button>
            <span className="text-sm">Page {page} of {pdf?.numPages ?? "…"}</span>
            <Button size="icon" variant="outline" aria-label="Next page" disabled={!pdf || page === pdf.numPages || loading} onClick={() => { setPage(page + 1); setSelected(null); }}><ChevronRight /></Button>
          </div>
          <Button variant="pdf" onClick={addText} disabled={loading || !!error}><Plus /> Add text box</Button>
          {active && <>
            <div className="space-y-1"><Label htmlFor="pdf-text-content">Text</Label><Textarea id="pdf-text-content" autoFocus value={active.text} onChange={(e) => update({ text: e.target.value })} rows={3} /></div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1"><Label htmlFor="pdf-text-size">Size (pt)</Label><Input id="pdf-text-size" type="number" min={6} max={96} value={active.size} onChange={(e) => update({ size: Math.max(6, Math.min(96, Number(e.target.value) || 6)) })} /></div>
              <Button variant={active.bold ? "pdf" : "outline"} size="icon" title="Bold" aria-label="Bold" aria-pressed={active.bold} onClick={() => update({ bold: !active.bold })}><Bold /></Button>
              <Button variant={active.italic ? "pdf" : "outline"} size="icon" title="Italic" aria-label="Italic" aria-pressed={active.italic} onClick={() => update({ italic: !active.italic })}><Italic /></Button>
            </div>
            <div className="flex gap-2">{palette.map(({ id, label }) => <Button key={id} size="icon" variant="outline" aria-label={`${label} text`} title={label} aria-pressed={active.color === id} className={active.color === id ? "ring-2 ring-pdf-accent" : ""} onClick={() => update({ color: id })}><span className={`h-4 w-4 rounded-full bg-pdf-text-${id}`} /></Button>)}</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label htmlFor="pdf-text-x">X (pt)</Label><Input id="pdf-text-x" type="number" min={0} max={Math.floor(dimensions.width)} value={Math.round(active.x)} onChange={(e) => update({ x: Math.max(0, Math.min(dimensions.width - 10, Number(e.target.value) || 0)) })} /></div>
              <div><Label htmlFor="pdf-text-y">Y (pt)</Label><Input id="pdf-text-y" type="number" min={0} max={Math.floor(dimensions.height)} value={Math.round(active.y)} onChange={(e) => update({ y: Math.max(0, Math.min(dimensions.height - active.size, Number(e.target.value) || 0)) })} /></div>
            </div>
            <Button variant="outline" onClick={() => { setEntries((current) => current.filter((entry) => entry.id !== selected)); setSelected(null); }}><Trash2 /> Remove text box</Button>
          </>}
          <div className="space-y-1">{entries.filter((entry) => entry.page === page).map((entry, i) => <Button key={entry.id} className="w-full justify-start" variant={entry.id === selected ? "secondary" : "ghost"} onClick={() => setSelected(entry.id)}><span className="truncate">{entry.text || `Text box ${i + 1}`}</span></Button>)}</div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted p-4">
          {loading && <div className="flex items-center gap-2 p-3"><Loader2 className="animate-spin" /> Loading page…</div>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="relative mx-auto w-full max-w-[900px] overflow-hidden" style={{ aspectRatio: dimensions.width ? `${dimensions.width}/${dimensions.height}` : undefined }}>
            <canvas ref={canvas} className={`block w-full ${loading || error ? "invisible" : ""}`} />
            {!loading && !error && dimensions.width > 0 && <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="absolute inset-0 h-full w-full touch-none" aria-label="PDF text placement" onPointerMove={(e) => {
              const moving = drag.current;
              if (!moving) return;
              const bounds = e.currentTarget.getBoundingClientRect();
              setEntries((current) => current.map((entry) => entry.id === moving.id ? { ...entry,
                x: Math.max(0, Math.min(dimensions.width - 10, moving.x + (e.clientX - moving.startX) * dimensions.width / bounds.width)),
                y: Math.max(0, Math.min(dimensions.height - entry.size, moving.y + (e.clientY - moving.startY) * dimensions.height / bounds.height)),
              } : entry));
            }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
              {entries.filter((entry) => entry.page === page).map((entry) => <g key={entry.id} aria-label={`Text box: ${entry.text || "empty"}`} className={`cursor-move fill-pdf-text-${entry.color}`} transform={`translate(${entry.x},${entry.y})`} onPointerDown={(e) => {
                if (saving) return;
                setSelected(entry.id);
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: entry.id, x: entry.x, y: entry.y, startX: e.clientX, startY: e.clientY };
              }}>
                <rect x={-3} y={0} width={Math.max(80, ...entry.text.split(/\r?\n/).map((line) => line.length * entry.size * 0.7))} height={entry.size * 1.2 * Math.max(1, entry.text.split(/\r?\n/).length) + 4} className={entry.id === selected ? "fill-pdf-accent/5 stroke-pdf-accent" : "fill-transparent"} strokeDasharray="3 3" strokeWidth={1} />
                <text fontFamily="Arial, Helvetica, sans-serif" fontSize={entry.size} fontWeight={entry.bold ? "bold" : "normal"} fontStyle={entry.italic ? "italic" : "normal"}>{(entry.text || "Text").split(/\r?\n/).map((line, i) => <tspan key={i} x={0} y={entry.size + i * entry.size * 1.2}>{line}</tspan>)}</text>
              </g>)}
            </svg>}
          </div>
        </main>
      </div>
    </div>
  );
}