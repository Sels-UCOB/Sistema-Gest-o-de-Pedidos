import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Product } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Trash2, Edit2, Check, X } from "lucide-react";

export default function ProductsPage() {
  const products = useLiveQuery(() => db.products.toArray());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      const xlsx = await import('xlsx');
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
        await processCsv(csv);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = async ({ target }) => {
        const csv = target?.result as string;
        await processCsv(csv);
      };
      reader.readAsText(file, 'Windows-1252');
    }
  }

  const processCsv = async (csvData: string) => {
    const lines = csvData.split(/\r?\n/);
    const newProducts: Product[] = [];
    console.log(newProducts.find(p => p.id === '9181'));
    console.log(newProducts.map(p => p.id + ' ' + p.name));
    console.log('primeiras linhas:', csvData.substring(0, 200));
    console.log(newProducts.find(p => p.id === '9181'));
   for (const line of lines) {
  if (!line.trim()) continue;
  const parts = line.split(";");
  const firstCol = parts[0].trim();
  const match = firstCol.match(/^(\d+)\s+(.+)$/);
  if (match) {
    const code = match[1];
    const name = match[2].trim();
    newProducts.push({ id: code, name });
  }
}
    if (newProducts.length > 0) {
      // Upsert into DB
      await db.products.bulkPut(newProducts);
      alert(`Importados ${newProducts.length} produtos!`);
    } else {
      alert("Nenhum produto encontrado neste arquivo. Verifique o formato.");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    try {
      await db.products.put({ id: newCode.trim(), name: newName.trim() });
      setNewCode("");
      setNewName("");
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar o produto.");
    }
  };

  const startEditing = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await db.products.update(id, { name: editName.trim() });
    setEditingId(null);
  };

  const deleteProduct = async (id: string) => {
    if (confirm("Deseja realmente excluir este produto?")) {
      await db.products.delete(id);
    }
  };

  const clearAll = async () => {
    if (confirm("APAGAR TODOS OS PRODUTOS? Esta acao nao pode ser desfeita.")) {
      await db.products.clear();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Lista de Produtos</h1>
          <p className="text-slate-400">Importe e gerencie seus produtos base.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={() => document.getElementById("csv-upload")?.click()} className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <input
            id="csv-upload"
            type="file"
            accept=".csv, .txt, .xls, .xlsx"
            className="hidden"
            onChange={handleFileUpload}
          />
          {products && products.length > 0 && (
            <Button variant="destructive" onClick={clearAll} className="w-full sm:w-auto">
              Limpar Catálogo
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* ADD MANUAL */}
        <Card className="lg:col-span-1 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg">Inserir Produto Manualmente</CardTitle>
            <CardDescription>Insira um formato divergente ou não presente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Código do Produto</label>
                <Input
                  placeholder="Ex: 184523"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Produto</label>
                <Input
                  placeholder="Ex: 21 dias para mudar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* LIST */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg">Produtos Cadastrados ({products?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {products && products.length > 0 ? (
              <div className="rounded-md border max-h-[600px] overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-800/50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.id}</TableCell>
                        <TableCell>
                          {editingId === p.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(p.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)} className="h-8 w-8 text-green-600">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 text-slate-400">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-200">{p.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => startEditing(p)} className="h-8 w-8 text-slate-400 hover:text-white">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)} className="h-8 w-8 text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Nenhum produto cadastrado. Importe um CSV ou adicione manualmente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
