import { useState, useCallback } from "react";
import { Search, Phone, Globe, Loader2, ChevronDown, ChevronRight, Store as StoreIcon, User, Wallet, Calendar, LogIn, Settings, X } from "lucide-react";
import type { ShoopyConfig, Store, ApiLogEntry } from "@/types";
import { searchStores, loginToStore, type SearchParams } from "@/lib/shoopy";
import { setAgentToken } from "@/lib/config";

interface Props {
  config: ShoopyConfig;
  onConfigChange: (c: ShoopyConfig) => void;
  onLog: (entry: ApiLogEntry) => void;
  onStoreSelect: (store: Store | null) => void;
  selectedStore: Store | null;
  publishLogs?: ApiLogEntry[];
}

export function StoreSearchView({ config, onConfigChange, onLog, onStoreSelect, selectedStore, publishLogs }: Props) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"phone" | "url">("phone");
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [expandedStore, setExpandedStore] = useState<number | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loginStoreId, setLoginStoreId] = useState<number | null>(null);

  const handleLog = useCallback(
    (entry: ApiLogEntry) => {
      setLogs((l) => [entry, ...l].slice(0, 20));
      onLog(entry);
    },
    [onLog],
  );

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setStores([]);
    try {
      const params: SearchParams = { query: query.trim(), type: searchType };
      const result = await searchStores(params, config, handleLog);
      setStores(result.stores);
      if (result.stores.length === 0) setError("No stores found");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(storeId: number) {
    setLoginStoreId(storeId);
    try {
      await loginToStore(storeId, config, handleLog);
      const store = stores.find((s) => s.store_id === storeId);
      if (store) onStoreSelect(store);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoginStoreId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Store Search</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Find stores by phone number or URL using the Shoopy API
        </p>
      </div>

      {/* Search bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Type toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => setSearchType("phone")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition ${
                searchType === "phone"
                  ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              Phone
            </button>
            <button
              onClick={() => setSearchType("url")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition ${
                searchType === "url"
                  ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              URL
            </button>
          </div>

          {/* Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "phone" ? "Enter phone number (e.g. 5555512345)" : "Enter store URL (e.g. www.wholemonkey.com)"}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl transition shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center justify-center p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Agent token input */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Agent Bearer Token (for search)</label>
          <input
            value={config.baseUrl ? (localStorage.getItem("shoopy_agent_token") || "") : ""}
            onChange={(e) => setAgentToken(e.target.value)}
            placeholder="Enter agent bearer token..."
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Selected store banner */}
      {selectedStore && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-success-500/10 border border-success-500/30 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <StoreIcon className="w-4 h-4 text-success-600 shrink-0" />
            <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
              <span className="font-semibold">{selectedStore.store_name}</span> (ID: {selectedStore.store_id}) is selected for publishing
            </p>
          </div>
          <button
            onClick={() => onStoreSelect(null)}
            className="shrink-0 p-1 text-slate-400 hover:text-error-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-error-500/10 border border-error-500/30 rounded-xl text-sm text-error-600 dark:text-error-500">
          {error}
        </div>
      )}

      {/* Results */}
      {stores.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {stores.length} {stores.length === 1 ? "store" : "stores"} found
          </p>
          {stores.map((store) => (
            <div key={store.store_id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedStore(expandedStore === store.store_id ? null : store.store_id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
              >
                {expandedStore === store.store_id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0">
                  <StoreIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{store.store_name}</p>
                  <p className="text-xs text-slate-400">
                    ID: {store.store_id} · {store.mobile} · {store.domain}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${store.status === "ACTIVE" ? "bg-success-500/10 text-success-600" : "bg-slate-100 text-slate-500"}`}>
                    {store.status}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-300">
                    {store.store_plan}
                  </span>
                </div>
              </button>

              {expandedStore === store.store_id && (
                <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-4 animate-fade-in">
                  {/* Key info grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <InfoTile icon={StoreIcon} label="Store ID" value={String(store.store_id)} />
                    <InfoTile icon={Phone} label="Mobile" value={store.mobile} />
                    <InfoTile icon={User} label="Email" value={store.email ?? "—"} />
                    <InfoTile icon={Wallet} label="Wallet" value={`₹${store.wallet_balance.toLocaleString()}`} />
                    <InfoTile icon={Globe} label="Domain" value={store.domain} />
                    <InfoTile icon={Globe} label="Slug" value={store.slug} />
                    <InfoTile icon={Calendar} label="Created" value={new Date(store.created_at).toLocaleDateString()} />
                    <InfoTile icon={User} label="Country" value={store.country_code} />
                  </div>

                  {/* Subscription */}
                  {store.subscription && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Subscription</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-slate-400">Plan:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{store.subscription.plan}</span></div>
                        <div><span className="text-slate-400">Status:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{store.subscription.status}</span></div>
                        <div><span className="text-slate-400">Renewal:</span> <span className="font-medium text-slate-700 dark:text-slate-200">₹{store.subscription.renewal_amount}</span></div>
                        <div><span className="text-slate-400">Trial:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{store.subscription.trial ? "Yes" : "No"}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Users */}
                  {store.store_users && store.store_users.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Store Users ({store.store_users.length})</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400 border-b border-slate-200 dark:border-slate-700">
                              <th className="py-2 pr-3 font-medium">Name</th>
                              <th className="py-2 pr-3 font-medium">Mobile</th>
                              <th className="py-2 pr-3 font-medium">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {store.store_users.map((u) => (
                              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                                <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{u.name}</td>
                                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{u.mobile}</td>
                                <td className="py-2 pr-3">
                                  <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">{u.role}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Login button */}
                  <button
                    onClick={() => handleLogin(store.store_id)}
                    disabled={loginStoreId === store.store_id}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl transition shadow-sm"
                  >
                    {loginStoreId === store.store_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Login & Select for Publishing
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* API Logs */}
      {(logs.length > 0 || (publishLogs?.length ?? 0) > 0) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-3">API Request / Response Log</h2>
          <div className="space-y-2">
            {[...logs, ...(publishLogs ?? [])].map((log) => (
              <div key={log.id} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                >
                  {expandedLog === log.id ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${log.method === "GET" ? "bg-brand-500/10 text-brand-600" : "bg-success-500/10 text-success-600"}`}>
                    {log.method}
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate flex-1">{log.url}</span>
                  <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${log.ok ? "bg-success-500/10 text-success-600" : "bg-error-500/10 text-error-500"}`}>
                    {log.status ?? "ERR"}
                  </span>
                  <span className="text-xs text-slate-400 capitalize">{log.phase}</span>
                </button>
                {expandedLog === log.id && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 animate-fade-in">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Request Body</p>
                      <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded overflow-x-auto text-slate-600 dark:text-slate-300 max-h-40">
                        {log.requestBody ? JSON.stringify(log.requestBody, null, 2) : "—"}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Response</p>
                      <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-950 p-2 rounded overflow-x-auto text-slate-600 dark:text-slate-300 max-h-60">
                        {log.responseBody ? JSON.stringify(log.responseBody, null, 2) : log.error ?? "—"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={(c) => { onConfigChange(c); setShowSettings(false); }} />
      )}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof StoreIcon; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={value}>{value}</p>
    </div>
  );
}

function SettingsModal({ config, onClose, onSave }: { config: ShoopyConfig; onClose: () => void; onSave: (c: ShoopyConfig) => void }) {
  const [draft, setDraft] = useState<ShoopyConfig>(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">API Configuration</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {([
            ["baseUrl", "Base URL (api6)"],
            ["authApiBase", "Auth API Base (ia.api)"],
            ["searchByPhone", "Search Path"],
            ["loginToken", "Login Token Path"],
            ["oauthToken", "OAuth Token Path"],
            ["oauthBasic", "OAuth Basic Auth"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{label}</label>
              <input
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-200"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">Cancel</button>
          <button onClick={() => onSave(draft)} className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
