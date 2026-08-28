import { Eye, Pencil, Trash2, Download, Send, CheckCircle2 } from "lucide-react";
import type { AssetFile } from "@/types";
import { downloadAsset } from "@/lib/download";

interface Props {
  file: AssetFile;
  onPreview: () => void;
  onRename: () => void;
  onRemove: () => void;
  onPublish?: () => void;
  publishing?: boolean;
}

export function AssetCard({ file, onPreview, onRename, onRemove, onPublish, publishing }: Props) {
  const isCss = file.name.toLowerCase().endsWith(".css");

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-700 transition-all">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isCss ? "bg-accent-500/10 text-accent-600" : "bg-brand-500/10 text-brand-600 dark:text-brand-300"}`}>
          {isCss ? <span className="text-xs font-bold">CSS</span> : <span className="text-xs font-bold">HTML</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate" title={file.name}>
              {file.name}
            </p>
            {file.published && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-success-600 bg-success-500/10 rounded">
                <CheckCircle2 className="w-3 h-3" />
                Published
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{(file.size / 1024).toFixed(1)} KB</span>
            {file.sequence !== null && (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 font-mono">
                #{file.sequence}
              </span>
            )}
            <span className="capitalize">{file.source}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onPreview}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
        <button
          onClick={onRename}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Rename
        </button>
        <button
          onClick={onRemove}
          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-error-500 hover:bg-error-500/10 rounded-lg transition"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => downloadAsset(file)}
          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {onPublish && (
          <button
            onClick={onPublish}
            disabled={publishing}
            className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 rounded-lg transition disabled:opacity-50"
            title="Publish to store"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

