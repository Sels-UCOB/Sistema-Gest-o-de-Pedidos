"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfiles, updateProfile, ProfileRow } from "@/lib/supabase-db";
import type { CampoId } from "@/lib/campos";
import { useUserRole } from "@/lib/user-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CAMPO_TABS: Array<{ id: CampoId; label: string }> = [
  { id: "GO", label: "Sede" },
  { id: "MT", label: "MT" },
  { id: "MS", label: "MS" },
];

export default function AdminPage() {
  const { isAdmin, profileLoaded } = useUserRole();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin) { router.replace("/products"); return; }
    getProfiles()
      .then(setProfiles)
      .catch(() => alert("Erro ao carregar usuários."))
      .finally(() => setLoading(false));
  }, [isAdmin, profileLoaded, router]);

  const handleChange = async (id: string, field: "role" | "campo", value: string) => {
    setSaving(id);
    try {
      const update = field === "campo"
        ? { campo: value === "null" ? null : value as ProfileRow["campo"] }
        : { role: value as ProfileRow["role"] };
      await updateProfile(id, update);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    } catch {
      alert("Erro ao salvar alteração.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight text-white">Gerenciar Usuários</h1>
        <p className="text-slate-500">Configure o campo e o perfil de cada operador.</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg">Usuários cadastrados</CardTitle>
          <CardDescription>
            Altere o campo para restringir o estoque e as campanhas visíveis ao operador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 text-sm py-6 text-center">Carregando...</p>
          ) : (
            <div className="space-y-3">
              {profiles.map(p => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-800/30"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.email ?? p.id}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div className="space-y-1 min-w-[130px]">
                      <p className="text-xs text-slate-400">Perfil</p>
                      <Select
                        value={p.role}
                        onValueChange={v => v !== null && handleChange(p.id, "role", v)}
                        disabled={saving === p.id}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="operator">Operador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 min-w-[130px]">
                      <p className="text-xs text-slate-400">Campo</p>
                      <Select
                        value={p.campo ?? "null"}
                        onValueChange={v => v !== null && handleChange(p.id, "campo", v)}
                        disabled={saving === p.id || p.role === "admin"}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">Todos (sem restrição)</SelectItem>
                          {CAMPO_TABS.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.label} ({c.id})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              {profiles.length === 0 && (
                <p className="text-center py-8 text-slate-500 text-sm">Nenhum usuário encontrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
