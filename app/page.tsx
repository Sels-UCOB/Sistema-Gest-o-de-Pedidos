"use client";

import { useRouter } from "next/navigation";
import { Package, ShoppingCart, Truck, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-xl shadow-indigo-500/30 mb-8">
          S
        </div>

        <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-3">
          Sels Ucob
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
          Gerenciador de<br />
          <span className="text-indigo-400">Pedidos</span>
        </h1>
        <p className="text-slate-400 text-base mb-10 leading-relaxed">
          Controle produtos, pedidos e envios em um só lugar. Simples, rápido e direto.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            { icon: Package, label: "Catálogo" },
            { icon: ShoppingCart, label: "Pedidos" },
            { icon: Truck, label: "Envios" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-sm"
            >
              <Icon className="w-4 h-4 text-indigo-400" />
              {label}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/products")}
          className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95"
        >
          Acessar o Sistema
          <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
        </button>

        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Sistema operacional
        </div>
      </div>

      <p className="absolute bottom-6 text-slate-700 text-xs">
        Sels Ucob © {new Date().getFullYear()}
      </p>
    </div>
  );
}
