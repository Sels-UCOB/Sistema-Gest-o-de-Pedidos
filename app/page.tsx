"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/orders");
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#6C63FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#6C63FF]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-[#6C63FF] rounded-3xl flex items-center justify-center shadow-2xl shadow-black/40 mb-6">
            <img
              src="/logo.png"
              alt="Sels Ucob"
              className="w-16 h-16 object-contain brightness-0 invert"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Bem-vindo</h1>
          <p className="text-[#8B8FA8] text-[13px] mt-2">Entre com suas credenciais válidas.</p>
        </div>

        {/* Card */}
        <div className="bg-[#1A1F2E]/90 border border-[#2A2F45] rounded-2xl shadow-2xl shadow-black/40 p-6 sm:p-8 backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#8B8FA8]">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-[#2A2F45]/70 border-[#2A2F45] text-white placeholder:text-[#8B8FA8]/60 focus:border-[#6C63FF] h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#8B8FA8]">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-[#2A2F45]/70 border-[#2A2F45] text-white placeholder:text-[#8B8FA8]/60 focus:border-[#6C63FF] h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8FA8] hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#6C63FF] hover:bg-[#7B74FF] text-white font-semibold rounded-xl shadow-lg shadow-[#6C63FF]/25 transition-all duration-200 hover:shadow-[#6C63FF]/40 mt-2"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-[13px] text-[#8B8FA8] mt-5">
            Não tem conta?{" "}
            <Link href="/register" className="text-[#6C63FF] hover:text-white transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
      <p className="absolute bottom-6 text-[#8B8FA8]/30 text-xs">
        Sels Ucob © {new Date().getFullYear()}
      </p>
    </div>
  );
}
