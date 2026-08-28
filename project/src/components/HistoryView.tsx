import { useMemo, useState } from "react";
import { Trash2, History as HistoryIcon, Search, Filter, CheckCircle2, XCircle, PanelBottom, Image, Megaphone, LayoutGrid, Code2, Download, Upload } from "lucide-react";
import type { PublishHistoryEntry, AssetCategory } from "@/types";

interface Props {
  history: PublishHistoryEntry[];
  onClear: () => void;
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  banners: "Banners",
  announcements: "Announcement Bar",
  footers: "Footer",
  collections: "Collection",
  css: "Custom CSS",
};

const CATEGORY_ICONS: Record<AssetCategory, typeof Image> = {
  banners: Image,
  announcements: Megaphone,
  footers: PanelBottom,
  collections: LayoutGrid,
  css: Code2,
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function HistoryView({ history, onClear }: Props) {
  const [searchStore, setSearchStore] = useState("");
  const [searchSlug, setSearchSlug] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (searchStore && !h.storeName.toLowerCase().includes(searchStore.toLowerCase())) return false;
      if (searchSlug && !h.storeSlug.toLowerCase().includes(searchSlug.toLowerCase())) return false;
      if (filterCategory !== "all" && h.category !== filterCategory) return false;
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      return true;
    });
  }, [history, searchStore, searchSlug, filterCategory, filterStatus]);

  const stats = useMemo(() => {
    const uploaded = history.filter((h) => h.status === "uploaded").length;
    const failed = history.filter((h) => h.status === "failed").length;
    const stores = new Set(history.map((h) => h.storeSlug)).size;
    return { uploaded, failed, stores, total: history.length };
  }, [history]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Detailed record of every published file across all stores
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-error-500 hover:bg-error-500/10 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Summary stats */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Uploads" value={stats.total} icon={HistoryIcon} color="text-slate-600 dark:text-slate-300" bg="bg-slate-100 dark:bg-slate-800" />
          <StatCard label="Uploaded" value={stats.uploaded} icon={CheckCircle2} color="text-success-600" bg="bg-success-500/10" />
          <StatCard label="Failed" value={stats.failed} icon={XCircle} color="text-error-500" bg="bg-error-500/10" />
          <StatCard label="Stores" value={stats.stores} icon={Image} color="text-brand-500" bg="bg-brand-500/10" />
        </div>
      )}

      {/* Filters */}
      {history.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">
            <Filter className="w-4 h-4" />
            Filters
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchStore}
              onChange={(e) => setSearchStore(e.target.value)}
              placeholder="Search by store name..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchSlug}
              onChange={(e) => setSearchSlug(e.target.value)}
              placeholder="Search by slug..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Categories</option>
            <option value="banners">Banners</option>
            <option value="announcements">Announcement Bar</option>
            <option value="footers">Footer</option>
            <option value="collections">Collection</option>
            <option value="css">Custom CSS</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Status</option>
            <option value="uploaded">Uploaded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Table */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <HistoryIcon className="w-7 h-7 text-slate-400" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">No upload history yet</p>
          <p className="text-sm text-slate-400 mt-1">Publish files to start building your history</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-slate-400" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">No matching results</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Store Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Store Slug</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">File Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((h) => {
                const Icon = CATEGORY_ICONS[h.category];
                return (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatTime(h.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {h.storeName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {h.storeSlug}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <Icon className="w-3 h-3" />
                        {CATEGORY_LABELS[h.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate max-w-xs" title={h.fileName}>
                      {h.fileName}
                    </td>
                    <td className="px-4 py-3">
                      {h.status === "uploaded" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-success-600 bg-success-500/10 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-error-500 bg-error-500/10 rounded-md" title={h.error}>
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: typeof Image; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export function ExportImportBar({
  onExport,
  onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
      >
        <Download className="w-4 h-4" />
        Export JSON
      </button>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer">
        <Upload className="w-4 h-4" />
        Import JSON
        <input
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

