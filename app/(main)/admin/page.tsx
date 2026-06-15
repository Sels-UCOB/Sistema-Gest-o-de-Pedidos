"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfiles, updateProfile, ProfileRow, getCampanhas, saveCampanhas, CampanhaDef } from "@/lib/supabase-db";
import type { CampoId } from "@/lib/campos";
import { useUserRole } from "@/lib/user-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, PlusCircle } from "lucide-react";

const CAMPO_TABS: Array<{ id: CampoId; label: string }> = [
  { id: "GO", label: "Sede" },
  { id: "MT", label: "MT" },
  { id: "MS", label: "MS" },
];

export default function AdminPage() {
  const { isAdmin, profileLoaded, refreshTick } = useUserRole();
  const router = useRouter();

  // ── Usuários ──
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // ── Campanhas ──
  const [campanhas, setCampanhas] = useState<CampanhaDef[]>([]);
  const [campLoading, setCampLoading] = useState(true);
  const [campSaving, setCampSaving] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCampo, setNewCampo] = useState<CampoId>("GO");

  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin) { router.replace("/products"); return; }

    getProfiles()
      .then(setProfiles)
      .catch(() => alert("Erro ao carregar usuários."))
      .finally(() => setLoading(false));

    getCampanhas()
      .then(setCampanhas)
      .catch(() => alert("Erro ao carregar campanhas."))
      .finally(() => setCampLoading(false));
  }, [isAdmin, profileLoaded, router, refreshTick]);

  const handleChange = async (id: string, field: "role" | "campo", value: string) => {
    setSaving(id);
    try {
      const update =
        field === "campo" ? { campo: value === "null" ? null : value as ProfileRow["campo"] } :
                            { role: value as ProfileRow["role"] };
      await updateProfile(id, update);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    } catch {
      alert("Erro ao salvar alteração.");
    } finally {
      setSaving(null);
    }
  };

  const handleAddCampanha = async () => {
    const code = newCode.trim();
    if (!code) return;
    if (campanhas.some(c => c.code.toLowerCase() === code.toLowerCase())) {
      alert("Essa campanha já existe.");
      return;
    }
    const updated = [...campanhas, { code, campo: newCampo }]
      .sort((a, b) => a.code.localeCompare(b.code));
    setCampSaving(true);
    try {
      await saveCampanhas(updated);
      setCampanhas(updated);
      setNewCode("");
    } catch {
      alert("Erro ao salvar campanha.");
    } finally {
      setCampSaving(false);
    }
  };

  const handleRemoveCampanha = async (code: string) => {
    const updated = campanhas.filter(c => c.code !== code);
    setCampSaving(true);
    try {
      await saveCampanhas(updated);
      setCampanhas(updated);
    } catch {
      alert("Erro ao remover campanha.");
    } finally {
      setCampSaving(false);
    }
  };

  const campoLabel: Record<CampoId, string> = { GO: "Sede (GO)", MT: "MT", MS: "MS" };
  const grouped = CAMPO_TABS.map(t => ({
    ...t,
    items: campanhas.filter(c => c.campo === t.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Administração</h1>
        <p className="text-slate-500 text-sm">Gerencie usuários e campanhas do sistema.</p>
      </div>

      {/* ── Usuários ── */}
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.email ?? p.id}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap items-end">
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

      {/* ── Campanhas ── */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg">Campanhas</CardTitle>
          <CardDescription>
            Gerencie os códigos de campanha disponíveis para criação de pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {campLoading ? (
            <p className="text-slate-500 text-sm py-4 text-center">Carregando...</p>
          ) : (
            <>
              {/* Adicionar nova campanha */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Código da campanha (ex: ALM SA - 9510)"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCampanha()}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
                />
                <Select value={newCampo} onValueChange={v => setNewCampo(v as CampoId)}>
                  <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-700 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPO_TABS.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label} ({c.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddCampanha}
                  disabled={!newCode.trim() || campSaving}
                  className="shrink-0"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {/* Lista agrupada por campo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {grouped.map(grupo => (
                  <div key={grupo.id} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {grupo.label} ({grupo.id})
                    </p>
                    <div className="space-y-1.5">
                      {grupo.items.length === 0 && (
                        <p className="text-xs text-slate-600 italic">Nenhuma campanha</p>
                      )}
                      {grupo.items.map(camp => (
                        <div
                          key={camp.code}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-800/40 group"
                        >
                          <span className="text-sm text-slate-200 font-mono">{camp.code}</span>
                          <button
                            onClick={() => handleRemoveCampanha(camp.code)}
                            disabled={campSaving}
                            className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600">
                {campanhas.length} campanha{campanhas.length !== 1 ? "s" : ""} cadastrada{campanhas.length !== 1 ? "s" : ""} · as alterações são salvas imediatamente
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
