import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileArchive, FileCode, Loader2 } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  onZip: (file: File) => void;
  busy: boolean;
  progress: number;
  progressLabel: string;
}

export function UploadZone({ onFiles, onZip, busy, progress, progressLabel }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    const others = files.filter((f) => !f.name.toLowerCase().endsWith(".zip"));

    if (zips.length > 0) {
      zips.forEach((z) => onZip(z));
    }
    if (others.length > 0) {
      onFiles(others);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 scale-[1.01]"
            : "border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition ${dragging ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
            {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadCloud className="w-7 h-7" />}
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {busy ? progressLabel : "Upload Theme ZIP or individual files"}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              Theme ZIPs with index.html are automatically processed and uploaded to the selected store
            </p>
          </div>

          {busy && progress > 0 && (
            <div className="w-full max-w-xs mt-2">
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1 text-center">{progress}%</p>
            </div>
          )}

          {!busy && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <button
                onClick={() => zipInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shadow-sm"
              >
                <FileArchive className="w-4 h-4" />
                Upload Theme ZIP
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
              >
                <FileCode className="w-4 h-4" />
                Upload Files
              </button>
            </div>
          )}
        </div>

        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onZip(f);
            e.target.value = "";
          }}
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".html,.htm,.css"
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) onFiles(fs);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
