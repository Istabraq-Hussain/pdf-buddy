import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Combine,
  Scissors,
  RotateCw,
  Trash2,
  ArrowUpDown,
  Image as ImageIcon,
  FileImage,
  Droplets,
  Hash,
  Minimize2,
  Type,
  Info,
  Download,
  Loader2,
  PenLine,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


import { FileInput } from "@/components/pdf/FileInput";
import { ToolCard } from "@/components/pdf/ToolCard";
import { SignaturePad } from "@/components/pdf/SignaturePad";
import {
  addPageNumbers,
  addWatermark,
  compressPdf,
  deletePages,
  download,
  extractEachPage,
  extractText,
  getPageCount,
  imagesToPdf,
  mergePdfs,
  pdfToImages,
  reorderPages,
  rotatePdf,
  setMetadata,
  signPdf,
  splitPdf,
} from "@/lib/pdf-tools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF24 Toolkit — Offline PDF tools" },
      {
        name: "description",
        content:
          "All-in-one offline PDF toolkit: merge, split, rotate, compress, watermark, convert and more. Runs entirely in your browser.",
      },
      { property: "og:title", content: "PDF24 Toolkit — Offline PDF tools" },
      {
        property: "og:description",
        content: "Merge, split, rotate, compress, watermark and convert PDFs — all offline.",
      },
    ],
  }),
  component: Index,
});

function useAction<T extends any[]>(fn: (...args: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (...args: T) => {
      setBusy(true);
      try {
        await fn(...args);
      } catch (e: any) {
        toast.error(e?.message ?? "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
  };
}

function RunButton({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <Button
      onClick={onClick}
      disabled={busy}
      className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {children}
    </Button>
  );
}

function Merge() {
  const [files, setFiles] = useState<File[]>([]);
  const a = useAction(async () => {
    if (files.length < 2) throw new Error("Select at least 2 PDFs.");
    const bytes = await mergePdfs(files);
    download(bytes, "merged.pdf");
    toast.success("Merged!");
  });
  return (
    <ToolCard icon={<Combine className="h-5 w-5" />} title="Merge PDFs" description="Combine several PDFs into one.">
      <FileInput multiple onFiles={setFiles} label="Select PDFs" />
      <RunButton onClick={() => a.run()} busy={a.busy}>Merge & download</RunButton>
    </ToolCard>
  );
}

function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("1-1");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await splitPdf(file, ranges);
    download(bytes, "split.pdf");
    toast.success("Split done!");
  });
  const b = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const parts = await extractEachPage(file);
    parts.forEach((p) => download(p.bytes, p.name));
    toast.success(`Exported ${parts.length} pages`);
  });
  return (
    <ToolCard icon={<Scissors className="h-5 w-5" />} title="Split PDF" description="Extract a range or every page.">
      <FileInput
        onFiles={async (fs) => {
          const f = fs[0] ?? null;
          setFile(f);
          if (f) setPageCount(await getPageCount(f));
          else setPageCount(null);
        }}
      />
      {pageCount !== null && <div className="text-xs text-emerald-700">{pageCount} pages</div>}
      <div>
        <Label className="text-xs">Pages (e.g. 1-3,5,7-9)</Label>
        <Input value={ranges} onChange={(e) => setRanges(e.target.value)} />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Extract range</RunButton>
      <Button
        variant="outline"
        disabled={b.busy}
        onClick={() => b.run()}
        className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      >
        {b.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Export every page separately
      </Button>
    </ToolCard>
  );
}

function Rotate() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [ranges, setRanges] = useState("");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await rotatePdf(file, angle, ranges);
    download(bytes, "rotated.pdf");
    toast.success("Rotated!");
  });
  return (
    <ToolCard icon={<RotateCw className="h-5 w-5" />} title="Rotate pages" description="Rotate all or selected pages.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <div className="flex gap-2">
        {([90, 180, 270] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={angle === v ? "default" : "outline"}
            onClick={() => setAngle(v)}
            className={angle === v ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {v}°
          </Button>
        ))}
      </div>
      <div>
        <Label className="text-xs">Pages (blank = all)</Label>
        <Input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1,3-5" />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Rotate & download</RunButton>
    </ToolCard>
  );
}

function DeleteTool() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    if (!ranges.trim()) throw new Error("Enter pages to remove.");
    const bytes = await deletePages(file, ranges);
    download(bytes, "trimmed.pdf");
    toast.success("Pages removed!");
  });
  return (
    <ToolCard icon={<Trash2 className="h-5 w-5" />} title="Delete pages" description="Remove specific pages.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <div>
        <Label className="text-xs">Pages to remove</Label>
        <Input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 2,4-6" />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Remove & download</RunButton>
    </ToolCard>
  );
}

function Reorder() {
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState("");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await reorderPages(file, order);
    download(bytes, "reordered.pdf");
    toast.success("Reordered!");
  });
  return (
    <ToolCard icon={<ArrowUpDown className="h-5 w-5" />} title="Reorder pages" description="Set a new page order.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <div>
        <Label className="text-xs">New order</Label>
        <Input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. 3,1,2,4" />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Reorder & download</RunButton>
    </ToolCard>
  );
}

function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const a = useAction(async () => {
    if (files.length === 0) throw new Error("Choose images.");
    const bytes = await imagesToPdf(files);
    download(bytes, "images.pdf");
    toast.success("PDF created!");
  });
  return (
    <ToolCard icon={<ImageIcon className="h-5 w-5" />} title="Images → PDF" description="JPG / PNG to a single PDF.">
      <FileInput multiple accept="image/png,image/jpeg" onFiles={setFiles} label="Select images" />
      <RunButton onClick={() => a.run()} busy={a.busy}>Create PDF</RunButton>
    </ToolCard>
  );
}

function PdfToImages() {
  const [file, setFile] = useState<File | null>(null);
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const imgs = await pdfToImages(file);
    imgs.forEach((i) => download(i.blob, i.name, "image/png"));
    toast.success(`Exported ${imgs.length} images`);
  });
  return (
    <ToolCard icon={<FileImage className="h-5 w-5" />} title="PDF → Images" description="Render each page as PNG.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <RunButton onClick={() => a.run()} busy={a.busy}>Export PNGs</RunButton>
    </ToolCard>
  );
}

function Watermark() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    if (!text.trim()) throw new Error("Enter watermark text.");
    const bytes = await addWatermark(file, text);
    download(bytes, "watermarked.pdf");
    toast.success("Watermark applied!");
  });
  return (
    <ToolCard icon={<Droplets className="h-5 w-5" />} title="Watermark" description="Diagonal text on every page.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <div>
        <Label className="text-xs">Text</Label>
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Apply & download</RunButton>
    </ToolCard>
  );
}

function PageNumbers() {
  const [file, setFile] = useState<File | null>(null);
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await addPageNumbers(file);
    download(bytes, "numbered.pdf");
    toast.success("Page numbers added!");
  });
  return (
    <ToolCard icon={<Hash className="h-5 w-5" />} title="Add page numbers" description="Footer number on every page.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <RunButton onClick={() => a.run()} busy={a.busy}>Add numbers</RunButton>
    </ToolCard>
  );
}

function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await compressPdf(file);
    download(bytes, "compressed.pdf");
    toast.success("Rewritten with object streams.");
  });
  return (
    <ToolCard icon={<Minimize2 className="h-5 w-5" />} title="Compress" description="Basic size optimization.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <RunButton onClick={() => a.run()} busy={a.busy}>Compress & download</RunButton>
    </ToolCard>
  );
}

function ExtractText() {
  const [file, setFile] = useState<File | null>(null);
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const text = await extractText(file);
    download(new Blob([text], { type: "text/plain" }), "extracted.txt", "text/plain");
    toast.success("Text extracted!");
  });
  return (
    <ToolCard icon={<Type className="h-5 w-5" />} title="Extract text" description="Save PDF text as .txt.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <RunButton onClick={() => a.run()} busy={a.busy}>Extract to .txt</RunButton>
    </ToolCard>
  );
}

function Metadata() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    const bytes = await setMetadata(file, { title, author, subject, keywords });
    download(bytes, "with-metadata.pdf");
    toast.success("Metadata updated!");
  });
  return (
    <ToolCard icon={<Info className="h-5 w-5" />} title="Edit metadata" description="Title, author, subject, keywords.">
      <FileInput onFiles={(fs) => setFile(fs[0] ?? null)} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input placeholder="Keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Save & download</RunButton>
    </ToolCard>
  );
}

function Sign() {
  const [file, setFile] = useState<File | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pos, setPos] = useState<"bottom-right" | "bottom-left" | "bottom-center">("bottom-right");
  const a = useAction(async () => {
    if (!file) throw new Error("Choose a PDF.");
    if (!sig) throw new Error("Draw your signature first.");
    const bytes = await signPdf(file, sig, { page, position: pos });
    download(bytes, "signed.pdf");
    toast.success("Signed!");
  });
  return (
    <ToolCard icon={<PenLine className="h-5 w-5" />} title="Sign PDF" description="Draw a signature and stamp it on a page.">
      <FileInput
        onFiles={async (fs) => {
          const f = fs[0] ?? null;
          setFile(f);
          setPageCount(f ? await getPageCount(f) : null);
        }}
      />
      {pageCount !== null && (
        <div className="text-xs text-emerald-700">{pageCount} pages</div>
      )}
      <SignaturePad onChange={setSig} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Page (0 = last)</Label>
          <Input
            type="number"
            min={0}
            value={page}
            onChange={(e) => setPage(parseInt(e.target.value || "0", 10))}
          />
        </div>
        <div>
          <Label className="text-xs">Position</Label>
          <select
            value={pos}
            onChange={(e) => setPos(e.target.value as typeof pos)}
            className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-center">Bottom center</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>
      </div>
      <RunButton onClick={() => a.run()} busy={a.busy}>Sign & download</RunButton>
    </ToolCard>
  );
}

const categories = [
  { id: "organize", label: "Organize", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { id: "convert", label: "Convert", icon: <ArrowRight className="h-3.5 w-3.5" /> },
  { id: "edit", label: "Edit", icon: <PenLine className="h-3.5 w-3.5" /> },
  { id: "optimize", label: "Optimize", icon: <Minimize2 className="h-3.5 w-3.5" /> },
];

function MiniToolbar() {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-emerald-100 bg-white/80 px-4 py-2 backdrop-blur md:mx-0 md:rounded-lg md:border">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <span className="hidden text-xs font-medium text-emerald-900 sm:inline whitespace-nowrap">Jump to:</span>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              document.getElementById(cat.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900 whitespace-nowrap"
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-800">
      {children}
    </h2>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <header className="border-b border-emerald-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-emerald-900">PDF24 Toolkit</h1>
              <p className="text-[11px] text-emerald-700/70">Runs offline in your browser</p>
            </div>
          </div>
          <span className="hidden text-xs text-emerald-700/70 sm:inline">
            Nothing leaves your device
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <MiniToolbar />

        <div id="organize">
          <SectionTitle>Organize</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Merge />
            <Split />
            <Reorder />
            <DeleteTool />
            <Rotate />
          </div>
        </div>

        <div id="convert">
          <SectionTitle>Convert</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ImagesToPdf />
            <PdfToImages />
            <ExtractText />
          </div>
        </div>

        <div id="edit">
          <SectionTitle>Edit</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Sign />
            <Watermark />
            <PageNumbers />
            <Metadata />
          </div>
        </div>

        <div id="optimize">
          <SectionTitle>Optimize</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Compress />
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-emerald-700/60">
          All processing happens locally. No uploads, no cloud, no tracking.
        </footer>
      </main>
    </div>
  );
}
