"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart, Truck, LogOut, Shield, Container, Settings2, ClipboardList, Sun, Moon, BarChart2, Images, MoreHorizontal, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/user-context";
import type { CampoId } from "@/lib/campos";
import type { User } from "@supabase/supabase-js";

type Profile = { full_name: string | null; role: "admin" | "operator"; campo: CampoId | null; has_fiorino: boolean };

const PROFILE_CACHE_KEY = "v1_profile";
const PROFILE_CACHE_TTL = 8 * 60 * 60 * 1000;

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "dim">("dark");
  const menuRef = useRef<HTMLDivElement>(null);
  const lastHiddenRef = useRef(0);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "dark" | "dim") ?? "dark";
    setTheme(saved);
    document.documentElement.classList.add("dark"); // sempre presente para as variáveis CSS
    document.documentElement.classList.toggle("dim", saved === "dim");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "dim" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dim", next === "dim");
  };

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
              .select("full_name, role, campo, has_fiorino")
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

  useEffect(() => { setMoreOpen(false); }, [pathname]);

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
  const hasFiorino = profile?.has_fiorino ?? false;

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pageTitleMap: Record<string, string> = {
    "/products": "Catálogo",
    "/admin": "Usuários",
    "/campanhas/lancamentos-lideres": "Líderes",
    "/campanhas/lancamentos": "Lançamentos",
    "/campanhas/encerramento": "Encerramento",
    "/campanhas/acertos": "Painel de Acertos",
    "/campanhas/configuracoes": "Configurações — Campanhas",
    "/campanhas": "Importação",
  };
  const currentPageTitle =
    Object.entries(pageTitleMap).find(([path]) => pathname.startsWith(path))?.[1] ?? null;

  type NavItem = { to: string; icon: React.ComponentType<{ className?: string }>; label: string; activeFor: string[] };
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Vendas",
      items: [
        { to: "/orders", icon: ShoppingCart, label: "Pedidos", activeFor: ["/orders"] },
        { to: "/shipments", icon: Truck, label: "Envios", activeFor: ["/shipments"] },
      ],
    },
    {
      label: "Logística",
      items: [
        ...(isAdmin || hasFiorino ? [{ to: "/fiorino", icon: Container, label: "Fiorino", activeFor: ["/fiorino"] }] : []),
        { to: "/estoque", icon: ClipboardList, label: "Estoque", activeFor: ["/estoque"] },
      ],
    },
    ...(isAdmin ? [{
      label: "Gestão",
      items: [
        { to: "/reports", icon: BarChart2, label: "Relatórios", activeFor: ["/reports"] },
        { to: "/gallery", icon: Images, label: "Galeria", activeFor: ["/gallery"] },
      ],
    }] : []),
    {
      label: "Campanhas",
      items: [
        { to: "/campanhas/acertos", icon: BookOpen, label: "Acertos", activeFor: ["/campanhas"] },
      ],
    },
  ];
  const configItem: NavItem = { to: "/settings", icon: Settings2, label: "Configurações", activeFor: ["/settings", "/products", "/admin"] };
  const navItems = [...navGroups.flatMap(g => g.items), ...(isAdmin ? [configItem] : [])];

  // Mobile nav: Vendas + Logística + Campanhas ficam visíveis;
  // Gestão + Configurações vão para o painel "Mais" (só admins chegam aqui)
  const primaryMobileItems = navGroups.filter(g => g.label !== "Gestão").flatMap(g => g.items);
  const overflowMobileItems = [
    ...navGroups.filter(g => g.label === "Gestão").flatMap(g => g.items),
    ...(isAdmin ? [configItem] : []),
  ];
  const hasOverflow = overflowMobileItems.length > 0;
  const isMoreActive = overflowMobileItems.some(item => item.activeFor.some(p => pathname.startsWith(p)));

  return (
    <div className="flex h-dvh bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-sidebar-border bg-sidebar">
        <div className="pt-5 pb-4 px-4 flex flex-col items-center gap-2 border-b border-sidebar-border">
          <div className="w-12 h-12 bg-[#6C63FF] rounded-2xl flex items-center justify-center shadow-md shadow-black/30">
            <img src="/logo.png" alt="Sels UCOB" className="w-8 h-8 object-contain brightness-0 invert" />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Sels UCOB</p>
        </div>
        <nav className="px-3 mt-4 pb-4 flex-1 flex flex-col">
          {/* Grupos principais */}
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive = item.activeFor.some(p => pathname.startsWith(p));
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                      isActive
                        ? "bg-[#6C63FF] text-white font-medium"
                        : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-sidebar-accent-foreground/60")} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Configurações — sempre no fundo, só admin */}
          {isAdmin && (() => {
            const isActive = configItem.activeFor.some(p => pathname.startsWith(p));
            return (
              <div className="mt-auto pt-3 border-t border-sidebar-border">
                <Link
                  href={configItem.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                    isActive
                      ? "bg-[#6C63FF] text-white font-medium"
                      : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <configItem.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-sidebar-accent-foreground/60")} />
                  <span className="text-sm">{configItem.label}</span>
                </Link>
              </div>
            );
          })()}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border bg-sidebar/80 backdrop-blur-md">
          <span className="font-semibold text-foreground uppercase tracking-wider text-sm">
            {currentPageTitle ?? navItems.find((i) => i.activeFor.some(p => pathname.startsWith(p)))?.label ?? "Dashboard"}
          </span>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center text-[#6C63FF] text-sm font-bold hover:bg-[#6C63FF]/30 transition-colors"
              >
                {userInitial}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 w-60 bg-card border border-border rounded-xl shadow-xl shadow-black/50 py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-sm font-medium text-card-foreground truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isAdmin && <Shield className="w-3 h-3 text-[#6C63FF]" />}
                      <p className="text-xs text-muted-foreground capitalize">
                        {isAdmin ? "Administrador" : "Operador"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-6 lg:p-8">
          <div className="mx-auto min-h-full max-w-7xl w-full">
            <UserContext.Provider value={{ isAdmin, displayName, campo, profileLoaded, refreshTick, hasFiorino }}>
              {children}
            </UserContext.Provider>
          </div>
        </div>

        {/* Bottom nav — mobile only */}
        <nav className="shrink-0 relative flex md:hidden border-t border-border bg-sidebar/95 backdrop-blur-md z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

          {/* Painel "Mais" */}
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 z-50 bg-sidebar border-t border-border shadow-2xl shadow-black/60 p-3 space-y-1 animate-fade-in">
                {overflowMobileItems.map(item => {
                  const isActive = item.activeFor.some(p => pathname.startsWith(p));
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                        isActive
                          ? "bg-[#6C63FF] text-white font-medium"
                          : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-sidebar-accent-foreground/60")} />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Itens primários */}
          {primaryMobileItems.map(item => {
            const isActive = item.activeFor.some(p => pathname.startsWith(p));
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3.5 transition-colors active:bg-sidebar-accent/60",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-[#6C63FF]" : "text-muted-foreground/60")} />
                <span className={cn("text-[10px] font-semibold tracking-wide", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Botão "Mais" — só aparece para admins */}
          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3.5 transition-colors active:bg-sidebar-accent/60",
                (moreOpen || isMoreActive) ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className={cn("w-5 h-5", (moreOpen || isMoreActive) ? "text-[#6C63FF]" : "text-muted-foreground/60")} />
              <span className={cn("text-[10px] font-semibold tracking-wide", (moreOpen || isMoreActive) ? "text-foreground" : "text-muted-foreground")}>
                Mais
              </span>
            </button>
          )}
        </nav>
      </main>
    </div>
  );
}
