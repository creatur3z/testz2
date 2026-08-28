import JSZip from "jszip";
import type { AssetFile, AssetCategory, Store, ShoopyConfig, ApiLogEntry } from "@/types";
import { extractSequence } from "./classify";
import {
  uploadImageFile,
  publishBanner,
  publishAnnouncement,
  publishFooter,
  publishCollection,
  publishCss,
} from "./shoopy";

type LogCallback = (entry: ApiLogEntry) => void;
type ProgressCallback = (pct: number, label: string) => void;

export interface ThemeZipSectionResult {
  file: AssetFile;
  uploaded: boolean;
  error?: string;
}

export interface ThemeZipResult {
  isThemeZip: boolean;
  images: {
    total: number;
    referenced: number;
    uploaded: number;
    failed: number;
    skipped: number;
    failedFiles: string[];
    missingFiles: string[];
  };
  sections: ThemeZipSectionResult[];
  css: {
    uploaded: boolean;
    error?: string;
  };
  themeCssFile: AssetFile | null;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

// Keywords that identify non-section comments (developer notes, chrome, etc.)
const NON_SECTION_KEYWORDS = [
  "doctype", "encoding", "charset", "todo", "fixme", "note:", "developer",
  "build", "preview-only", "preview page", "preview chrome", "inline svg",
  "svg icon", "icon sprite", "accessibility", "if ie", "endif", "[if ",
  "end ", "eslint", "stylelint", "prettier", "webpack", "vite", "babel",
];

// Keywords that strongly indicate a section marker
const SECTION_KEYWORDS = [
  "tier a", "tier b", "tier c", "tier d",
  "hero", "banner", "header", "footer", "notice", "announcement",
  "category", "categories", "collection", "collections", "product",
  "products", "best seller", "bestseller", "new arrival", "featured",
  "promo", "video", "usp", "html renderer", "htmlrenderer",
  "storebanner", "bannercollection", "bannervideocollection",
  "productcategories", "largecategories", "productgridcollection",
  "largecollectioncard",
];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase().replace(/\\/g, "/");
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? normalized;
}

function getUniqueFilename(basename: string, used: Set<string>): string {
  const key = basename.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return basename;
  }
  const dot = basename.lastIndexOf(".");
  const name = dot > 0 ? basename.slice(0, dot) : basename;
  const ext = dot > 0 ? basename.slice(dot) : "";
  let i = 1;
  while (used.has(`${name}-${i}${ext}`.toLowerCase())) i++;
  const result = `${name}-${i}${ext}`;
  used.add(result.toLowerCase());
  return result;
}

function isExternalOrDataUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("//") ||
    lower.startsWith("data:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  );
}

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\.\\+/, "")
    .replace(/^\/+/, "");
}

function isImageExtension(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// ============================================================================
// IMAGE REFERENCE DETECTION & REPLACEMENT
// ============================================================================

function findReferencedImages(html: string): Set<string> {
  const refs = new Set<string>();

  const srcHrefRegex = /(?:src|href|poster)\s*=\s*(["'])([^"']+)\1/gi;
  let match;
  while ((match = srcHrefRegex.exec(html)) !== null) {
    const url = match[2];
    if (!isExternalOrDataUrl(url) && isImageExtension(url)) {
      refs.add(normalizePath(url));
    }
  }

  const srcsetRegex = /srcset\s*=\s*(["'])([^"']+)\1/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const value = match[2];
    const parts = value.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      const spaceIdx = trimmed.indexOf(" ");
      const url = spaceIdx > 0 ? trimmed.slice(0, spaceIdx) : trimmed;
      if (!isExternalOrDataUrl(url) && isImageExtension(url)) {
        refs.add(normalizePath(url));
      }
    }
  }

  const urlRegex = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[2];
    if (!isExternalOrDataUrl(url) && isImageExtension(url)) {
      refs.add(normalizePath(url));
    }
  }

  return refs;
}

function lookupUrl(
  url: string,
  pathMap: Map<string, string>,
  basenameMap: Map<string, string>,
): string | null {
  const normalized = url.trim();
  const stripped = normalizePath(normalized);

  if (pathMap.has(normalized)) return pathMap.get(normalized)!;
  if (pathMap.has(stripped)) return pathMap.get(stripped)!;

  const basename = normalized.split("/").pop() ?? normalized;
  if (basenameMap.has(basename)) return basenameMap.get(basename)!;

  const parts = stripped.split("/");
  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join("/");
    if (pathMap.has(suffix)) return pathMap.get(suffix)!;
  }

  return null;
}

function replaceImageReferences(
  content: string,
  pathMap: Map<string, string>,
  basenameMap: Map<string, string>,
): string {
  let result = content;

  result = result.replace(/srcset\s*=\s*(["'])([^"']+)\1/gi, (_match, quote, value) => {
    const parts = value.split(",").map((part: string) => {
      const trimmed = part.trim();
      const spaceIdx = trimmed.indexOf(" ");
      const url = spaceIdx > 0 ? trimmed.slice(0, spaceIdx) : trimmed;
      const descriptor = spaceIdx > 0 ? trimmed.slice(spaceIdx) : "";
      if (isExternalOrDataUrl(url)) return trimmed;
      const replacement = lookupUrl(url, pathMap, basenameMap);
      if (replacement) return replacement + descriptor;
      return trimmed;
    });
    return `srcset=${quote}${parts.join(", ")}${quote}`;
  });

  result = result.replace(/(\b(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi, (match, prefix, quote, url) => {
    if (isExternalOrDataUrl(url)) return match;
    const replacement = lookupUrl(url, pathMap, basenameMap);
    if (replacement) return `${prefix}${quote}${replacement}${quote}`;
    return match;
  });

  result = result.replace(/(url\(\s*)(["']?)([^"')]+)\2(\s*\))/gi, (match, prefix, quote, url, close) => {
    if (isExternalOrDataUrl(url)) return match;
    const replacement = lookupUrl(url, pathMap, basenameMap);
    if (replacement) return `${prefix}${quote}${replacement}${quote}${close}`;
    return match;
  });

  return result;
}

// ============================================================================
// CSS EXTRACTION
// ============================================================================

function extractInlineCss(html: string): { css: string; html: string } {
  const fragments: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    fragments.push(match[1].trim());
  }
  const cleanedHtml = html.replace(styleRegex, "").trim();
  return { css: fragments.join("\n\n"), html: cleanedHtml };
}

// ============================================================================
// BODY EXTRACTION
// ============================================================================

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  let result = html;
  result = result.replace(/<!DOCTYPE[^>]*>/gi, "");
  result = result.replace(/<\/?html[^>]*>/gi, "");
  result = result.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  result = result.replace(/<\/?head[^>]*>/gi, "");
  result = result.replace(/<\/?body[^>]*>/gi, "");
  result = result.replace(/<meta[^>]*>/gi, "");
  result = result.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
  result = result.replace(/<link[^>]*>/gi, "");
  result = result.replace(/<base[^>]*>/gi, "");
  return result.trim();
}

// ============================================================================
// UNIVERSAL SECTION DETECTION
// ============================================================================

interface DetectedSection {
  name: string;
  content: string;
  component: string | null;
  slug: string | null;
  tier: string | null;
  settings: string | null;
}

interface Marker {
  commentNode: Node;
  name: string;
  commentIndex: number;
}

// Strip decorative formatting (=====, -----, *****) from comment text
function stripDecorations(text: string): string {
  return text
    .replace(/={3,}/g, "")
    .replace(/-{3,}/g, "")
    .replace(/\*{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if a comment text looks like a section marker
function isSectionComment(commentText: string): boolean {
  const trimmed = commentText.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  for (const kw of NON_SECTION_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }

  if (/tier\s*[a-d]/i.test(trimmed)) return true;

  for (const kw of SECTION_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  const stripped = stripDecorations(trimmed);
  if (/^[A-Z][a-zA-Z0-9\s\-_]{2,40}$/.test(stripped)) return true;

  return false;
}

// Extract a human-readable section name from comment text
function extractSectionNameFromComment(commentText: string): string {
  const stripped = stripDecorations(commentText);

  const separatorMatch = stripped.match(/^(.+?)\s*[—–:·]\s*(.+)$/);
  if (separatorMatch) {
    const left = separatorMatch[1].trim();
    const right = separatorMatch[2].trim();

    if (/[A-Z][a-z]+[A-Z]/.test(right)) {
      return left;
    }
    if (/^tier\s*[a-d]$/i.test(left)) {
      return right;
    }
    return left;
  }

  return stripped;
}

// Extract component metadata from an HTML element
function extractComponentInfo(el: Element): {
  component: string | null;
  slug: string | null;
  tier: string | null;
  settings: string | null;
} {
  return {
    component: el.getAttribute("data-sx-component"),
    slug: el.getAttribute("data-sx-slug"),
    tier: el.getAttribute("data-sx-tier"),
    settings: el.getAttribute("data-sx-settings"),
  };
}

// Convert a component name or section name to a filename
function componentToFilename(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized ? `${normalized}.html` : "section.html";
}

// Check if an element is a valid theme section element
function isSectionElement(el: Element): boolean {
  if (el.hasAttribute("data-sx-component")) return true;
  if (el.hasAttribute("data-sx-slug")) return true;
  if (el.hasAttribute("data-sx-tier")) return true;
  return false;
}

// Split HTML using comment markers as boundaries
function splitByCommentMarkers(
  children: Node[],
  markers: Marker[],
): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const serializer = new XMLSerializer();

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const startIdx = marker.commentIndex + 1;
    const endIdx = i + 1 < markers.length ? markers[i + 1].commentIndex : children.length;

    const contentNodes: Node[] = [];
    for (let j = startIdx; j < endIdx; j++) {
      contentNodes.push(children[j]);
    }

    const contentHtml = contentNodes
      .map((n) => serializer.serializeToString(n))
      .join("\n")
      .trim();

    if (!contentHtml) continue;

    let component: string | null = null;
    let slug: string | null = null;
    let tier: string | null = null;
    let settings: string | null = null;

    for (const node of contentNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (isSectionElement(el)) {
          const info = extractComponentInfo(el);
          component = info.component;
          slug = info.slug;
          tier = info.tier;
          settings = info.settings;
          break;
        }
        const descendant = el.querySelector("[data-sx-component], [data-sx-slug], [data-sx-tier]");
        if (descendant) {
          const info = extractComponentInfo(descendant);
          component = info.component;
          slug = info.slug;
          tier = info.tier;
          settings = info.settings;
          break;
        }
      }
    }

    let filename: string;
    if (slug) {
      filename = slug.endsWith(".html") ? slug : `${slug}.html`;
    } else if (component) {
      filename = componentToFilename(component);
    } else {
      filename = componentToFilename(marker.name);
    }

    sections.push({
      name: filename,
      content: contentHtml,
      component,
      slug,
      tier,
      settings,
    });
  }

  return sections;
}

// Fallback: split by top-level elements with data-sx-component
function splitByComponentElements(root: HTMLElement): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const sectionEls = root.querySelectorAll(":scope > [data-sx-component], :scope > [data-sx-slug], :scope > [data-sx-tier]");

  console.log(`[HTML] data-sx-component elements found: ${sectionEls.length}`);

  sectionEls.forEach((el) => {
    const info = extractComponentInfo(el);
    let filename: string;
    if (info.slug) {
      filename = info.slug.endsWith(".html") ? info.slug : `${info.slug}.html`;
    } else if (info.component) {
      filename = componentToFilename(info.component);
    } else {
      filename = "section.html";
    }
    sections.push({
      name: filename,
      content: el.outerHTML,
      component: info.component,
      slug: info.slug,
      tier: info.tier,
      settings: info.settings,
    });
  });

  if (sections.length === 0) {
    const nestedEls = root.querySelectorAll("[data-sx-component], [data-sx-slug], [data-sx-tier]");
    console.log(`[HTML] Nested data-sx-component elements found: ${nestedEls.length}`);
    nestedEls.forEach((el) => {
      const info = extractComponentInfo(el);
      let filename: string;
      if (info.slug) {
        filename = info.slug.endsWith(".html") ? info.slug : `${info.slug}.html`;
      } else if (info.component) {
        filename = componentToFilename(info.component);
      } else {
        filename = "section.html";
      }
      sections.push({
        name: filename,
        content: el.outerHTML,
        component: info.component,
        slug: info.slug,
        tier: info.tier,
        settings: info.settings,
      });
    });
  }

  return sections;
}

// Main detection: two-stage with fallback
function detectSections(bodyHtml: string): DetectedSection[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${bodyHtml}</div>`, "text/html");
  const root = doc.getElementById("__root");
  if (!root) return [];

  const children = Array.from(root.childNodes);

  // Stage 1: Find comment markers
  const markers: Marker[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.COMMENT_NODE) {
      const text = node.nodeValue ?? "";
      if (isSectionComment(text)) {
        const name = extractSectionNameFromComment(text);
        markers.push({ commentNode: node, name, commentIndex: i });
      }
    }
  }

  console.log(`[HTML] Section comment markers found: ${markers.length}`);
  markers.forEach((m, idx) => {
    console.log(`  [Marker ${idx + 1}] "${m.name}" at child index ${m.commentIndex}`);
  });

  if (markers.length > 0) {
    return splitByCommentMarkers(children, markers);
  }

  // Fallback: No comment markers — use data-sx-component elements
  console.log("[HTML] No comment markers found. Falling back to data-sx-component detection...");
  return splitByComponentElements(root);
}

// ============================================================================
// COMPONENT-AWARE CLASSIFICATION
// ============================================================================

function classifySection(section: DetectedSection): AssetCategory {
  const nameLower = section.name.toLowerCase();
  const componentLower = (section.component ?? "").toLowerCase();
  const settingsLower = (section.settings ?? "").toLowerCase();
  const combined = `${nameLower} ${componentLower} ${settingsLower}`;

  if (
    combined.includes("notice") ||
    combined.includes("announcement") ||
    settingsLower === "notice"
  ) {
    return "announcements";
  }

  if (
    combined.includes("footer") ||
    settingsLower === "footer"
  ) {
    return "footers";
  }

  if (
    combined.includes("hero") ||
    combined.includes("banner") ||
    combined.includes("promo") ||
    combined.includes("video") ||
    componentLower === "storebanner" ||
    componentLower === "bannercollection" ||
    componentLower === "bannervideocollection"
  ) {
    return "banners";
  }

  if (
    combined.includes("categor") ||
    componentLower === "productcategoriesv2" ||
    componentLower === "largecategoriescardv1"
  ) {
    return "collections";
  }

  if (
    combined.includes("product") ||
    combined.includes("bestseller") ||
    combined.includes("best-seller") ||
    combined.includes("new-arrival") ||
    combined.includes("featured") ||
    componentLower === "productgridcollection" ||
    componentLower === "largecollectioncard"
  ) {
    return "collections";
  }

  if (componentLower === "htmlrenderer") {
    return "collections";
  }

  if (
    combined.includes("header") ||
    combined.includes("navbar") ||
    combined.includes("navigation")
  ) {
    return "collections";
  }

  if (combined.includes("usp")) {
    return "collections";
  }

  return "collections";
}

// ============================================================================
// FILE CREATION & UPLOAD
// ============================================================================

function makeAssetFile(name: string, content: string, category: AssetCategory): AssetFile {
  return {
    id: uid(),
    name,
    originalName: name,
    category,
    content,
    size: content.length,
    sequence: extractSequence(name),
    uploadedAt: Date.now(),
    source: "zip",
    published: false,
    publishedAt: null,
  };
}

async function uploadSection(
  file: AssetFile,
  store: Store,
  config: ShoopyConfig,
  onLog: LogCallback,
): Promise<void> {
  const storeId = store.store_id;
  const orgId = store.store_users?.[0]?.org_id ?? 0;
  const slug = store.slug;

  if (file.name.toLowerCase() === "index.html") {
    throw new Error("Original index.html cannot be uploaded during ZIP processing");
  }

  if (file.category === "banners") {
    await publishBanner(storeId, file, config, onLog);
  } else if (file.category === "announcements") {
    await publishAnnouncement(slug, file, config, onLog);
  } else if (file.category === "footers") {
    await publishFooter(slug, file, config, onLog);
  } else if (file.category === "collections") {
    await publishCollection(orgId, storeId, file, config, onLog);
  }
}

function validateSection(section: DetectedSection): void {
  const html = section.content;
  if (/<html[\s>]/i.test(html)) {
    throw new Error(`Section "${section.name}" contains <html> tag`);
  }
  if (/<head[\s>]/i.test(html)) {
    throw new Error(`Section "${section.name}" contains <head> tag`);
  }
  if (/<body[\s>]/i.test(html)) {
    throw new Error(`Section "${section.name}" contains <body> tag`);
  }
  if (/<style[\s>]/i.test(html)) {
    throw new Error(`Section "${section.name}" contains <style> tag — CSS should be in theme.css`);
  }
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

// Resolve duplicate filenames by appending -2, -3, etc.
function resolveDuplicateNames(sections: DetectedSection[]): DetectedSection[] {
  const usedNames = new Set<string>();
  return sections.map((s) => {
    const baseKey = s.name.toLowerCase();
    if (!usedNames.has(baseKey)) {
      usedNames.add(baseKey);
      return s;
    }
    const dot = s.name.lastIndexOf(".");
    const name = dot > 0 ? s.name.slice(0, dot) : s.name;
    const ext = dot > 0 ? s.name.slice(dot) : "";
    let i = 2;
    let newName = `${name}-${i}${ext}`;
    while (usedNames.has(newName.toLowerCase())) {
      i++;
      newName = `${name}-${i}${ext}`;
    }
    usedNames.add(newName.toLowerCase());
    return { ...s, name: newName };
  });
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

export async function processThemeZip(
  zipFile: File,
  store: Store,
  config: ShoopyConfig,
  onLog: LogCallback,
  onProgress: ProgressCallback,
): Promise<ThemeZipResult> {
  const emptyResult: ThemeZipResult = {
    isThemeZip: false,
    images: { total: 0, referenced: 0, uploaded: 0, failed: 0, skipped: 0, failedFiles: [], missingFiles: [] },
    sections: [],
    css: { uploaded: false },
    themeCssFile: null,
  };

  onProgress(5, "Reading ZIP...");
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && !e.name.startsWith("__MACOSX"),
  );

  console.log("[ZIP] File received");
  console.log(`[ZIP] Entries found: ${entries.length}`);
  console.log("[ZIP] All entries:", entries.map((e) => e.name));

  // Find index.html
  const indexEntries = entries.filter((e) => {
    const path = e.name.replace(/\\/g, "/").toLowerCase();
    return path === "index.html" || path === "index.htm" || path.endsWith("/index.html") || path.endsWith("/index.htm");
  });
  indexEntries.sort((a, b) => a.name.length - b.name.length);
  const indexEntry = indexEntries[0];
  console.log(`[ZIP] index.html: ${indexEntry?.name ?? "NOT FOUND"}`);

  if (!indexEntry) return emptyResult;

  // Find theme.css
  const themeCssEntries = entries.filter((e) => {
    const path = e.name.replace(/\\/g, "/").toLowerCase();
    return path === "theme.css" || path.endsWith("/theme.css");
  });
  themeCssEntries.sort((a, b) => a.name.length - b.name.length);
  const themeCssEntry = themeCssEntries[0];
  console.log(`[ZIP] theme.css: ${themeCssEntry?.name ?? "NOT FOUND"}`);

  // Find assets
  const assetEntries = entries.filter((e) => isImageFile(e.name));
  console.log(`[ZIP] assets found: ${assetEntries.length}`);

  // Read index.html
  onProgress(10, "Reading index.html...");
  const rawIndexHtml = await indexEntry.async("string");
  const indexHtml = stripBom(rawIndexHtml);
  console.log(`[HTML] index.html size: ${indexHtml.length}`);

  // Find all image references
  onProgress(15, "Detecting referenced images...");
  const referencedPaths = findReferencedImages(indexHtml);

  // Build image maps
  const allZipImages = entries.filter((e) => isImageFile(e.name));
  const zipImageMap = new Map<string, typeof allZipImages[0]>();
  const zipBasenameMap = new Map<string, typeof allZipImages[0]>();
  for (const entry of allZipImages) {
    const normalized = normalizePath(entry.name);
    zipImageMap.set(normalized, entry);
    zipImageMap.set(entry.name.replace(/\\/g, "/"), entry);
    zipBasenameMap.set(getBasename(entry.name), entry);
  }

  // Match referenced images to ZIP entries
  const imagesToUpload: { entry: typeof allZipImages[0]; refPath: string }[] = [];
  const missingImages: string[] = [];
  const usedZipPaths = new Set<string>();

  for (const refPath of referencedPaths) {
    let matchedEntry: typeof allZipImages[0] | undefined;
    if (zipImageMap.has(refPath)) matchedEntry = zipImageMap.get(refPath);
    if (!matchedEntry) {
      const parts = refPath.split("/");
      for (let i = 1; i < parts.length; i++) {
        const suffix = parts.slice(i).join("/");
        if (zipImageMap.has(suffix)) { matchedEntry = zipImageMap.get(suffix); break; }
      }
    }
    if (!matchedEntry) {
      const basename = refPath.split("/").pop() ?? refPath;
      if (zipBasenameMap.has(basename)) matchedEntry = zipBasenameMap.get(basename);
    }
    if (matchedEntry) {
      const zipPath = matchedEntry.name.replace(/\\/g, "/");
      if (!usedZipPaths.has(zipPath)) {
        usedZipPaths.add(zipPath);
        imagesToUpload.push({ entry: matchedEntry, refPath });
      }
    } else {
      missingImages.push(refPath);
    }
  }

  const skippedCount = allZipImages.length - imagesToUpload.length;

  // Upload referenced images
  const pathMap = new Map<string, string>();
  const basenameMap = new Map<string, string>();
  const usedBasenames = new Set<string>();
  const failedImages: string[] = [];
  let uploadedCount = 0;

  for (let i = 0; i < imagesToUpload.length; i++) {
    const { entry, refPath } = imagesToUpload[i];
    const originalBasename = getBasename(entry.name);
    const uploadName = getUniqueFilename(originalBasename, usedBasenames);
    const orgId = store.store_users?.[0]?.org_id ?? 0;

    onProgress(
      Math.round(20 + (i / Math.max(imagesToUpload.length, 1)) * 40),
      `Uploading images ${i + 1}/${imagesToUpload.length}...`,
    );

    try {
      const blob = await entry.async("blob");
      const clevupUrl = await uploadImageFile(blob, uploadName, orgId, config, onLog);
      pathMap.set(entry.name.replace(/\\/g, "/"), clevupUrl);
      pathMap.set(normalizePath(entry.name), clevupUrl);
      pathMap.set(refPath, clevupUrl);
      basenameMap.set(getBasename(entry.name), clevupUrl);
      uploadedCount++;
    } catch {
      failedImages.push(entry.name);
    }
  }

  // Extract inline CSS
  onProgress(63, "Extracting CSS...");
  const { css: extractedCss, html: htmlWithoutStyles } = extractInlineCss(indexHtml);

  // Read existing theme.css
  let existingCss = "";
  if (themeCssEntry) {
    existingCss = stripBom(await themeCssEntry.async("string"));
  }

  // Merge CSS
  onProgress(68, "Merging theme.css...");
  const mergedCss = [existingCss.trim(), extractedCss.trim()].filter(Boolean).join("\n\n");
  const finalCss = replaceImageReferences(mergedCss, pathMap, basenameMap);

  // Extract body content
  onProgress(72, "Splitting HTML...");
  const bodyContent = extractBodyContent(htmlWithoutStyles);
  const bodyWithUrls = replaceImageReferences(bodyContent, pathMap, basenameMap);

  // Detect sections using universal parser
  console.log("[HTML] Detecting sections...");
  let detectedSections = detectSections(bodyWithUrls);

  // Resolve duplicate filenames
  detectedSections = resolveDuplicateNames(detectedSections);

  console.log(`[HTML] Total sections detected: ${detectedSections.length}`);
  detectedSections.forEach((s, idx) => {
    console.log(`  [SECTION ${idx + 1}]`);
    console.log(`    name: ${s.name}`);
    console.log(`    slug: ${s.slug ?? "—"}`);
    console.log(`    component: ${s.component ?? "—"}`);
    console.log(`    tier: ${s.tier ?? "—"}`);
    console.log(`    type: ${classifySection(s)}`);
  });

  if (detectedSections.length === 0) {
    throw new Error(
      `No theme sections could be detected in index.html. ZIP upload cancelled.\n\n` +
      `ZIP index.html path: ${indexEntry.name}\n` +
      `Size: ${indexHtml.length} bytes\n\n` +
      `The parser looked for:\n` +
      `  - HTML comments containing section markers (Tier A/B/C, Hero, Banner, etc.)\n` +
      `  - Elements with data-sx-component attributes\n` +
      `  - Elements with data-sx-slug attributes\n\n` +
      `First 500 characters of body:\n${bodyWithUrls.slice(0, 500)}`,
    );
  }

  // Validate sections
  for (const section of detectedSections) {
    validateSection(section);
  }

  // Upload sections
  console.log("[UPLOAD]");
  const sectionResults: ThemeZipSectionResult[] = [];
  for (let i = 0; i < detectedSections.length; i++) {
    const section = detectedSections[i];
    const category = classifySection(section);
    const assetFile = makeAssetFile(section.name, section.content, category);

    onProgress(
      Math.round(75 + (i / Math.max(detectedSections.length, 1)) * 20),
      `Uploading HTML section ${i + 1}/${detectedSections.length}...`,
    );

    console.log(`[UPLOAD] ${section.name} → ${category}`);

    try {
      await uploadSection(assetFile, store, config, onLog);
      assetFile.published = true;
      assetFile.publishedAt = Date.now();
      sectionResults.push({ file: assetFile, uploaded: true });
    } catch (e) {
      sectionResults.push({
        file: assetFile,
        uploaded: false,
        error: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  console.log("[UPLOAD] index.html → SKIPPED");

  // Upload theme.css
  onProgress(97, "Uploading theme.css...");
  let cssUploaded = false;
  let cssError: string | undefined;
  let themeCssFile: AssetFile | null = null;

  if (finalCss.trim()) {
    themeCssFile = makeAssetFile("theme.css", finalCss, "css");
    console.log("[UPLOAD] theme.css → CSS API");
    try {
      await publishCss(store.store_users?.[0]?.org_id ?? 0, themeCssFile, config, onLog);
      themeCssFile.published = true;
      themeCssFile.publishedAt = Date.now();
      cssUploaded = true;
    } catch (e) {
      cssError = e instanceof Error ? e.message : "CSS upload failed";
    }
  }

  onProgress(100, "Completed");

  console.log("[RESULT]");
  console.log(`  Sections detected: ${detectedSections.length}`);
  console.log(`  HTML sections uploaded: ${sectionResults.filter((s) => s.uploaded).length}`);
  console.log(`  CSS uploaded: ${cssUploaded ? 1 : 0}`);
  console.log(`  Referenced images uploaded: ${uploadedCount}`);

  return {
    isThemeZip: true,
    images: {
      total: allZipImages.length,
      referenced: referencedPaths.size,
      uploaded: uploadedCount,
      failed: failedImages.length,
      skipped: skippedCount,
      failedFiles: failedImages,
      missingFiles: missingImages,
    },
    sections: sectionResults,
    css: { uploaded: cssUploaded, error: cssError },
    themeCssFile,
  };
}
