import type { AssetFile, AssetCategory, UploadHistoryEntry, PublishHistoryEntry } from "@/types";

const ASSETS_KEY = "shoopy_dashboard_assets";
const HISTORY_KEY = "shoopy_dashboard_history";

export interface StoredAssets {
  banners: AssetFile[];
  announcements: AssetFile[];
  footers: AssetFile[];
  collections: AssetFile[];
  css: AssetFile[];
}

const EMPTY: StoredAssets = {
  banners: [],
  announcements: [],
  footers: [],
  collections: [],
  css: [],
};

export function loadAssets(): StoredAssets {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAssets>;
      return {
        banners: parsed.banners ?? [],
        announcements: parsed.announcements ?? [],
        footers: parsed.footers ?? [],
        collections: parsed.collections ?? [],
        css: parsed.css ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY };
}

export function saveAssets(assets: StoredAssets): void {
  try {
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
  } catch (e) {
    console.warn("Failed to save assets to localStorage", e);
  }
}

export function loadHistory(): UploadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as UploadHistoryEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveHistory(history: UploadHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn("Failed to save history", e);
  }
}

export function addHistoryEntry(entry: UploadHistoryEntry): UploadHistoryEntry[] {
  const history = loadHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 100);
  saveHistory(trimmed);
  return trimmed;
}

const PUBLISH_HISTORY_KEY = "shoopy_publish_history";

export function loadPublishHistory(): PublishHistoryEntry[] {
  try {
    const raw = localStorage.getItem(PUBLISH_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as PublishHistoryEntry[];
  } catch (e) {
    console.warn("Failed to load publish history", e);
  }
  return [];
}

export function savePublishHistory(history: PublishHistoryEntry[]): void {
  try {
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn("Failed to save publish history", e);
  }
}

export function addPublishHistoryEntry(entry: PublishHistoryEntry): PublishHistoryEntry[] {
  const history = loadPublishHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 200);
  savePublishHistory(trimmed);
  return trimmed;
}

export function clearPublishHistory(): void {
  try {
    localStorage.removeItem(PUBLISH_HISTORY_KEY);
  } catch (e) {
    console.warn("Failed to clear publish history", e);
  }
}

export function clearAllAssets(): StoredAssets {
  saveAssets({ ...EMPTY });
  return { ...EMPTY };
}

export function getAllFiles(assets: StoredAssets): AssetFile[] {
  return [
    ...assets.banners,
    ...assets.announcements,
    ...assets.footers,
    ...assets.collections,
    ...assets.css,
  ];
}

export function getAllNames(assets: StoredAssets): Set<string> {
  const names = new Set<string>();
  for (const f of getAllFiles(assets)) names.add(f.name.toLowerCase());
  return names;
}

export function countByCategory(assets: StoredAssets): Record<AssetCategory, number> {
  return {
    banners: assets.banners.length,
    announcements: assets.announcements.length,
    footers: assets.footers.length,
    collections: assets.collections.length,
    css: assets.css.length,
  };
}

export function exportAssetsAsJson(assets: StoredAssets): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      assets,
    },
    null,
    2,
  );
}

export function importAssetsFromJson(jsonText: string): StoredAssets {
  const data = JSON.parse(jsonText);
  const assets = data.assets ?? data;
  return {
    banners: Array.isArray(assets.banners) ? assets.banners : [],
    announcements: Array.isArray(assets.announcements) ? assets.announcements : [],
    footers: Array.isArray(assets.footers) ? assets.footers : [],
    collections: Array.isArray(assets.collections) ? assets.collections : [],
    css: Array.isArray(assets.css) ? assets.css : [],
  };
}
