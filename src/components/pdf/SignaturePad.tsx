import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };
const W = 1000;
const H = 320;

// Crop the drawing to its ink so placement on the PDF matches what the user sees.
function exportTrimmed(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext("2d")!;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[] | null>(null);
  const [count, setCount] = useState(0);

  const redraw = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    for (const s of strokes.current) {
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y);
      for (const p of s.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  useEffect(redraw, []);

  const emit = () => {
    setCount(strokes.current.length);
    onChange(strokes.current.length ? exportTrimmed(canvasRef.current!) : null);
  };

  // Map screen pixels to canvas pixels (the canvas is scaled by CSS).
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    current.current = [pos(e)];
    strokes.current.push(current.current);
    redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    current.current.push(pos(e));
    redraw();
  };
  const end = () => {
    if (!current.current) return;
    current.current = null;
    emit();
  };
  const undo = () => {
    strokes.current.pop();
    redraw();
    emit();
  };
  const clear = () => {
    strokes.current = [];
    redraw();
    emit();
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="aspect-[25/8] w-full touch-none rounded-md border border-emerald-200 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="flex items-center justify-between text-xs text-emerald-700/70">
        <span>Draw your signature above</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={undo} type="button" disabled={count === 0}>
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <Button size="sm" variant="outline" onClick={clear} type="button" disabled={count === 0}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
