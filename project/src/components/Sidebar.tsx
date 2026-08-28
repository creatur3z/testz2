import {
  LayoutDashboard,
  Search,
  Image,
  Megaphone,
  PanelBottom,
  LayoutGrid,
  Code2,
  History,
  Store,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export type ViewId =
  | "dashboard"
  | "search"
  | "banners"
  | "announcements"
  | "footers"
  | "collections"
  | "css"
  | "history";

interface NavItem {
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number;
}

interface Props {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
  counts: Record<ViewId, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ active, onNavigate, counts, mobileOpen, onMobileClose }: Props) {
  const { theme, toggle } = useTheme();

  const items: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "search", label: "Store Search", icon: Search },
    { id: "banners", label: "Banners", icon: Image, count: counts.banners },
    { id: "announcements", label: "Announcement Bar", icon: Megaphone, count: counts.announcements },
    { id: "footers", label: "Footer", icon: PanelBottom, count: counts.footers },
    { id: "collections", label: "Collection", icon: LayoutGrid, count: counts.collections },
    { id: "css", label: "Custom CSS", icon: Code2, count: counts.css },
    { id: "history", label: "Upload History", icon: History },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-md">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">Shoopy Assets</p>
              <p className="text-[10px] text-slate-400 leading-tight">Store Theme Dashboard</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onMobileClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isActive ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
          >
            {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
