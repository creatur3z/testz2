import { useMemo } from "react";
import { Image, Megaphone, PanelBottom, LayoutGrid, Code2, FileArchive, ArrowRight, History as HistoryIcon } from "lucide-react";
import type { AssetCategory, UploadHistoryEntry } from "@/types";
import type { StoredAssets } from "@/lib/storage";
import type { ViewId } from "./Sidebar";

interface Props {
  assets: StoredAssets;
  history: UploadHistoryEntry[];
  onNavigate: (v: ViewId) => void;
}

export function DashboardView({ assets, history, onNavigate }: Props) {
  const total = useMemo(
    () => assets.banners.length + assets.announcements.length + assets.footers.length + assets.collections.length + assets.css.length,
    [assets],
  );

  const cards = [
    { id: "banners" as const, label: "Banners", icon: Image, count: assets.banners.length, color: "from-brand-500 to-brand-700", bg: "bg-brand-50 dark:bg-brand-950/30" },
    { id: "announcements" as const, label: "Announcement Bar", icon: Megaphone, count: assets.announcements.length, color: "from-warning-500 to-warning-600", bg: "bg-warning-500/10" },
    { id: "footers" as const, label: "Footer", icon: PanelBottom, count: assets.footers.length, color: "from-accent-500 to-accent-600", bg: "bg-accent-500/10" },
    { id: "collections" as const, label: "Collection", icon: LayoutGrid, count: assets.collections.length, color: "from-accent-500 to-accent-600", bg: "bg-accent-500/10" },
    { id: "css" as const, label: "Custom CSS", icon: Code2, count: assets.css.length, color: "from-success-500 to-success-600", bg: "bg-success-500/10" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Overview of your store theme assets
        </p>
      </div>

      {/* Total banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-10 -translate-x-10" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">Total Assets</p>
          <p className="text-5xl font-bold mt-1">{total}</p>
          <p className="text-sm text-white/70 mt-2">
            {total === 0 ? "Upload files to get started" : "Across all categories"}
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onNavigate(c.id as ViewId)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-700 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{c.count}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{c.label}</p>
            </button>
          );
        })}
      </div>

      {/* Recent uploads */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-slate-400" />
            Recent Uploads
          </h2>
          <button
            onClick={() => onNavigate("history")}
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            View all
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No uploads yet</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <FileArchive className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{h.fileName}</p>
                  <p className="text-xs text-slate-400">
                    {h.totalFiles} files · {new Date(h.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                  {h.banners > 0 && <span className="px-1.5 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-300 rounded">{h.banners} B</span>}
                  {h.announcements > 0 && <span className="px-1.5 py-0.5 bg-warning-500/10 text-warning-600 rounded">{h.announcements} A</span>}
                  {h.collections > 0 && <span className="px-1.5 py-0.5 bg-accent-500/10 text-accent-600 rounded">{h.collections} C</span>}
                  {h.css > 0 && <span className="px-1.5 py-0.5 bg-success-500/10 text-success-600 rounded">{h.css} CSS</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function categoryLabel(cat: AssetCategory): string {
  switch (cat) {
    case "banners": return "Banners";
    case "announcements": return "Announcement Bar";
    case "footers": return "Footer";
    case "collections": return "Collection";
    case "css": return "Custom CSS";
  }
}
