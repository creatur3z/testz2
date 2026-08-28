import { useMemo, useState } from "react";
import { Search as SearchIcon, Upload, FileX, Download, Package, Eye, Send } from "lucide-react";
import type { AssetFile, AssetCategory } from "@/types";
import { AssetCard } from "./AssetCard";
import { UploadZone } from "./UploadZone";
import { sortReverseSequence } from "@/lib/classify";
import { downloadJson } from "@/lib/download";
import type { StoredAssets } from "@/lib/storage";

interface Props {
  category: AssetCategory;
  title: string;
  description: string;
  files: AssetFile[];
  onPreview: (f: AssetFile) => void;
  onRename: (f: AssetFile) => void;
  onRemove: (id: string) => void;
  onPublish?: (f: AssetFile) => void;
  publishingIds?: Set<string>;
  onFiles: (files: File[]) => void;
  onZip: (file: File) => void;
  busy: boolean;
  progress: number;
  progressLabel: string;
  allAssets: StoredAssets;
  previewToggles: Record<AssetCategory, boolean>;
  onPreviewToggle: (cat: AssetCategory, value: boolean) => void;
}

export function AssetSectionView({
  category,
  title,
  description,
  files,
  onPreview,
  onRename,
  onRemove,
  onPublish,
  publishingIds,
  onFiles,
  onZip,
  busy,
  progress,
  progressLabel,
  allAssets,
  previewToggles,
  onPreviewToggle,
}: Props) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    if (category === "banners" || category === "collections" || category === "footers") {
      return sortReverseSequence(files);
    }
    return [...files].sort((a, b) => a.name.localeCompare(b.name));
  }, [files, category]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((f) => f.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const previewEnabled = previewToggles[category];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
          {files.length > 0 && (
            <button
              onClick={() => downloadJson(JSON.stringify({ [category]: files }, null, 2), `${category}-export.json`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Preview toggle */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => onPreviewToggle(category, !previewEnabled)}
            className={`relative w-10 h-5 rounded-full transition ${previewEnabled ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${previewEnabled ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Preview before upload
          </span>
        </label>
        <span className="text-xs text-slate-400">
          {previewEnabled
            ? "Files wait in queue — upload only after you confirm"
            : "Files auto-upload immediately after categorization"}
        </span>
      </div>

      {/* Upload */}
      <UploadZone onFiles={onFiles} onZip={onZip} busy={busy} progress={progress} progressLabel={progressLabel} />

      {/* Search */}
      {files.length > 0 && (
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search within these files..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
          />
        </div>
      )}

      {/* Files */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            {files.length === 0 ? <Upload className="w-7 h-7 text-slate-400" /> : <FileX className="w-7 h-7 text-slate-400" />}
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">
            {files.length === 0 ? "No files uploaded yet" : "No matching files"}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {files.length === 0 ? "Upload a ZIP or individual HTML/CSS files to get started" : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <AssetCard
              key={f.id}
              file={f}
              onPreview={() => onPreview(f)}
              onRename={() => onRename(f)}
              onRemove={() => onRemove(f.id)}
              onPublish={onPublish ? () => onPublish(f) : undefined}
              publishing={publishingIds?.has(f.id) ?? false}
            />
          ))}
        </div>
      )}

      {(category === "banners" || category === "collections" || category === "footers") && files.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Package className="w-3.5 h-3.5" />
          Files sorted in reverse sequence order (highest first)
        </div>
      )}
    </div>
  );
}
