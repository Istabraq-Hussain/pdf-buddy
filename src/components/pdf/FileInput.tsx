import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileInput({
  multiple = false,
  accept = "application/pdf",
  onFiles,
  label = "Choose files",
}: {
  multiple?: boolean;
  accept?: string;
  onFiles: (files: File[]) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function handle(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    setFiles(arr);
    onFiles(arr);
  }
  function clear() {
    setFiles([]);
    onFiles([]);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handle(e.dataTransfer.files);
        }}
        className="cursor-pointer rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-center text-sm text-emerald-700 hover:bg-emerald-50"
      >
        <Upload className="mx-auto mb-1 h-5 w-5" />
        {label}
        <div className="text-xs text-emerald-600/70">or drop here</div>
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-900"
            >
              <span className="truncate">{f.name}</span>
              <span className="ml-2 shrink-0 text-emerald-700/70">
                {(f.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={clear} className="h-6 text-xs">
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}
    </div>
  );
}
