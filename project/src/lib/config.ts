import type { ShoopyConfig } from "@/types";

export const DEFAULT_CONFIG: ShoopyConfig = {
  baseUrl: "https://api6.shoopy.in",
  agentApiBase: "https://api6.shoopy.in",
  authApiBase: "https://ia.api.shoopy.in",
  searchByPhone: "/api/v1/partner/shoopy-agent/shoopy-stores",
  searchByUrl: "/api/v1/partner/shoopy-agent/shoopy-stores",
  loginToken: "/api/v1/partner-users/login-token",
  oauthToken: "/api/v1/auth/oauth/token",
  oauthBasic: "b25hcHByLWJhY2tlbmQ6b25hcHByLWJhY2tlbmQtQnVLcVB4bURCM1ZSbg==",
  previewToggles: {
    banners: false,
    announcements: false,
    footers: false,
    collections: false,
    css: false,
  },
};

const STORAGE_KEY = "shoopy_dashboard_config";
const TOKEN_KEY = "shoopy_agent_token";

export function loadConfig(): ShoopyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: ShoopyConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getAgentToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setAgentToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getOAuthToken(): string {
  return localStorage.getItem("shoopy_oauth_token") || "";
}

export function setOAuthToken(token: string): void {
  if (token) localStorage.setItem("shoopy_oauth_token", token);
  else localStorage.removeItem("shoopy_oauth_token");
}
