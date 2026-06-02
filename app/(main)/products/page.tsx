"use client";

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { Product } from "@/lib/db";
import {
  getProducts, upsertProducts, upsertProduct, updateProduct,
  deleteProduct as deleteProductDb, clearProducts,
  getInventory, addInventoryStock, bulkSetInventory, InventoryRow,
} from "@/lib/supabase-db";
import { WAREHOUSES, WarehouseId } from "@/lib/campos";
import { useUserRole } from "@/lib/user-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Trash2, Edit2, Check, X, PackagePlus, Search } from "lucide-react";

export default function ProductsPage() {
  const { isAdmin, campo, profileLoaded, refreshTick } = useUserRole();
  const { confirm, dialog: confirmDialog } = useConfirm();
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
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseId | "">("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const deferredNameFilter = useDeferredValue(nameFilter);
  const isFiltering = nameFilter !== deferredNameFilter;

  const availableWarehouses = useMemo(
    () => isAdmin || !campo ? [...WAREHOUSES] : WAREHOUSES.filter(w => w.campo === campo),
    [isAdmin, campo],
  );

  useEffect(() => {
    if (!selectedWarehouse && availableWarehouses.length > 0) {
      setSelectedWarehouse(availableWarehouses[0].id);
    }
  }, [availableWarehouses, selectedWarehouse]);

  const loadProducts = useCallback(async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setProducts([]);
    }
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
    if (!profileLoaded) return;
    loadProducts();
    loadInventory();
  }, [loadProducts, loadInventory, profileLoaded, refreshTick]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory) {
      map.set(`${row.product_id}__${row.warehouse_id}`, row.quantity);
    }
    return map;
  }, [inventory]);

  const productList = products ?? [];

  const getStock = (productId: string, warehouseId: WarehouseId) =>
    inventoryMap.get(`${productId}__${warehouseId}`) ?? 0;

  const filteredList = useMemo(() => {
    let list = productList;
    if (onlyInStock && selectedWarehouse) {
      list = list.filter(p => getStock(p.id, selectedWarehouse as WarehouseId) > 0);
    }
    if (deferredNameFilter.trim()) {
      const q = deferredNameFilter.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productList, onlyInStock, selectedWarehouse, inventoryMap, deferredNameFilter]);

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

      let productColIdx = 1;
      outer1: for (let ri = 0; ri < Math.min(rows.length, 20); ri++) {
        const row = rows[ri] as unknown[];
        for (let ci = 0; ci < row.length; ci++) {
          const h = norm(String(row[ci] ?? ""));
          if (h === "produto" || h === "descricao") { productColIdx = ci; break outer1; }
        }
      }

      let saldoColIdx = -1;
      outer2: for (let ri = 0; ri < Math.min(rows.length, 20); ri++) {
        const row = rows[ri] as unknown[];
        for (let ci = productColIdx + 1; ci < row.length; ci++) {
          const h = norm(String(row[ci] ?? ""));
          if (h === "saldo final" || h === "saldo") { saldoColIdx = ci; break outer2; }
        }
      }

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

      await upsertProducts(newProducts);
      if (inventoryRows.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < inventoryRows.length; i += CHUNK) {
          await bulkSetInventory(inventoryRows.slice(i, i + CHUNK));
        }
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

  const handleEntry = async (e: React.FormEvent<HTMLFormElement>) => {
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
    try {
      await updateProduct(id, editName.trim());
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar nome do produto.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (await confirm("Excluir este produto?", { description: "Esta ação não pode ser desfeita.", confirmLabel: "Excluir", destructive: true })) {
      try {
        await deleteProductDb(id);
        await loadProducts();
        await loadInventory();
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir produto.");
      }
    }
  };

  const clearAll = async () => {
    if (await confirm("Apagar todos os produtos?", { description: "Esta ação removerá todo o catálogo e não pode ser desfeita.", confirmLabel: "Apagar tudo", destructive: true })) {
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

  const selectedWarehouseLabel = WAREHOUSES.find(w => w.id === selectedWarehouse)?.label ?? "";

  return (
    <div className="space-y-4 sm:space-y-6">
      {confirmDialog}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Catálogo de Produtos</h1>
          <p className="text-slate-500 text-sm">
            {isAdmin ? "Gerencie produtos e estoques por depósito." : "Consulte o catálogo e estoques disponíveis."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setImportDialog(true)} className="flex-1 sm:flex-none sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Importar XLS
            </Button>
            {products && products.length > 0 && (
              <Button variant="destructive" onClick={clearAll} className="flex-1 sm:flex-none sm:w-auto">
                Limpar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        {isAdmin && (
          <Card className="lg:col-span-1 border-slate-800 bg-slate-900/50 order-2 lg:order-1 self-start">
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
        )}

        <Card className={`${isAdmin ? "lg:col-span-3" : "lg:col-span-4"} border-slate-800 bg-slate-900/50 order-1 lg:order-2`}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  Produtos Cadastrados (
                  {filteredList.length !== productList.length
                    ? `${filteredList.length} de ${productList.length}`
                    : productList.length}
                  )
                </CardTitle>
                {isAdmin && (
                  <CardDescription className="mt-1">
                    Clique em + para adicionar estoque ao depósito selecionado.
                  </CardDescription>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    placeholder="Buscar produto..."
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                    className="pl-8 w-full bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9"
                  />
                </div>
                <Select
                  value={selectedWarehouse}
                  onValueChange={(v) => setSelectedWarehouse(v as WarehouseId)}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Selecione o depósito..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWarehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWarehouse && (
                  <button
                    onClick={() => setOnlyInStock(v => !v)}
                    className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                      onlyInStock
                        ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    Somente em estoque
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {products === undefined ? (
              <div className="text-center py-12 text-slate-500">Carregando...</div>
            ) : productList.length > 0 ? (
              <>
                {/* ── Desktop: tabela ── */}
                <div className={`rounded-md border max-h-[600px] overflow-y-auto overflow-x-auto hidden md:block transition-opacity duration-200 ${isFiltering ? "opacity-40" : "opacity-100"}`}>
                  <Table>
                    <TableHeader className="bg-slate-800/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-[90px]">Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-center w-[120px]">Estoque</TableHead>
                        {isAdmin && <TableHead className="w-[80px] text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-slate-500">
                            Nenhum produto com estoque disponível em {selectedWarehouseLabel}.
                          </TableCell>
                        </TableRow>
                      ) : filteredList.map((p) => {
                        const qty = selectedWarehouse ? getStock(p.id, selectedWarehouse) : 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs text-slate-400">{p.id}</TableCell>
                            <TableCell>
                              {isAdmin && editingId === p.id ? (
                                <div className="flex items-center gap-2">
                                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") setEditingId(null); }} />
                                  <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)} className="h-8 w-8 text-green-600"><Check className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 text-slate-400"><X className="h-4 w-4" /></Button>
                                </div>
                              ) : (
                                <span className="text-slate-200 text-sm">{p.name}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center p-2">
                              <div className="inline-flex items-center justify-center gap-2">
                                <span className={`text-sm tabular-nums ${qty === 0 ? "text-slate-600" : "text-slate-200 font-medium"}`}>{qty}</span>
                                {isAdmin && selectedWarehouse && (
                                  <button onClick={() => openStockDialog(p.id, p.name, selectedWarehouse)}
                                    className="rounded p-0.5 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right p-2">
                                <Button size="icon" variant="ghost" onClick={() => startEditing(p)} className="h-8 w-8 text-slate-400 hover:text-white"><Edit2 className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(p.id)} className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Mobile: cards ── */}
                <div className={`md:hidden space-y-2 max-h-[65vh] overflow-y-auto transition-opacity duration-200 ${isFiltering ? "opacity-40" : "opacity-100"}`}>
                  {filteredList.length === 0 ? (
                    <p className="text-center py-8 text-slate-500 text-sm">
                      Nenhum produto com estoque disponível em {selectedWarehouseLabel}.
                    </p>
                  ) : filteredList.map((p) => {
                    const qty = selectedWarehouse ? getStock(p.id, selectedWarehouse) : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-800 bg-slate-900/40">
                        <div className="flex-1 min-w-0">
                          {isAdmin && editingId === p.id ? (
                            <div className="flex items-center gap-2">
                              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-sm flex-1" autoFocus
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") setEditingId(null); }} />
                              <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)} className="h-9 w-9 text-emerald-400 shrink-0"><Check className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-9 w-9 shrink-0"><X className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-white text-sm leading-snug">{p.name}</p>
                              <p className="font-mono text-[10px] text-slate-500 mt-0.5">{p.id}</p>
                            </>
                          )}
                        </div>
                        {editingId !== p.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-sm font-bold tabular-nums w-8 text-center ${qty > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                              {qty}
                            </span>
                            {isAdmin && (
                              <>
                                {selectedWarehouse && (
                                  <Button size="icon" variant="ghost" className="h-10 w-10 text-indigo-400"
                                    onClick={() => openStockDialog(p.id, p.name, selectedWarehouse)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-slate-400"
                                  onClick={() => startEditing(p)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-red-500"
                                  onClick={() => handleDeleteProduct(p.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                {isAdmin
                  ? "Nenhum produto cadastrado. Importe um XLS ou adicione manualmente."
                  : "Nenhum produto cadastrado ainda."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import dialog */}
      <Dialog open={importDialog} onOpenChange={(open) => { if (!importing) setImportDialog(open); }}>
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
