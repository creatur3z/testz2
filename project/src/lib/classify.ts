import type { AssetCategory } from "@/types";

export function extractSequence(filename: string): number | null {
  const base = filename.split("/").pop() ?? filename;
  const match = base.match(/(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function classifyFile(filename: string): AssetCategory {
  const lower = filename.toLowerCase();
  const base = lower.split("/").pop() ?? lower;

  if (base.endsWith(".css")) return "css";

  if (!base.endsWith(".html") && !base.endsWith(".htm")) return "css";

  if (base.includes("announcement") || base.includes("notice")) return "announcements";
  if (base.includes("hero") || base.includes("banner")) return "banners";
  if (base.includes("footer")) return "footers";

  return "collections";
}

export function sortReverseSequence<T extends { sequence: number | null; name: string }>(
  files: T[],
): T[] {
  return [...files].sort((a, b) => {
    const sa = a.sequence ?? 0;
    const sb = b.sequence ?? 0;
    if (sb !== sa) return sb - sa;
    return b.name.localeCompare(a.name);
  });
}

export function isHtml(filename: string): boolean {
  const f = filename.toLowerCase();
  return f.endsWith(".html") || f.endsWith(".htm");
}

export function isCss(filename: string): boolean {
  return filename.toLowerCase().endsWith(".css");
}
