"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Users, ChevronRight } from "lucide-react";
import { useUserRole } from "@/lib/user-context";

const settingsItems = [
  {
    to: "/products",
    icon: Package,
    label: "Catálogo",
    description: "Gerencie produtos e disponibilidade",
  },
  {
    to: "/admin",
    icon: Users,
    label: "Usuários",
    description: "Gerencie operadores, campos e permissões",
  },
];

export default function SettingsPage() {
  const { isAdmin, profileLoaded } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin) router.replace("/orders");
  }, [isAdmin, profileLoaded, router]);

  if (!profileLoaded || !isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Configurações</h1>
        <p className="text-sm text-slate-400 mt-1">Área administrativa do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link
            key={item.to}
            href={item.to}
            className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
              <item.icon className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
