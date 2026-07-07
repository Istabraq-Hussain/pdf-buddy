import { useEffect, useMemo, useRef, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Placement = { xPct: number; yPct: number; widthPct: number };

export function SignaturePlacer({
  file,
  signatureDataUrl,
  onCancel,
  onConfirm,
}: {
  file: File;
  signatureDataUrl: string;
  onCancel: () => void;
  onConfirm: (result: { page: number; placement: Placement }) => void;
}) {
  const [pdf, setPdf] = useState<any>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pageCanvasSize, setPageCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Placement>({ xPct: 0.6, yPct: 0.85, widthPct: 0.3 });
  const [sigAspect, setSigAspect] = useState(0.3); // h/w
  const [loading, setLoading] = useState(true);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Signature aspect ratio
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSigAspect(img.height / img.width);
    img.src = signatureDataUrl;
  }, [signatureDataUrl]);

  // Load PDF + thumbs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const pdfjsLib: any = await import("pdfjs-dist");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      const data = new Uint8Array(await file.arrayBuffer());
      const loaded = await pdfjsLib.getDocument({ data }).promise;
      if (cancelled) return;
      setPdf(loaded);
      // thumbs
      const ths: string[] = [];
      for (let i = 1; i <= loaded.numPages; i++) {
        const p = await loaded.getPage(i);
        const vp = p.getViewport({ scale: 0.25 });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c }).promise;
        ths.push(c.toDataURL("image/png"));
        if (cancelled) return;
      }
      setThumbs(ths);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render selected page
  useEffect(() => {
    if (!pdf || !mainCanvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      const stageH = (stageRef.current?.clientHeight ?? 700) - 24;
      const stageW = (stageRef.current?.clientWidth ?? 900) - 24;
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(stageW / vp1.width, stageH / vp1.height);
      const vp = page.getViewport({ scale });
      const c = mainCanvasRef.current!;
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c }).promise;
      if (cancelled) return;
      setPageCanvasSize({ w: vp.width, h: vp.height });
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex]);

  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; box: Placement } | null>(null);

  const onPointerDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box: { ...box } };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !pageCanvasSize) return;
    const dx = (e.clientX - drag.current.startX) / pageCanvasSize.w;
    const dy = (e.clientY - drag.current.startY) / pageCanvasSize.h;
    if (drag.current.mode === "move") {
      const w = drag.current.box.widthPct;
      const h = w * sigAspect * (pageCanvasSize.w / pageCanvasSize.h);
      setBox({
        widthPct: w,
        xPct: Math.max(0, Math.min(1 - w, drag.current.box.xPct + dx)),
        yPct: Math.max(0, Math.min(1 - h, drag.current.box.yPct + dy)),
      });
    } else {
      const newW = Math.max(0.05, Math.min(1 - drag.current.box.xPct, drag.current.box.widthPct + dx));
      setBox({ ...drag.current.box, widthPct: newW });
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const sigStyle = useMemo(() => {
    if (!pageCanvasSize) return {};
    const wPx = box.widthPct * pageCanvasSize.w;
    const hPx = wPx * sigAspect;
    return {
      left: box.xPct * pageCanvasSize.w,
      top: box.yPct * pageCanvasSize.h,
      width: wPx,
      height: hPx,
    };
  }, [box, pageCanvasSize, sigAspect]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm text-white">
          <span className="font-semibold">Place signature</span>
          <span className="ml-3 text-white/60">
            Page {pageIndex + 1}{pdf ? ` of ${pdf.numPages}` : ""} — drag to move, corner to resize
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => onConfirm({ page: pageIndex + 1, placement: box })}
          >
            <Check className="h-4 w-4" /> Apply & download
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-32 shrink-0 overflow-y-auto border-r border-white/10 bg-slate-950/40 p-2">
          {loading && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-white/70" />}
          {thumbs.map((src, i) => (
            <button
              key={i}
              onClick={() => setPageIndex(i)}
              className={`mb-2 block w-full overflow-hidden rounded border-2 transition ${
                i === pageIndex ? "border-emerald-500" : "border-transparent hover:border-white/30"
              }`}
            >
              <img src={src} alt={`Page ${i + 1}`} className="w-full" />
              <div className="bg-black/40 py-0.5 text-center text-[10px] text-white">{i + 1}</div>
            </button>
          ))}
        </aside>

        <div
          ref={stageRef}
          className="relative flex flex-1 items-center justify-center overflow-auto p-3"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="relative shadow-2xl">
            <canvas ref={mainCanvasRef} className="block bg-white" />
            {pageCanvasSize && (
              <div
                className="absolute cursor-move select-none border-2 border-emerald-500/80 bg-emerald-500/5"
                style={sigStyle}
                onPointerDown={onPointerDown("move")}
              >
                <img
                  src={signatureDataUrl}
                  alt="Signature"
                  draggable={false}
                  className="pointer-events-none h-full w-full object-contain"
                />
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-emerald-500"
                  onPointerDown={onPointerDown("resize")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
