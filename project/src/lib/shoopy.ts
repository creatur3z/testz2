import type { ShoopyConfig, Store, ApiLogEntry, AssetFile } from "@/types";
import {
  getAgentToken,
  getOAuthToken,
  setOAuthToken,
  setAgentToken,
} from "./config";

export interface SearchParams {
  query: string;
  type: "phone" | "url";
}

export interface SearchResult {
  stores: Store[];
  raw: unknown;
}

type LogCallback = (entry: ApiLogEntry) => void;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loggedFetch(
  url: string,
  init: RequestInit,
  config: ShoopyConfig,
  phase: ApiLogEntry["phase"],
  onLog?: LogCallback,
): Promise<{ status: number; body: unknown; ok: boolean }> {
  const entry: ApiLogEntry = {
    id: uid(),
    timestamp: Date.now(),
    method: init.method ?? "GET",
    url,
    requestBody: init.body ? tryParseBody(init.body) : null,
    requestHeaders: headersToObject(init.headers),
    status: null,
    responseBody: null,
    ok: false,
    phase,
  };

  try {
    const res = await fetch(url, init);
    entry.status = res.status;
    const text = await res.text();
    entry.responseBody = tryParseText(text);
    entry.ok = res.ok;
    onLog?.(entry);
    return { status: res.status, body: entry.responseBody, ok: res.ok };
  } catch (e) {
    entry.error = e instanceof Error ? e.message : String(e);
    entry.ok = false;
    onLog?.(entry);
    throw e;
  }
}

function tryParseBody(body: BodyInit): unknown {
  if (typeof body === "string") return tryParseText(body);
  return "[binary body]";
}

function tryParseText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((v, k) => (obj[k] = v));
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [k, v] of headers) obj[k] = v;
    return obj;
  }
  return { ...headers };
}

export async function searchStores(
  params: SearchParams,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<SearchResult> {
  const token = getAgentToken();
  const base = config.baseUrl;
  const path = config.searchByPhone;

  const url = new URL(base + path);
  url.searchParams.set("query", params.query);
  if (params.type === "phone") {
    url.searchParams.set("phone", params.query);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const { body, ok } = await loggedFetch(
    url.toString(),
    { method: "GET", headers },
    config,
    "search",
    onLog,
  );

  if (!ok) throw new Error(`Search request failed`);

  const payload = (body as { payload?: { content?: Store[] } })?.payload;
  const stores = payload?.content ?? [];
  return { stores, raw: body };
}

export async function fetchLoginToken(
  storeId: number,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<string> {
  const token = getAgentToken();
  const url = `${config.baseUrl}${config.loginToken}?store-id=${storeId}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const { body, ok } = await loggedFetch(
    url,
    { method: "GET", headers },
    config,
    "login-token",
    onLog,
  );
  if (!ok) throw new Error("Failed to fetch login token");
  const payload = (body as { payload?: string })?.payload;
  if (!payload) throw new Error("No login token in response");
  return payload;
}

export async function exchangeOAuthToken(
  loginToken: string,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<string> {
  const decoded = atob(loginToken);
  const [username, password] = decoded.split(":");
  const url = `${config.authApiBase}${config.oauthToken}`;
  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });

  const { body: resp, ok } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${config.oauthBasic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    },
    config,
    "oauth",
    onLog,
  );
  if (!ok) throw new Error("OAuth token exchange failed");
  const accessToken = (resp as { access_token?: string })?.access_token;
  if (!accessToken) throw new Error("No access_token in OAuth response");
  setOAuthToken(accessToken);
  return accessToken;
}

export async function loginToStore(
  storeId: number,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<string> {
  const loginToken = await fetchLoginToken(storeId, config, onLog);
  const oauth = await exchangeOAuthToken(loginToken, config, onLog);
  return oauth;
}

export async function publishBanner(
  storeId: number,
  file: AssetFile,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<unknown> {
  const token = getOAuthToken();
  const url = `${config.authApiBase}/api/v1/org/stores/${storeId}/offers`;
  const body = JSON.stringify({
    name: file.name.replace(/\.html?$/i, ""),
    url: null,
    desktop_url: null,
    link: null,
    new_window: false,
    hide: false,
    mobile_only: false,
    html_content: file.content,
  });

  const { body: bannerBody, status: bannerStatus, ok: bannerOk } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    },
    config,
    "publish",
    onLog,
  );
  if (!bannerOk) throw new Error(`Failed to publish banner (HTTP ${bannerStatus})`);
  return bannerBody;
}

export async function publishAnnouncement(
  storeSlug: string,
  file: AssetFile,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<unknown> {
  const token = getOAuthToken();
  const url = `${config.authApiBase}/api/v1/org/store/${storeSlug}/group-names/header/attributes`;
  const body = JSON.stringify([
    { name: "notice_show", value: true },
    { name: "notice_message", value: file.content },
    { name: "notice_background_color", value: "#000000" },
    { name: "notice_color", value: "#ffffff" },
  ]);

  const { body: annBody, status: annStatus, ok: annOk } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    },
    config,
    "publish",
    onLog,
  );
  if (!annOk) throw new Error(`Failed to publish announcement (HTTP ${annStatus})`);
  return annBody;
}

export async function publishFooter(
  storeSlug: string,
  file: AssetFile,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<unknown> {
  const token = getOAuthToken();
  const url = `${config.authApiBase}/api/v1/org/store/${storeSlug}/group-names/footer_settings/attributes`;
  const body = JSON.stringify([
    { name: "type", value: "html" },
    { name: "html", value: file.content },
  ]);

  const { body: footerBody, status: footerStatus, ok: footerOk } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    },
    config,
    "publish",
    onLog,
  );
  if (!footerOk) throw new Error(`Failed to publish footer (HTTP ${footerStatus})`);
  return footerBody;
}

export async function publishCollection(
  orgId: number,
  storeId: number,
  file: AssetFile,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<unknown> {
  const token = getOAuthToken();
  const url = `${config.authApiBase}/api/v1/org/${orgId}/stores/${storeId}/product-collections`;
  const body = JSON.stringify({
    slug: crypto.randomUUID(),
    type: "HTML_COLLECTION",
    active: true,
    html_content: file.content,
    name: file.name.replace(/\.html?$/i, ""),
    show_title: false,
    html_render_mode: "inline",
  });

  const { body: collBody, status: collStatus, ok: collOk } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
    },
    config,
    "publish",
    onLog,
  );
  if (!collOk) throw new Error(`Failed to publish collection (HTTP ${collStatus})`);
  return collBody;
}

export async function publishCss(
  orgId: number,
  file: AssetFile,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<unknown> {
  const token = getOAuthToken();
  const timestamp = Date.now();
  const cloudFileName = `${file.name.replace(/\.css$/i, "")}${timestamp}.css`;
  const url = `${config.authApiBase}/api/v1/cloud/file/pub?cloud-file-name=${encodeURIComponent(cloudFileName)}&cloud-file-loc=${orgId}`;

  const formData = new FormData();
  formData.append("file", new Blob([file.content], { type: "text/css" }), file.name);

  const { body: cssBody, status: cssStatus, ok: cssOk } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    },
    config,
    "publish",
    onLog,
  );
  if (!cssOk) throw new Error(`Failed to publish CSS (HTTP ${cssStatus})`);
  return cssBody;
}

export async function uploadImageFile(
  file: Blob,
  fileName: string,
  orgId: number,
  config: ShoopyConfig,
  onLog?: LogCallback,
): Promise<string> {
  const token = getOAuthToken();
  const url = `${config.authApiBase}/api/v1/cloud/file/pub?cloud-file-name=${encodeURIComponent(fileName)}&cloud-file-loc=${orgId}`;

  const formData = new FormData();
  formData.append("file", file, fileName);

  const { body, status, ok } = await loggedFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    },
    config,
    "image",
    onLog,
  );
  if (!ok) throw new Error(`Failed to upload image "${fileName}" (HTTP ${status})`);
  const payload = (body as { payload?: { location?: string } })?.payload;
  if (!payload?.location) throw new Error(`Image upload for "${fileName}" returned no file location`);
  const uploadedFilename = payload.location.split("/").pop() ?? fileName;
  const clevupUrl = `https://img.clevup.in/${orgId}/${uploadedFilename}`;
  return clevupUrl;
}

export { setAgentToken };
