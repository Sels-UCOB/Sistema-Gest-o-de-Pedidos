"use client";

import { useContext } from "react";
import Link from "next/link";
import { ShoppingCart, Truck, BarChart2, BookOpen, ChevronRight } from "lucide-react";
import { UserContext } from "@/lib/user-context";

const MODULES = [
  {
    key: "vendas",
    label: "Vendas",
    icon: ShoppingCart,
    accent: "#6C63FF",
    href: "/orders",
    items: ["Pedidos", "Envios"],
    description: "Pedidos e envios de colportagem",
    adminOnly: false,
  },
  {
    key: "logistica",
    label: "Logística",
    icon: Truck,
    accent: "#10B981",
    href: "/estoque",
    items: ["Fiorino", "Estoque"],
    description: "Veículos e controle de estoque",
    adminOnly: false,
  },
  {
    key: "gestao",
    label: "Gestão",
    icon: BarChart2,
    accent: "#F59E0B",
    href: "/reports",
    items: ["Relatórios", "Galeria", "Configurações"],
    description: "Análises, relatórios e configurações",
    adminOnly: true,
  },
  {
    key: "campanhas",
    label: "Campanhas",
    icon: BookOpen,
    accent: "#3B82F6",
    href: "/campanhas/acertos",
    items: ["Acertos", "Lançamentos", "Líderes", "Encerramento"],
    description: "Ciclos de acerto de campanhas",
    adminOnly: false,
  },
];

export default function HubPage() {
  const { isAdmin, displayName } = useContext(UserContext);
  const firstName = displayName?.split(" ")[0] ?? "";
  const visible = MODULES.filter((m) => !m.adminOnly || isAdmin);

  return (
    <div className="min-h-full px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Olá{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">Selecione um módulo para continuar</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {visible.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.key}
                href={mod.href}
                className="group relative flex flex-col p-6 rounded-xl bg-card border border-slate-800 hover:border-[--mod-accent] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 active:scale-[0.98]"
                style={{ "--mod-accent": mod.accent } as React.CSSProperties}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${mod.accent}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: mod.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-base text-foreground">{mod.label}</h2>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{mod.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-5">
                  {mod.items.map((item) => (
                    <span
                      key={item}
                      className="text-[11px] px-2.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${mod.accent}18`, color: mod.accent }}
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div
                  className="absolute bottom-0 left-5 right-5 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: `linear-gradient(90deg, transparent, ${mod.accent}, transparent)` }}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
