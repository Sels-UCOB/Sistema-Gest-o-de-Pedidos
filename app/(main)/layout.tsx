"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Shield, Sun, Moon, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/user-context";
import type { CampoId } from "@/lib/campos";
import type { User } from "@supabase/supabase-js";

type Profile = { full_name: string | null; role: "admin" | "operator"; campo: CampoId | null };

const PROFILE_CACHE_KEY = "v1_profile";
const PROFILE_CACHE_TTL = 30 * 60 * 1000;

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

type Tab = { label: string; href: string; exact?: boolean };
type Section = {
  label: string;
  paths: string[];
  tabs: (ctx: { isAdmin: boolean; hasFiorino: boolean }) => Tab[];
};

const SECTIONS: Section[] = [
  {
    label: "Vendas",
    paths: ["/orders", "/shipments"],
    tabs: () => [
      { label: "Pedidos", href: "/orders" },
      { label: "Envios", href: "/shipments" },
    ],
  },
  {
    label: "Logística",
    paths: ["/fiorino", "/estoque"],
    tabs: () => [
      { label: "Fiorino", href: "/fiorino" },
      { label: "Estoque", href: "/estoque" },
    ],
  },
  {
    label: "Gestão",
    paths: ["/reports", "/gallery", "/products", "/admin", "/settings"],
    tabs: ({ isAdmin }) =>
      isAdmin
        ? [
            { label: "Relatórios", href: "/reports" },
            { label: "Galeria", href: "/gallery" },
            { label: "Configurações", href: "/settings" },
          ]
        : [],
  },
  {
    label: "Campanhas",
    paths: ["/campanhas"],
    tabs: () => [
      { label: "Acertos", href: "/campanhas/acertos" },
      { label: "Importação", href: "/campanhas", exact: true },
      { label: "Lançamentos", href: "/campanhas/lancamentos" },
      { label: "Líderes", href: "/campanhas/lancamentos-lideres" },
      { label: "Escalas", href: "/campanhas/escalas" },
      { label: "Encerramento", href: "/campanhas/encerramento" },
      { label: "Configurações", href: "/campanhas/configuracoes" },
    ],
  },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(tab.href + "/");
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
  const [theme, setTheme] = useState<"dark" | "dim">("dark");
  const menuRef = useRef<HTMLDivElement>(null);
  const lastHiddenRef = useRef(0);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "dark" | "dim") ?? "dark";
    setTheme(saved);
    document.documentElement.classList.add("dark");
    document.documentElement.classList.toggle("dim", saved === "dim");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "dim" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dim", next === "dim");
  };

  useEffect(() => {
    const cached = readProfileCache();
    if (cached) {
      setProfile(cached);
      setProfileLoaded(true);
    }
  }, []);

  const fetchAndSetProfile = async (userId: string): Promise<boolean> => {
    const doFetch = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role, campo")
        .eq("id", userId)
        .single();
      if (error) console.warn("[profile] query error:", error.message, error.code);
      return data as Profile | null;
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
        const data = await Promise.race([doFetch(), timeout]);
        if (data) {
          setProfile(data);
          writeProfileCache(data);
          return true;
        }
        console.warn(`[profile] tentativa ${attempt + 1} retornou null`);
      } catch (e) {
        console.warn(`[profile] tentativa ${attempt + 1} exception:`, e);
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
    console.error("[profile] todas as tentativas falharam para userId:", userId);
    return false;
  };

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
        await fetchAndSetProfile(session.user.id);
        if (!cancelled) setProfileLoaded(true);
      } else if (event === "TOKEN_REFRESHED") {
        setRefreshTick(t => t + 1);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        lastHiddenRef.current = Date.now();
      } else if (Date.now() - lastHiddenRef.current > 2 * 60 * 1000) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/"); return; }
        await fetchAndSetProfile(session.user.id);
        setRefreshTick(t => t + 1);
      }
    };
    const onOnline = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchAndSetProfile(session.user.id);
      setRefreshTick(t => t + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isAdmin = profile?.role === "admin";
  const campo = (profile?.campo as CampoId) ?? null;
  const hasFiorino = true;
  const displayName = profile?.full_name || user?.email || "";
  const userInitial = displayName[0]?.toUpperCase() ?? "";
  const isOnHub = pathname === "/hub";

  const currentSection = SECTIONS.find((s) =>
    s.paths.some((p) => pathname.startsWith(p))
  ) ?? null;
  const tabs = currentSection?.tabs({ isAdmin, hasFiorino }) ?? [];

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground font-sans overflow-hidden">
      <header className="shrink-0 border-b border-border bg-sidebar/80 backdrop-blur-md">
        {/* Barra principal */}
        <div className="h-14 flex items-center justify-between px-4 md:px-6">
          {/* Esquerda: logo/hub + seção + tabs (desktop) */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/hub"
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#6C63FF]/20 hover:bg-[#6C63FF]/30 transition-colors shrink-0"
              title="Início"
            >
              <Home className="w-4 h-4 text-[#6C63FF]" />
            </Link>

            {currentSection && (
              <>
                <span className="text-border/60 select-none">/</span>
                <span className="font-semibold text-foreground uppercase tracking-wider text-sm shrink-0">
                  {currentSection.label}
                </span>

                {/* Tabs inline — só desktop */}
                {tabs.length > 0 && (
                  <div className="hidden md:flex items-center gap-0.5 ml-3">
                    {tabs.map((tab) => (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                          isTabActive(tab, pathname)
                            ? "bg-[#6C63FF] text-white"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {isOnHub && (
              <span className="font-semibold text-foreground uppercase tracking-wider text-sm">
                Início
              </span>
            )}
          </div>

          {/* Direita: tema + usuário */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

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
        </div>

        {/* Tabs em mobile — barra rolável abaixo do header */}
        {currentSection && tabs.length > 0 && (
          <div className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isTabActive(tab, pathname)
                    ? "bg-[#6C63FF] text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-6 lg:p-8">
        <div className="mx-auto min-h-full max-w-7xl w-full">
          <UserContext.Provider value={{ isAdmin, displayName, campo, profileLoaded, refreshTick, hasFiorino }}>
            {children}
          </UserContext.Provider>
        </div>
      </main>
    </div>
  );
}
