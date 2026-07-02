import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Brain,
  Compass,
  Cpu,
  Database,
  Dna,
  Gauge,
  History,
  KeyRound,
  LogOut,
  Menu,
  Newspaper,
  Signal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { GROQ_LS_ENABLED, GROQ_LS_KEY, GROQ_LS_MODEL } from "@/lib/ai-override";

function useActiveAiProvider() {
  const [state, setState] = useState<{ provider: "lovable" | "groq"; model?: string }>({
    provider: "lovable",
  });
  useEffect(() => {
    const read = () => {
      try {
        const enabled = localStorage.getItem(GROQ_LS_ENABLED) === "1";
        const key = localStorage.getItem(GROQ_LS_KEY);
        const model = localStorage.getItem(GROQ_LS_MODEL) || undefined;
        setState(enabled && key ? { provider: "groq", model } : { provider: "lovable" });
      } catch {
        setState({ provider: "lovable" });
      }
    };
    read();
    const onChange = () => read();
    window.addEventListener("t1:ai-override-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("t1:ai-override-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return state;
}

const NAV = [
  { to: "/ask", label: "Ask Anything", icon: Sparkles, group: "intel" },
  { to: "/pulse", label: "Market Pulse", icon: Gauge, group: "intel" },
  { to: "/", label: "Markets", icon: Activity, group: "data" },
  { to: "/news", label: "News Intel", icon: Newspaper, group: "intel" },
  { to: "/radar", label: "Opportunity Radar", icon: Compass, group: "intel" },
  { to: "/analyze", label: "AI Reasoning", icon: Brain, group: "intel" },
  { to: "/dna", label: "Company DNA", icon: Dna, group: "intel" },
  { to: "/compare", label: "Compare", icon: BarChart3, group: "intel" },
  { to: "/agents", label: "AI Agents", icon: Cpu, group: "system" },
  { to: "/research", label: "Research", icon: History, group: "system" },
  { to: "/api-key", label: "API Key", icon: KeyRound, group: "system" },
] as const;

export function AppShell({
  children,
  liveStatus,
}: {
  children: ReactNode;
  liveStatus?: { sources?: string[]; fetchedAt?: string };
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeItem = NAV.find((n) =>
    n.to === "/" ? pathname === "/" : pathname === n.to || pathname.startsWith(n.to + "/"),
  );

  const SidebarNav = ({ showLabels }: { showLabels: boolean }) => (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
      {NAV.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 rounded-sm px-2.5 py-2 text-[12px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-amber/15 text-amber"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title={item.label}
          >
            <Icon className="size-4 shrink-0" />
            {showLabels && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] md:flex ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 border-b border-border p-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-amber text-primary-foreground">
            <span className="text-sm font-black">T1</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-xs font-bold uppercase tracking-[0.18em]">
                Terminal One
              </div>
              <div className="truncate text-[9px] uppercase tracking-widest text-muted-foreground">
                Financial Intelligence OS
              </div>
            </div>
          )}
        </Link>

        <SidebarNav showLabels={!collapsed} />

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 border-t border-border p-3 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <Menu className="size-3.5" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-3">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-amber text-primary-foreground">
                  <span className="text-sm font-black">T1</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold uppercase tracking-[0.18em]">
                    Terminal One
                  </div>
                  <div className="truncate text-[9px] uppercase tracking-widest text-muted-foreground">
                    Financial Intelligence OS
                  </div>
                </div>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav showLabels />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="truncate text-xs font-bold uppercase tracking-[0.18em] sm:text-sm">
              {activeItem?.label ?? "Terminal One"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground sm:gap-4 sm:text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="pulse-dot" /> Live
            </span>
            {liveStatus?.sources && liveStatus.sources.length > 0 && (
              <span className="hidden md:flex items-center gap-1.5">
                <Signal className="size-3" />
                {liveStatus.sources.join(" · ")}
              </span>
            )}
            {liveStatus?.fetchedAt && (
              <span className="hidden lg:flex items-center gap-1.5">
                <Database className="size-3" />
                {new Date(liveStatus.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            {user && (
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <div className="flex size-6 items-center justify-center rounded-sm bg-amber/20 text-[10px] font-bold text-amber">
                  {initial}
                </div>
                <span className="hidden max-w-[140px] truncate text-[10px] normal-case tracking-normal text-foreground sm:inline">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
