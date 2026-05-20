"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Package, ShoppingCart, Truck, LogOut, Shield, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/user-context";
import type { CampoId } from "@/lib/campos";
import type { User } from "@supabase/supabase-js";

type Profile = { full_name: string | null; role: "admin" | "operator"; campo: CampoId | null };

const PROFILE_CACHE_KEY = "v1_profile";
const PROFILE_CACHE_TTL = 8 * 60 * 60 * 1000; // 8 horas

function readProfileCache(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > PROFILE_CACHE_TTL) return null;
    return data as Profile;
  } catch { return null; }
}

function writeProfileCache(data: Profile) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
}


export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastHiddenRef = useRef(0);

  // Restaura perfil do cache imediatamente — evita flash de "operador" enquanto o fetch acontece
  useEffect(() => {
    const cached = readProfileCache();
    if (cached) setProfile(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (!session) {
        router.replace("/");
        return;
      }

      setUser(session.user);
      setAuthChecked(true);

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        try {
          const fetchProfile = async () => {
            const { data } = await supabase
              .from("profiles")
              .select("full_name, role, campo")
              .eq("id", session.user.id)
              .single();
            return data as Profile | null;
          };
          const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
          const data = await Promise.race([fetchProfile(), timeout]);
          if (cancelled) return;
          if (data) {
            setProfile(data);
            writeProfileCache(data);
          }
        } catch {
          // fetch travou ou falhou — mantém o perfil em cache já restaurado
        }
        setProfileLoaded(true);
      } else if (event === "TOKEN_REFRESHED") {
        setRefreshTick(t => t + 1);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        lastHiddenRef.current = Date.now();
      } else if (Date.now() - lastHiddenRef.current > 2 * 60 * 1000) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/"); return; }
        setRefreshTick(t => t + 1);
      }
    };
    const onOnline = () => setRefreshTick(t => t + 1);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    clearProfileCache();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const displayName = profile?.full_name || user?.email || "";
  const userInitial = displayName[0]?.toUpperCase() ?? "";
  const isAdmin = profile?.role === "admin";
  const campo = (profile?.campo as CampoId) ?? null;

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navItems = [
    { to: "/orders", icon: ShoppingCart, label: "Pedidos" },
    { to: "/shipments", icon: Truck, label: "Envios" },
    { to: "/reports", icon: FileText, label: "Relatórios" },
    { to: "/products", icon: Package, label: "Catálogo" },
    ...(isAdmin ? [{ to: "/admin", icon: Users, label: "Usuários" }] : []),
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

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold hover:bg-indigo-600/30 transition-colors"
            >
              {userInitial}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/50 py-1.5 z-50">
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isAdmin && <Shield className="w-3 h-3 text-indigo-400" />}
                    <p className="text-xs text-slate-500 capitalize">
                      {isAdmin ? "Administrador" : "Operador"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto min-h-full max-w-5xl w-full">
            <UserContext.Provider value={{ isAdmin, displayName, campo, profileLoaded, refreshTick }}>
              {children}
            </UserContext.Provider>
          </div>
        </div>

        {/* Bottom nav — mobile only, flex child so it never overlaps content */}
        <nav className="shrink-0 flex md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
      </main>
    </div>
  );
}
