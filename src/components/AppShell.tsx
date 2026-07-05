"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { IconRadar, IconGraph, IconAsk, IconLint, IconRitual, IconScroll, IconBrain } from "./icons";

const NAV = [
  { href: "/app", label: "Ask", icon: IconAsk, desc: "GraphRAG Q&A" },
  { href: "/app/radar", label: "Alignment Radar", icon: IconRadar, desc: "The CEO's morning screen" },
  { href: "/app/graph", label: "Belief Graph", icon: IconGraph, desc: "Explore the memory" },
  { href: "/app/lint", label: "Lint", icon: IconLint, desc: "Alignment CI" },
  { href: "/app/rituals", label: "Rituals", icon: IconRitual, desc: "Compose resolutions" },
  { href: "/app/constitution", label: "Constitution", icon: IconScroll, desc: "How the org resolves" },
];

interface Mode { configured: boolean; dataset: string; baseUrlHost: string | null }

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => setMode(d.cognee)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-ink-950 text-slate-200 flex flex-col fixed h-screen z-20">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-500 text-white">
            <IconBrain width={20} height={20} />
          </span>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-white text-lg">Meridian</div>
            <div className="text-[10px] uppercase tracking-widest text-meridian/80">Company Brain</div>
          </div>
        </Link>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer",
                  active ? "bg-primary/20 text-white ring-1 ring-primary/40" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon width={18} height={18} className={active ? "text-meridian" : ""} />
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-400">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Cognee status */}
        <div className="p-3 border-t border-white/10">
          <div className="rounded-lg bg-white/5 p-3 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("w-2 h-2 rounded-full", mode?.configured ? "bg-aligned" : "bg-meridian")} />
              <span className="font-semibold text-slate-200">Cognee memory</span>
            </div>
            <div className="text-slate-400 leading-relaxed">
              {mode?.configured ? (
                <>Live tenant · <span className="text-slate-300">{mode.baseUrlHost}</span></>
              ) : (
                <>Offline mock mode. Set <code className="text-meridian">COGNEE_API_KEY</code> to go live.</>
              )}
            </div>
            <div className="text-slate-500 mt-1">dataset: {mode?.dataset || "meridian-demo"}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
