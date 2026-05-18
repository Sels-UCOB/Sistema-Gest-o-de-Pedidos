"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { to: "/products", icon: Package, label: "Catálogo" },
    { to: "/orders", icon: ShoppingCart, label: "Pedidos" },
    { to: "/shipments", icon: Truck, label: "Envios" },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="pt-6 pb-4 px-6 flex flex-col items-center gap-2 border-b border-slate-800">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-black/30">
            <img src="/logo.png" alt="Sels UCOB" className="w-10 h-10 object-contain" />
          </div>
          <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Sels UCOB</p>
        </div>
        <nav className="px-4 space-y-1 mt-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive
                    ? "bg-slate-800 text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-400" : "opacity-50")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-6">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-xs text-indigo-400 font-bold uppercase mb-1">Status do Sistema</p>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              Operacional
            </p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md">
          <span className="font-semibold text-white uppercase tracking-wider">
            {navItems.find((i) => pathname.startsWith(i.to))?.label || "Dashboard"}
          </span>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700" />
        </header>

        <div className="flex-1 overflow-auto p-4 pb-24 md:pb-8 md:p-6 lg:p-8">
          <div className="mx-auto h-full max-w-5xl w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
                isActive ? "text-white" : "text-slate-500"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "text-indigo-400")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
