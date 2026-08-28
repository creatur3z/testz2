export type AssetCategory = "banners" | "announcements" | "footers" | "collections" | "css";

export interface AssetFile {
  id: string;
  name: string;
  originalName: string;
  category: AssetCategory;
  content: string;
  size: number;
  sequence: number | null;
  uploadedAt: number;
  source: "zip" | "individual";
  published?: boolean;
  publishedAt?: number | null;
}

export interface UploadHistoryEntry {
  id: string;
  timestamp: number;
  source: "zip" | "individual";
  fileName: string;
  totalFiles: number;
  banners: number;
  announcements: number;
  footers: number;
  collections: number;
  css: number;
  duplicates: number;
}

export interface PublishHistoryEntry {
  id: string;
  timestamp: number;
  storeName: string;
  storeSlug: string;
  category: AssetCategory;
  fileName: string;
  status: "uploaded" | "failed";
  error?: string;
}

export interface StoreUser {
  id: number;
  user_id: number;
  name: string;
  mobile: string;
  email: string | null;
  role: string;
  store_name: string;
  org_name: string;
  org_id: number;
  store_id: number;
}

export interface StoreSubscription {
  store_id: number;
  status: string;
  plan: string;
  activation_reason: string;
  renewal_amount: number;
  start_date: string;
  end_date: string;
  trial: boolean;
}

export interface Store {
  store_id: number;
  store_name: string;
  mobile: string;
  email: string | null;
  status: string;
  store_plan: string;
  created_at: string;
  subscription?: StoreSubscription;
  store_users?: StoreUser[];
  slug: string;
  domain: string;
  wallet_balance: number;
  country_code: string;
}

export interface ApiLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
  status: number | null;
  responseBody: unknown;
  ok: boolean;
  error?: string;
  phase: "search" | "login-token" | "oauth" | "publish" | "image";
}

export interface ShoopyConfig {
  baseUrl: string;
  agentApiBase: string;
  authApiBase: string;
  searchByPhone: string;
  searchByUrl: string;
  loginToken: string;
  oauthToken: string;
  oauthBasic: string;
  previewToggles?: {
    banners: boolean;
    announcements: boolean;
    footers: boolean;
    collections: boolean;
    css: boolean;
  };
}
