import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { ToastContainer } from "@/components/ToastContainer";
import { Sidebar, MobileMenuButton, type ViewId } from "@/components/Sidebar";
import { DashboardView } from "@/components/DashboardView";
import { StoreSearchView } from "@/components/StoreSearchView";
import { AssetSectionView } from "@/components/AssetSectionView";
import { HistoryView, ExportImportBar } from "@/components/HistoryView";
import { PreviewModal } from "@/components/PreviewModal";
import type { AssetFile, AssetCategory, Store, ShoopyConfig, ApiLogEntry, UploadHistoryEntry, PublishHistoryEntry } from "@/types";
import { loadConfig, saveConfig } from "@/lib/config";
import {
  loadAssets,
  saveAssets,
  loadHistory,
  addHistoryEntry,
  clearAllAssets,
  getAllNames,
  exportAssetsAsJson,
  importAssetsFromJson,
  loadPublishHistory,
  addPublishHistoryEntry,
  clearPublishHistory,
  type StoredAssets,
} from "@/lib/storage";
import { processZipFile, processIndividualFiles, type ProcessResult } from "@/lib/zip-handler";
import { downloadJson } from "@/lib/download";
import {
  publishBanner,
  publishAnnouncement,
  publishFooter,
  publishCollection,
  publishCss,
} from "@/lib/shoopy";
import { processThemeZip, type ThemeZipResult } from "@/lib/theme-zip-processor";
import JSZip from "jszip";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_PREVIEW_TOGGLES = {
  banners: false,
  announcements: false,
  footers: false,
  collections: false,
  css: false,
};

function DashboardInner() {
  const { notify } = useToast();

  const [view, setView] = useState<ViewId>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assets, setAssets] = useState<StoredAssets>(() => loadAssets());
  const [history, setHistory] = useState<UploadHistoryEntry[]>(() => loadHistory());
  const [publishHistory, setPublishHistory] = useState<PublishHistoryEntry[]>(() => loadPublishHistory());
  const [config, setConfig] = useState<ShoopyConfig>(() => loadConfig());
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const [previewFile, setPreviewFile] = useState<AssetFile | null>(null);
  const [renameFile, setRenameFile] = useState<AssetFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [publishLogs, setPublishLogs] = useState<ApiLogEntry[]>([]);

  const previewToggles = config.previewToggles ?? DEFAULT_PREVIEW_TOGGLES;

  const setPreviewToggle = useCallback(
    (cat: AssetCategory, value: boolean) => {
      const next = { ...previewToggles, [cat]: value };
      const newConfig = { ...config, previewToggles: next };
      setConfig(newConfig);
      saveConfig(newConfig);
    },
    [config, previewToggles],
  );

  const handleConfigChange = useCallback(
    (c: ShoopyConfig) => {
      setConfig(c);
      saveConfig(c);
    },
    [],
  );

  // Persist assets
  useEffect(() => {
    saveAssets(assets);
  }, [assets]);

  const counts = useMemo(
    () => ({
      dashboard: 0,
      search: 0,
      banners: assets.banners.length,
      announcements: assets.announcements.length,
      footers: assets.footers.length,
      collections: assets.collections.length,
      css: assets.css.length,
      history: publishHistory.length,
    }),
    [assets, publishHistory],
  );

  const handleLog = useCallback((entry: ApiLogEntry) => {
    setPublishLogs((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  const publishFile = useCallback(
    async (f: AssetFile): Promise<boolean> => {
      if (!selectedStore) {
        notify("Please search and select a store first", "warning");
        setView("search");
        return false;
      }
      setPublishingIds((prev) => new Set(prev).add(f.id));
      try {
        const storeId = selectedStore.store_id;
        const orgId = selectedStore.store_users?.[0]?.org_id ?? 0;
        const slug = selectedStore.slug;
        const storeName = selectedStore.store_name;

        if (f.category === "banners") {
          await publishBanner(storeId, f, config, handleLog);
        } else if (f.category === "announcements") {
          await publishAnnouncement(slug, f, config, handleLog);
        } else if (f.category === "footers") {
          await publishFooter(slug, f, config, handleLog);
        } else if (f.category === "collections") {
          await publishCollection(orgId, storeId, f, config, handleLog);
        } else if (f.category === "css") {
          await publishCss(orgId, f, config, handleLog);
        }

        setAssets((prev) => {
          const update = (arr: AssetFile[]) =>
            arr.map((x) => (x.id === f.id ? { ...x, published: true, publishedAt: Date.now() } : x));
          return {
            banners: update(prev.banners),
            announcements: update(prev.announcements),
            footers: update(prev.footers),
            collections: update(prev.collections),
            css: update(prev.css),
          };
        });

        const entry: PublishHistoryEntry = {
          id: uid(),
          timestamp: Date.now(),
          storeName,
          storeSlug: slug,
          category: f.category,
          fileName: f.name,
          status: "uploaded",
        };
        const updated = addPublishHistoryEntry(entry);
        setPublishHistory(updated);

        return true;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Publishing failed";
        const entry: PublishHistoryEntry = {
          id: uid(),
          timestamp: Date.now(),
          storeName: selectedStore.store_name,
          storeSlug: selectedStore.slug,
          category: f.category,
          fileName: f.name,
          status: "failed",
          error: errMsg,
        };
        const updated = addPublishHistoryEntry(entry);
        setPublishHistory(updated);
        notify(errMsg, "error");
        return false;
      } finally {
        setPublishingIds((prev) => {
          const next = new Set(prev);
          next.delete(f.id);
          return next;
        });
      }
    },
    [selectedStore, config, notify, handleLog],
  );

  const ingestFiles = useCallback(
    async (result: ProcessResult, sourceName: string, source: "zip" | "individual") => {
      const existingNames = getAllNames(assets);
      const addedFiles: AssetFile[] = [];
      let duplicates = 0;

      setAssets((prev) => {
        const next: StoredAssets = {
          banners: [...prev.banners],
          announcements: [...prev.announcements],
          footers: [...prev.footers],
          collections: [...prev.collections],
          css: [...prev.css],
        };
        for (const pf of result.files) {
          const isDup = existingNames.has(pf.file.name.toLowerCase()) || pf.duplicate;
          if (isDup) {
            duplicates++;
            continue;
          }
          existingNames.add(pf.file.name.toLowerCase());
          next[pf.file.category].push(pf.file);
          addedFiles.push(pf.file);
        }
        return next;
      });

      const entry: UploadHistoryEntry = {
        id: uid(),
        timestamp: Date.now(),
        source,
        fileName: sourceName,
        totalFiles: result.counts.total,
        banners: result.counts.banners,
        announcements: result.counts.announcements,
        footers: result.counts.footers,
        collections: result.counts.collections,
        css: result.counts.css,
        duplicates,
      };
      const updatedHistory = addHistoryEntry(entry);
      setHistory(updatedHistory);

      const added = addedFiles.length;
      if (added > 0) {
        notify(
          `Uploaded ${added} file${added !== 1 ? "s" : ""} — ${result.counts.banners} banners, ${result.counts.announcements} announcements, ${result.counts.footers} footers, ${result.counts.collections} collections, ${result.counts.css} CSS`,
          "success",
        );
      }
      if (duplicates > 0) {
        notify(`${duplicates} duplicate file${duplicates !== 1 ? "s" : ""} skipped`, "warning");
      }

      // Auto-upload files that don't have preview toggle enabled
      if (selectedStore) {
        for (const f of addedFiles) {
          if (!previewToggles[f.category]) {
            await publishFile(f);
          }
        }
      } else {
        notify("Select a store in Store Search to enable auto-upload", "info");
      }
    },
    [assets, notify, selectedStore, previewToggles, publishFile],
  );

  const handleZip = useCallback(
    async (file: File) => {
      setBusy(true);
      setProgress(0);
      setProgressLabel("Processing ZIP...");
      try {
        // Check if this is a theme ZIP (contains index.html)
        const zip = await JSZip.loadAsync(file);
        const hasIndexHtml = Object.values(zip.files).some((e) => {
          if (e.dir || e.name.startsWith("__MACOSX")) return false;
          const base = e.name.split("/").pop()?.toLowerCase() ?? "";
          return base === "index.html" || base === "index.htm";
        });

        if (hasIndexHtml && !selectedStore) {
          notify("A theme ZIP (containing index.html) was detected. Please search and select a store first, then re-upload the ZIP.", "warning");
          setView("search");
        } else if (hasIndexHtml && selectedStore) {
          const result: ThemeZipResult = await processThemeZip(
            file,
            selectedStore,
            config,
            handleLog,
            (pct, label) => {
              setProgress(pct);
              setProgressLabel(label);
            },
          );

          if (result.isThemeZip) {
            const failedImages = result.images.failedFiles;
            const failedSections = result.sections.filter((s) => !s.uploaded);
            const missingImages = result.images.missingFiles;
            const hasErrors = failedImages.length > 0 || failedSections.length > 0 || !result.css.uploaded;

            if (hasErrors || missingImages.length > 0) {
              let msg = `ZIP Processing Completed With Errors\n\nImages referenced: ${result.images.referenced}\nImages uploaded: ${result.images.uploaded}/${result.images.referenced}\nImages skipped (not referenced): ${result.images.skipped}\nHTML Sections: ${result.sections.filter((s) => s.uploaded).length}/${result.sections.length} uploaded\ntheme.css: ${result.css.uploaded ? "Uploaded" : "Failed"}`;
              if (failedImages.length > 0) msg += `\n\nFailed images:\n- ${failedImages.join("\n- ")}`;
              if (missingImages.length > 0) msg += `\n\nMissing referenced images:\n- ${missingImages.join("\n- ")}`;
              if (failedSections.length > 0) msg += `\n\nFailed sections:\n- ${failedSections.map((s) => s.file.name).join("\n- ")}`;
              if (result.css.error) msg += `\n\nCSS error: ${result.css.error}`;
              notify(msg, "warning");
            } else {
              notify(
                `Theme ZIP processed successfully — Images: ${result.images.uploaded}/${result.images.referenced} (skipped ${result.images.skipped} unused), HTML sections: ${result.sections.length}, theme.css: uploaded`,
                "success",
              );
            }

            // Record publish history for each uploaded section
            for (const s of result.sections) {
              const entry: PublishHistoryEntry = {
                id: uid(),
                timestamp: Date.now(),
                storeName: selectedStore.store_name,
                storeSlug: selectedStore.slug,
                category: s.file.category,
                fileName: s.file.name,
                status: s.uploaded ? "uploaded" : "failed",
                error: s.error,
              };
              const updated = addPublishHistoryEntry(entry);
              setPublishHistory(updated);
            }
            if (result.themeCssFile) {
              const entry: PublishHistoryEntry = {
                id: uid(),
                timestamp: Date.now(),
                storeName: selectedStore.store_name,
                storeSlug: selectedStore.slug,
                category: "css",
                fileName: "theme.css",
                status: result.css.uploaded ? "uploaded" : "failed",
                error: result.css.error,
              };
              const updated = addPublishHistoryEntry(entry);
              setPublishHistory(updated);
            }
          }
        } else {
          // Standard ZIP processing (no index.html or no store selected)
          const result = await processZipFile(file, (pct, label) => {
            setProgress(pct);
            setProgressLabel(label);
          });
          await ingestFiles(result, file.name, "zip");
        }
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to process ZIP", "error");
      } finally {
        setBusy(false);
        setProgress(0);
        setProgressLabel("");
      }
    },
    [ingestFiles, notify, selectedStore, config, handleLog],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setProgress(50);
      setProgressLabel("Reading files...");
      try {
        const result = await processIndividualFiles(files);
        await ingestFiles(result, files.length === 1 ? files[0].name : `${files.length} files`, "individual");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to process files", "error");
      } finally {
        setBusy(false);
        setProgress(0);
        setProgressLabel("");
      }
    },
    [ingestFiles, notify],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setAssets((prev) => {
        const next: StoredAssets = {
          banners: prev.banners.filter((f) => f.id !== id),
          announcements: prev.announcements.filter((f) => f.id !== id),
          footers: prev.footers.filter((f) => f.id !== id),
          collections: prev.collections.filter((f) => f.id !== id),
          css: prev.css.filter((f) => f.id !== id),
        };
        return next;
      });
      notify("File removed", "info");
    },
    [notify],
  );

  const handleRenameStart = useCallback((f: AssetFile) => {
    setRenameFile(f);
    setRenameValue(f.name);
  }, []);

  const handleRenameSave = useCallback(() => {
    if (!renameFile || !renameValue.trim()) {
      setRenameFile(null);
      return;
    }
    const newName = renameValue.trim();
    setAssets((prev) => {
      const update = (arr: AssetFile[]) =>
        arr.map((f) => (f.id === renameFile.id ? { ...f, name: newName } : f));
      return {
        banners: update(prev.banners),
        announcements: update(prev.announcements),
        footers: update(prev.footers),
        collections: update(prev.collections),
        css: update(prev.css),
      };
    });
    notify("File renamed", "success");
    setRenameFile(null);
  }, [renameFile, renameValue, notify]);

  const handlePreviewSave = useCallback(
    (content: string) => {
      if (!previewFile) return;
      setAssets((prev) => {
        const update = (arr: AssetFile[]) =>
          arr.map((f) => (f.id === previewFile.id ? { ...f, content, size: content.length } : f));
        return {
          banners: update(prev.banners),
          announcements: update(prev.announcements),
          footers: update(prev.footers),
          collections: update(prev.collections),
          css: update(prev.css),
        };
      });
      notify("File content updated", "success");
    },
    [previewFile, notify],
  );

  const handleExport = useCallback(() => {
    downloadJson(exportAssetsAsJson(assets), "shoopy-assets-export.json");
    notify("Assets exported as JSON", "success");
  }, [assets, notify]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const imported = importAssetsFromJson(text);
        setAssets(imported);
        saveAssets(imported);
        notify("Assets imported successfully", "success");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Import failed", "error");
      }
    },
    [notify],
  );

  const handleClearHistory = useCallback(() => {
    setPublishHistory([]);
    clearPublishHistory();
    notify("Publish history cleared", "info");
  }, [notify]);

  const handleClearAll = useCallback(() => {
    const cleared = clearAllAssets();
    setAssets(cleared);
    notify("All assets cleared", "info");
  }, [notify]);

  const handlePublish = useCallback(
    async (f: AssetFile) => {
      await publishFile(f);
      if (selectedStore) {
        notify(`Published ${f.name} to ${selectedStore.store_name}`, "success");
      }
    },
    [publishFile, selectedStore, notify],
  );

  const sectionProps = {
    onFiles: handleFiles,
    onZip: handleZip,
    busy,
    progress,
    progressLabel,
    allAssets: assets,
    previewToggles,
    onPreviewToggle: setPreviewToggle,
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        active={view}
        onNavigate={setView}
        counts={counts}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setMobileNavOpen(true)} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-sm capitalize">
                {view === "search" ? "Store Search" : view}
              </p>
              {selectedStore && view !== "search" && (
                <p className="text-xs text-slate-400">
                  Publishing to: <span className="font-medium text-brand-500">{selectedStore.store_name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "dashboard" && (
              <ExportImportBar onExport={handleExport} onImport={handleImport} />
            )}
            {view === "dashboard" && counts.banners + counts.announcements + counts.footers + counts.collections + counts.css > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-error-500 hover:bg-error-500/10 rounded-lg transition"
              >
                Clear All
              </button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
            {view === "dashboard" && (
              <DashboardView assets={assets} history={history} onNavigate={setView} />
            )}
            {view === "search" && (
              <StoreSearchView
                config={config}
                onConfigChange={handleConfigChange}
                onLog={handleLog}
                onStoreSelect={setSelectedStore}
                selectedStore={selectedStore}
                publishLogs={publishLogs}
              />
            )}
            {view === "banners" && (
              <AssetSectionView
                {...sectionProps}
                category="banners"
                title="Banners"
                description="HTML files containing 'hero' or 'banner' — sorted in reverse sequence order"
                files={assets.banners}
                onPreview={setPreviewFile}
                onRename={handleRenameStart}
                onRemove={handleRemove}
                onPublish={handlePublish}
                publishingIds={publishingIds}
              />
            )}
            {view === "announcements" && (
              <AssetSectionView
                {...sectionProps}
                category="announcements"
                title="Announcement Bar"
                description="HTML files containing 'announcement'"
                files={assets.announcements}
                onPreview={setPreviewFile}
                onRename={handleRenameStart}
                onRemove={handleRemove}
                onPublish={handlePublish}
                publishingIds={publishingIds}
              />
            )}
            {view === "footers" && (
              <AssetSectionView
                {...sectionProps}
                category="footers"
                title="Footer"
                description="HTML files containing 'footer' — sorted in reverse sequence order"
                files={assets.footers}
                onPreview={setPreviewFile}
                onRename={handleRenameStart}
                onRemove={handleRemove}
                onPublish={handlePublish}
                publishingIds={publishingIds}
              />
            )}
            {view === "collections" && (
              <AssetSectionView
                {...sectionProps}
                category="collections"
                title="Collection"
                description="Remaining HTML files — sorted in reverse sequence order"
                files={assets.collections}
                onPreview={setPreviewFile}
                onRename={handleRenameStart}
                onRemove={handleRemove}
                onPublish={handlePublish}
                publishingIds={publishingIds}
              />
            )}
            {view === "css" && (
              <AssetSectionView
                {...sectionProps}
                category="css"
                title="Custom CSS"
                description="All .css stylesheet files"
                files={assets.css}
                onPreview={setPreviewFile}
                onRename={handleRenameStart}
                onRemove={handleRemove}
                onPublish={handlePublish}
                publishingIds={publishingIds}
              />
            )}
            {view === "history" && <HistoryView history={publishHistory} onClear={handleClearHistory} />}
          </div>
        </main>
      </div>

      {/* Preview modal */}
      <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onSave={handlePreviewSave} />

      {/* Rename modal */}
      {renameFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setRenameFile(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Rename File</h3>
            </div>
            <div className="p-5">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameSave()}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setRenameFile(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">Cancel</button>
              <button onClick={handleRenameSave} className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-sm">Rename</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DashboardInner />
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  );
}
