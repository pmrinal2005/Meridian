"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  IconRadar, IconGraph, IconAsk, IconLint, IconRitual, IconScroll,
  IconBrain, IconSpark, IconChevronLeft, IconChevronRight,
} from "./icons";
import Onboarding from "./Onboarding";
import { apiFetch, hasOnboarded } from "@/lib/credsClient";

const NAV = [
  { href: "/app", label: "Ask", icon: IconAsk, desc: "GraphRAG Q&A" },
  { href: "/app/radar", label: "Alignment Radar", icon: IconRadar, desc: "The CEO's morning screen" },
  { href: "/app/graph", label: "Belief Graph", icon: IconGraph, desc: "Explore the memory" },
  { href: "/app/lint", label: "Lint", icon: IconLint, desc: "Alignment CI" },
  { href: "/app/rituals", label: "Rituals", icon: IconRitual, desc: "Compose resolutions" },
  { href: "/app/constitution", label: "Constitution", icon: IconScroll, desc: "How the org resolves" },
];

interface Mode { configured: boolean; dataset: string; baseUrlHost: string | null; source?: string }

const COLLAPSE_KEY = "meridian.sidebar.collapsed.v1";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);

  // Collapsible sidebar state — persisted so the choice survives navigation.
  const [collapsed, setCollapsed] = useState(false);

  const refreshStatus = useCallback(() => {
    apiFetch("/api/status")
      .then((r) => r.json())
      .then((d) => setMode(d.cognee))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
    // Restore the collapsed preference.
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {}
    // Auto-open onboarding on the very first visit.
    if (!hasOnboarded()) setOnboardOpen(true);
    const onCreds = () => refreshStatus();
    window.addEventListener("meridian:creds", onCreds);
    return () => window.removeEventListener("meridian:creds", onCreds);
  }, [refreshStatus]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  const live = mode?.configured;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — width animates between full (w-64) and rail (w-20). */}
      <aside
        className={cn(
          "shrink-0 bg-ink-950 text-slate-200 flex flex-col fixed h-screen z-20 transition-[width] duration-300 ease-in-out",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Brand + collapse toggle */}
        <div className="relative flex items-center h-16 border-b border-white/10">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 h-16 min-w-0",
              collapsed ? "justify-center w-full px-0" : "px-5"
            )}
            title="Meridian — home"
          >
            <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary-500 text-white">
              <IconBrain width={20} height={20} />
            </span>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <div className="font-extrabold tracking-tight text-white text-lg truncate">Meridian</div>
                <div className="text-[10px] uppercase tracking-widest text-meridian/80">Company Brain</div>
              </div>
            )}
          </Link>

          {/* Collapse / expand toggle. Always visible, docked to the edge. */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "absolute -right-3 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full bg-ink-900 border border-white/15 text-slate-300 hover:text-white hover:bg-primary transition-colors cursor-pointer shadow-md z-30"
            )}
          >
            {collapsed ? <IconChevronRight width={14} height={14} /> : <IconChevronLeft width={14} height={14} />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? `${item.label} — ${item.desc}` : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer",
                  collapsed && "justify-center px-0",
                  active ? "bg-primary/20 text-white ring-1 ring-primary/40" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon width={18} height={18} className={cn("shrink-0", active ? "text-meridian" : "")} />
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.label}</div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-400 truncate">{item.desc}</div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Cognee status */}
        <div className="p-3 border-t border-white/10">
          {collapsed ? (
            // Compact status: dot + connect button only.
            <button
              onClick={() => setOnboardOpen(true)}
              title={live ? `Live tenant · ${mode?.baseUrlHost}` : "Connect Cognee memory"}
              className="w-full flex flex-col items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 p-2.5 transition-colors cursor-pointer"
            >
              <span className={cn("w-2.5 h-2.5 rounded-full", live ? "bg-aligned animate-pulse" : "bg-meridian")} />
              <IconSpark width={15} height={15} className="text-slate-300" />
            </button>
          ) : (
            <div className="rounded-lg bg-white/5 p-3 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("w-2 h-2 rounded-full", live ? "bg-aligned animate-pulse" : "bg-meridian")} />
                <span className="font-semibold text-slate-200">Cognee memory</span>
              </div>
              <div className="text-slate-400 leading-relaxed">
                {live ? (
                  <>Live tenant · <span className="text-slate-300">{mode?.baseUrlHost}</span></>
                ) : (
                  <>Offline mock mode. Connect a tenant to load live data.</>
                )}
              </div>
              <div className="text-slate-500 mt-1">dataset: {mode?.dataset || "meridian-demo"}</div>

              <button
                onClick={() => setOnboardOpen(true)}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/20 ring-1 ring-primary/40 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/30 transition-colors cursor-pointer"
              >
                <IconSpark width={13} height={13} />
                {live ? "Manage connection" : "Connect memory"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main — left margin tracks the sidebar width. */}
      <main
        className={cn(
          "flex-1 min-h-screen transition-[margin] duration-300 ease-in-out",
          collapsed ? "ml-20" : "ml-64"
        )}
      >
        {children}
      </main>

      {/* Onboarding wizard */}
      <Onboarding open={onboardOpen} onClose={() => { setOnboardOpen(false); refreshStatus(); }} />
    </div>
  );
}
