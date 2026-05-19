"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Product } from "@/lib/db";
import {
  getProducts, upsertProducts, upsertProduct, updateProduct,
  deleteProduct as deleteProductDb, clearProducts,
  getInventory, addInventoryStock, bulkSetInventory, InventoryRow,
} from "@/lib/supabase-db";
import { WAREHOUSES, WarehouseId, CampoId } from "@/lib/campos";
import { useUserRole } from "@/lib/user-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Trash2, Edit2, Check, X, PackagePlus } from "lucide-react";

const CAMPO_TABS: Array<{ id: CampoId; label: string }> = [
  { id: "GO", label: "Sede" },
  { id: "MT", label: "MT"  },
  { id: "MS", label: "MS"  },
];

export default function ProductsPage() {
  const { isAdmin, campo } = useUserRole();
  const [products, setProducts] = useState<Product[] | undefined>(undefined);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [entryCode, setEntryCode] = useState("");
  const [entryName, setEntryName] = useState("");
  const [entryQty, setEntryQty] = useState("");
  const [entryWarehouse, setEntryWarehouse] = useState<WarehouseId>("SEDE_EXT");
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [stockDialog, setStockDialog] = useState<{ productId: string; productName: string; warehouseId: WarehouseId } | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockWarehouse, setStockWarehouse] = useState<WarehouseId>("SEDE_EXT");
  const [importDialog, setImportDialog] = useState(false);
  const [importWarehouse, setImportWarehouse] = useState<WarehouseId>("SEDE_EXT");
  const [importing, setImporting] = useState(false);
  const [campoFilter, setCampoFilter] = useState<CampoId | "ALL">("GO");

  useEffect(() => {
    if (!isAdmin && campo) setCampoFilter(campo);
  }, [isAdmin, campo]);

  const loadProducts = useCallback(async () => {
    const data = await getProducts();
    setProducts(data);
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const data = await getInventory();
      setInventory(data);
    } catch {
      setInventory([]);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadInventory();
  }, [loadProducts, loadInventory]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory) {
      map.set(`${row.product_id}__${row.warehouse_id}`, row.quantity);
    }
    return map;
  }, [inventory]);

  const visibleWarehouses = useMemo(
    () => campoFilter === "ALL" ? [...WAREHOUSES] : WAREHOUSES.filter(w => w.campo === campoFilter),
    [campoFilter],
  );

  const filteredProducts = useMemo(() => products ?? [], [products]);

  const getStock = (productId: string, warehouseId: WarehouseId) =>
    inventoryMap.get(`${productId}__${warehouseId}`) ?? 0;

  function parseBrNumber(s: string): number {
    return Math.floor(parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const xlsx = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

      // Detecta coluna Produto pelo cabeçalho
      let productColIdx = 1;
      outer1: for (let ri = 0; ri < Math.min(rows.length, 20); ri++) {
        const row = rows[ri] as unknown[];
        for (let ci = 0; ci < row.length; ci++) {
          const h = norm(String(row[ci] ?? ""));
          if (h === "produto" || h === "descricao") { productColIdx = ci; break outer1; }
        }
      }

      // Estratégia 1: procura header "Saldo Final" nas primeiras linhas
      let saldoColIdx = -1;
      outer2: for (let ri = 0; ri < Math.min(rows.length, 20); ri++) {
        const row = rows[ri] as unknown[];
        for (let ci = productColIdx + 1; ci < row.length; ci++) {
          const h = norm(String(row[ci] ?? ""));
          if (h === "saldo final" || h === "saldo") { saldoColIdx = ci; break outer2; }
        }
      }

      // Estratégia 2: 7º valor numérico na 1ª linha de produto
      if (saldoColIdx < 0) {
        for (const r of rows) {
          const row = r as unknown[];
          const cell = String(row[productColIdx] ?? "").trim();
          if (!cell.match(/^\d+\s+.+$/)) continue;
          let numCount = 0;
          for (let ci = productColIdx + 1; ci < row.length; ci++) {
            const v = String(row[ci] ?? "").trim();
            if (v === "") continue;
            const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
            if (!isNaN(n)) { numCount++; if (numCount === 7) { saldoColIdx = ci; break; } }
          }
          if (saldoColIdx >= 0) break;
        }
      }

      if (saldoColIdx < 0) saldoColIdx = productColIdx + 20;
      console.log(`XLS: produtoCol=${productColIdx}, saldoCol=${saldoColIdx}`);

      const newProducts: Product[] = [];
      const inventoryRows: { product_id: string; warehouse_id: string; quantity: number }[] = [];

      for (const row of rows) {
        const cell = String((row as unknown[])[productColIdx] ?? "").trim();
        const match = cell.match(/^(\d+)\s+(.+)$/);
        if (!match) continue;
        const id = match[1];
        const name = match[2].trim();
        newProducts.push({ id, name });
        const saldo = parseBrNumber(String((row as unknown[])[saldoColIdx] ?? "0"));
        if (saldo > 0) inventoryRows.push({ product_id: id, warehouse_id: importWarehouse, quantity: saldo });
      }

      if (newProducts.length === 0) {
        const preview = rows.slice(0, 5).map(r => String((r as unknown[])[productColIdx] ?? "")).join("\n");
        alert(`Nenhum produto encontrado.\n\nColuna Produto: índice ${productColIdx}\nPrimeiras linhas:\n${preview}`);
        return;
      }

      if (inventoryRows.length === 0 && newProducts.length > 0) {
        const saldoPreview = rows.slice(0, 8)
          .map(r => `col${saldoColIdx}="${String((r as unknown[])[saldoColIdx] ?? "")}"`)
          .join("\n");
        console.warn(`Saldo Final (col ${saldoColIdx}) — nenhum valor > 0:\n${saldoPreview}`);
      }

      await upsertProducts(newProducts);
      if (inventoryRows.length > 0) {
        await bulkSetInventory(inventoryRows);
      }
      await loadProducts();
      await loadInventory();
      const wh = WAREHOUSES.find(w => w.id === importWarehouse)?.label ?? importWarehouse;
      alert(`${newProducts.length} produtos importados, ${inventoryRows.length} com saldo atualizado (${wh}).`);
      setImportDialog(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao processar o arquivo.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  const existingProduct = useMemo(
    () => products?.find(p => p.id === entryCode.trim()) ?? null,
    [products, entryCode],
  );

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = entryCode.trim();
    const name = existingProduct ? existingProduct.name : entryName.trim();
    const qty = parseInt(entryQty, 10);
    if (!code || !name || isNaN(qty) || qty <= 0) return;
    setEntrySubmitting(true);
    try {
      if (!existingProduct) await upsertProduct({ id: code, name });
      await addInventoryStock(code, entryWarehouse, qty);
      await loadProducts();
      await loadInventory();
      setEntryCode("");
      setEntryName("");
      setEntryQty("");
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar entrada.");
    } finally {
      setEntrySubmitting(false);
    }
  };

  const startEditing = (p: Product) => { setEditingId(p.id); setEditName(p.name); };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateProduct(id, editName.trim());
    setEditingId(null);
    await loadProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Deseja realmente excluir este produto?")) {
      await deleteProductDb(id);
      await loadProducts();
      await loadInventory();
    }
  };

  const clearAll = async () => {
    if (confirm("APAGAR TODOS OS PRODUTOS? Esta acao nao pode ser desfeita.")) {
      await clearProducts();
      await loadProducts();
      await loadInventory();
    }
  };

  const openStockDialog = (productId: string, productName: string, warehouseId: WarehouseId) => {
    setStockDialog({ productId, productName, warehouseId });
    setStockWarehouse(warehouseId);
    setStockQty("");
  };

  const handleAddStock = async () => {
    if (!stockDialog) return;
    const qty = parseInt(stockQty, 10);
    if (isNaN(qty) || qty <= 0) { alert("Digite uma quantidade válida."); return; }
    try {
      await addInventoryStock(stockDialog.productId, stockWarehouse, qty);
      await loadInventory();
      setStockDialog(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar estoque.");
    }
  };

  const filterTabs = isAdmin
    ? [...CAMPO_TABS, { id: "ALL" as const, label: "Todos" }]
    : campo
      ? CAMPO_TABS.filter(t => t.id === campo)
      : CAMPO_TABS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-white">Catálogo de Produtos</h1>
          <p className="text-slate-500">
            {isAdmin ? "Gerencie produtos e estoques por depósito." : "Consulte o catálogo e estoques disponíveis."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setImportDialog(true)} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Importar XLS
            </Button>
            {products && products.length > 0 && (
              <Button variant="destructive" onClick={clearAll} className="w-full sm:w-auto">
                Limpar Catálogo
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        <Card className="lg:col-span-1 border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg">Entrada de Material</CardTitle>
              <CardDescription>
                {existingProduct
                  ? `Produto encontrado: ${existingProduct.name}`
                  : entryCode.length >= 4
                    ? "Produto novo"
                    : "Digite o código para identificar o produto."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEntry} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código</label>
                  <Input
                    placeholder="Ex: 184523"
                    value={entryCode}
                    onChange={(e) => { setEntryCode(e.target.value); setEntryName(""); }}
                    required
                  />
                </div>
                {!existingProduct && entryCode.trim().length >= 4 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do produto</label>
                    <Input
                      placeholder="Ex: Revista 2026"
                      value={entryName}
                      onChange={(e) => setEntryName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Depósito</label>
                  <Select value={entryWarehouse} onValueChange={(v) => setEntryWarehouse(v as WarehouseId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WAREHOUSES.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantidade</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 50"
                    value={entryQty}
                    onChange={(e) => setEntryQty(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={entrySubmitting}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  {entrySubmitting ? "Registrando..." : "Dar Entrada"}
                </Button>
              </form>
            </CardContent>
          </Card>

        <Card className="lg:col-span-3 border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  Produtos Cadastrados ({filteredProducts.length})
                </CardTitle>
                {isAdmin && (
                  <CardDescription className="mt-1">
                    Clique no número para adicionar estoque ao depósito.
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-1 bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
                {filterTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCampoFilter(tab.id)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      campoFilter === tab.id
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {products === undefined ? (
              <div className="text-center py-12 text-slate-500">Carregando...</div>
            ) : filteredProducts.length > 0 ? (
              <div className="rounded-md border max-h-[600px] overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-800/50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[90px]">Código</TableHead>
                      <TableHead className="min-w-[180px]">Nome</TableHead>
                      {visibleWarehouses.map(w => (
                        <TableHead key={w.id} className="text-center whitespace-nowrap text-xs w-[90px]">
                          {w.label.replace(/^(Sede|MT|MS)\s*—\s*/, "")}
                        </TableHead>
                      ))}
                      {isAdmin && <TableHead className="w-[80px] text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs text-slate-400">{p.id}</TableCell>
                        <TableCell>
                          {isAdmin && editingId === p.id ? (
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
                            <span className="text-slate-200 text-sm">{p.name}</span>
                          )}
                        </TableCell>
                        {visibleWarehouses.map(w => {
                          const qty = getStock(p.id, w.id);
                          return (
                            <TableCell key={w.id} className="text-center p-2">
                              {isAdmin ? (
                                <button
                                  onClick={() => openStockDialog(p.id, p.name, w.id)}
                                  className="group inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-indigo-500/10 transition-colors"
                                  title={`Adicionar estoque — ${w.label}`}
                                >
                                  <span className={qty === 0 ? "text-slate-600 text-sm" : "text-slate-200 text-sm font-medium"}>
                                    {qty}
                                  </span>
                                  <Plus className="h-3 w-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ) : (
                                <span className={qty === 0 ? "text-slate-600 text-sm" : "text-slate-200 text-sm font-medium"}>
                                  {qty}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        {isAdmin && (
                          <TableCell className="text-right p-2">
                            <Button size="icon" variant="ghost" onClick={() => startEditing(p)} className="h-8 w-8 text-slate-400 hover:text-white">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(p.id)} className="h-8 w-8 text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                {products.length === 0
                  ? isAdmin
                    ? "Nenhum produto cadastrado. Importe um XLS ou adicione manualmente."
                    : "Nenhum produto cadastrado ainda."
                  : "Nenhum produto importado para este campo ainda."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-sm border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Importar XLS</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Selecione o depósito de destino e o arquivo XLS do ACS. O Saldo Final será detectado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Depósito</label>
              <Select value={importWarehouse} onValueChange={(v) => setImportWarehouse(v as WarehouseId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSES.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
            <Button disabled={importing} onClick={() => document.getElementById("xls-upload")?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importando..." : "Selecionar arquivo"}
            </Button>
            <input id="xls-upload" type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileUpload} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add stock dialog */}
      {isAdmin && (
        <Dialog open={!!stockDialog} onOpenChange={(open) => !open && setStockDialog(null)}>
          <DialogContent className="max-w-sm border-slate-800 bg-slate-900">
            <DialogHeader>
              <DialogTitle className="text-white">Adicionar Estoque</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs leading-snug">
                {stockDialog?.productName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Depósito</label>
                <Select value={stockWarehouse} onValueChange={(v) => setStockWarehouse(v as WarehouseId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSES.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade a adicionar</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ex: 50"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStockDialog(null)}>Cancelar</Button>
              <Button onClick={handleAddStock}>
                <PackagePlus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
