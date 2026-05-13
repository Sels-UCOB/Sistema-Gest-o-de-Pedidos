import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Package, ShoppingCart, Truck, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: "/products", icon: Package, label: "Catálogo" },
    { to: "/orders", icon: ShoppingCart, label: "Pedidos" },
    { to: "/shipments", icon: Truck, label: "Envios" },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform flex flex-col border-r border-slate-800 bg-slate-900/90 md:bg-slate-900/50 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">G</div>
            <h1 className="font-bold text-xl tracking-tight text-white">Gestão Pro</h1>
          </div>
          <button
            className="md:hidden text-slate-400 hover:text-slate-200"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="px-6 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive
                    ? "bg-slate-800 text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "opacity-80" : "opacity-50")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-6 hidden md:block">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-xs text-indigo-400 font-bold uppercase mb-1">Status do Sistema</p>
            <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              Operacional
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-slate-900/30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              className="text-slate-400 hover:text-white md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-semibold text-white uppercase tracking-wider">
  {navItems.find((i) => location.pathname.startsWith(i.to))?.label?.replace('su:', '') || 'Dashboard'}          </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 hidden sm:block"></div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
