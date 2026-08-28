import JSZip from "jszip";
import type { AssetFile, AssetCategory } from "@/types";
import { classifyFile, extractSequence, isHtml, isCss } from "./classify";

export interface ProcessedFile {
  file: AssetFile;
  duplicate: boolean;
}

export interface ProcessResult {
  files: ProcessedFile[];
  counts: {
    total: number;
    banners: number;
    announcements: number;
    footers: number;
    collections: number;
    css: number;
    duplicates: number;
  };
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeAsset(
  name: string,
  content: string,
  source: "zip" | "individual",
): AssetFile {
  const category: AssetCategory = classifyFile(name);
  return {
    id: uid(),
    name,
    originalName: name,
    category,
    content,
    size: content.length,
    sequence: extractSequence(name),
    uploadedAt: Date.now(),
    source,
    published: false,
    publishedAt: null,
  };
}

export async function processZipFile(
  file: File,
  onProgress?: (pct: number, label: string) => void,
): Promise<ProcessResult> {
  onProgress?.(5, "Reading ZIP...");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && !e.name.startsWith("__MACOSX"),
  );

  const htmlCssEntries = entries.filter((e) => {
    if (!isHtml(e.name) && !isCss(e.name)) return false;
    // Never process index.html as a standalone asset — it would be
    // classified as "collections" and uploaded as a single Collection.
    const base = e.name.split("/").pop()?.toLowerCase() ?? "";
    if (base === "index.html" || base === "index.htm") return false;
    return true;
  });

  const processed: ProcessedFile[] = [];
  const seen = new Set<string>();
  let i = 0;
  const total = htmlCssEntries.length || 1;

  for (const entry of htmlCssEntries) {
    const baseName = entry.name.split("/").pop() ?? entry.name;
    const content = await entry.async("string");
    const asset = makeAsset(baseName, content, "zip");
    const dup = seen.has(baseName.toLowerCase());
    seen.add(baseName.toLowerCase());
    processed.push({ file: asset, duplicate: dup });
    i++;
    onProgress?.(Math.round(5 + (i / total) * 90), `Extracting ${baseName}`);
  }

  onProgress?.(100, "Done");
  return finalize(processed);
}

export function processIndividualFiles(files: File[]): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const processed: ProcessedFile[] = [];
    const seen = new Set<string>();
    let done = 0;
    const total = files.length || 1;

    if (files.length === 0) {
      resolve(finalize([]));
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? "");
        const asset = makeAsset(file.name, content, "individual");
        const dup = seen.has(file.name.toLowerCase());
        seen.add(file.name.toLowerCase());
        processed.push({ file: asset, duplicate: dup });
        done++;
        if (done === files.length) {
          resolve(finalize(processed));
        }
      };
      reader.onerror = () => {
        done++;
        if (done === files.length) resolve(finalize(processed));
      };
      reader.readAsText(file);
    });
  });
}

function finalize(processed: ProcessedFile[]): ProcessResult {
  const counts = {
    total: processed.length,
    banners: 0,
    announcements: 0,
    footers: 0,
    collections: 0,
    css: 0,
    duplicates: 0,
  };
  for (const p of processed) {
    if (p.duplicate) counts.duplicates++;
    counts[p.file.category]++;
  }
  return { files: processed, counts };
}
