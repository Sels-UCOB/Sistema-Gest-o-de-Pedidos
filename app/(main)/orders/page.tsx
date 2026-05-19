"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Order, OrderItem, Product } from "@/lib/db";
import { getProducts, getOrders, getOrderFull, addOrder, updateOrder, deductInventoryStock, getInventory } from "@/lib/supabase-db";
import type { InventoryRow } from "@/lib/supabase-db";
import { CAMPO_MAP, WAREHOUSES, WarehouseId } from "@/lib/campos";
import { findBestMatch } from "@/lib/string-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Search, PlusCircle, ChevronRight, Package } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/lib/user-context";


export default function OrdersPage() {
  const { displayName, isAdmin, campo, profileLoaded, refreshTick } = useUserRole();

  const CAMPANHAS = useMemo(() => {
    const all = Object.keys(CAMPO_MAP).sort();
    if (isAdmin || !campo) return all;
    return all.filter(c => CAMPO_MAP[c] === campo);
  }, [isAdmin, campo]);
  const [activeTab, setActiveTab] = useState("create");
  const [products, setProducts] = useState<Product[] | undefined>(undefined);
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [rawItems, setRawItems] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    getProducts().then(setProducts).catch(() => setProducts([]));
    getInventory().then(setInventory).catch(() => setInventory([]));
    loadOrders();
  }, [loadOrders, profileLoaded, refreshTick]);

  useEffect(() => {
    const saved = localStorage.getItem('orderForm');
    if (saved) {
      const f = JSON.parse(saved);
      setCustomerName(f.customerName || '');
      setCampaignCode(f.campaignCode || '');
      setDestinationCity(f.destinationCity || '');
      setRawItems(f.rawItems || '');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('orderForm', JSON.stringify({
      customerName, campaignCode, destinationCity, rawItems
    }));
  }, [customerName, campaignCode, destinationCity, rawItems]);

  const [parsedItems, setParsedItems] = useState<OrderItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [separatingOrder, setSeparatingOrder] = useState<Order | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [photoItemQueue, setPhotoItemQueue] = useState<OrderItem | null>(null);
  const [photoItemIndex, setPhotoItemIndex] = useState<number | null>(null);
  const [packedPhotoQueue, setPackedPhotoQueue] = useState<Order | null>(null);

  const [warehouse, setWarehouse] = useState<WarehouseId | "">("");


  const warehouseOptions = campaignCode
    ? WAREHOUSES.filter(w => w.campo === CAMPO_MAP[campaignCode])
    : [];

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory) {
      map.set(`${row.product_id}__${row.warehouse_id}`, row.quantity);
    }
    return map;
  }, [inventory]);

  const getStock = (productId: string) =>
    warehouse ? (stockMap.get(`${productId}__${warehouse}`) ?? 0) : null;
  const [errors, setErrors] = useState<{customerName?: string, destinationCity?: string}>({});
  const [suggestions, setSuggestions] = useState<{id: string, name: string}[]>([]);
  const [ambiguousItems, setAmbiguousItems] = useState<{idx: number, query: string, options: {id: string, name: string}[]}[]>([]);
  const [manualSearch, setManualSearch] = useState<{idx: number, query: string} | null>(null);
  const [manualSearchResults, setManualSearchResults] = useState<{id: string, name: string}[]>([]);

  const handleParseItems = () => {
    if (!products) return;
    const lines = rawItems.split("\n").filter(l => l.trim().length > 0);
    const newParsed: OrderItem[] = [];
    const newAmbiguous: {idx: number, query: string, options: {id: string, name: string}[]}[] = [];
    for (const line of lines) {
      let qty = 1;
      let nameStr = line;

      const match = line.match(/^(\d+)(?:\s*[-xX]\s*|\s+)(.+)$/);
      if (match) {
        qty = parseInt(match[1], 10);
        nameStr = match[2];
      }

      const lowerName = nameStr.toLowerCase().trim();
      const multipleMatches = products.filter(p =>
        p.name.toLowerCase().includes(lowerName.replace(/s$/, '')) ||
        lowerName.split(" ").filter(w => w.length >= 3).some(w => p.name.toLowerCase().includes(w))
      ).slice(0, 5);

      const exactMatch = multipleMatches.find(p => p.name.toLowerCase() === lowerName);
      let bestProductMatch = exactMatch || (multipleMatches.length === 1 ? multipleMatches[0] : findBestMatch(nameStr, products));

      if (!exactMatch && multipleMatches.length > 1 && !bestProductMatch) {
        newAmbiguous.push({ idx: newParsed.length, query: nameStr, options: multipleMatches });
        bestProductMatch = multipleMatches[0];
      }

      if (bestProductMatch) {
        newParsed.push({ productId: bestProductMatch.id, name: bestProductMatch.name, quantity: qty, isSeparated: false });
      } else {
        newParsed.push({ productId: `unknown-${Date.now()}`, name: nameStr, quantity: qty, isSeparated: false });
      }
    }
    setParsedItems(newParsed);
    setAmbiguousItems(newAmbiguous);
    setShowPreview(true);
  };

  const handleCreateOrder = async () => {
    const nomeValido = (val: string) => val.trim().length >= 3 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val.trim());
    const newErrors: {customerName?: string, destinationCity?: string} = {};

    if (!nomeValido(customerName)) newErrors.customerName = "Mínimo 3 letras, sem números.";
    if (!nomeValido(destinationCity)) newErrors.destinationCity = "Mínimo 3 letras, sem números.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    if (!warehouse) { alert("Selecione o depósito de origem."); return; }
    if (parsedItems.length === 0) { alert("Adicione pelo menos um item ao pedido."); return; }

    const semEstoque = parsedItems
      .filter(item => !item.productId.startsWith("unknown-"))
      .filter(item => (stockMap.get(`${item.productId}__${warehouse}`) ?? 0) < item.quantity);
    if (semEstoque.length > 0) {
      const lista = semEstoque.map(i => {
        const disp = stockMap.get(`${i.productId}__${warehouse}`) ?? 0;
        return `• ${i.name}: pedido ${i.quantity}, disponível ${disp}`;
      }).join("\n");
      const ok = confirm(`Estoque insuficiente para:\n\n${lista}\n\nDeseja criar o pedido mesmo assim?`);
      if (!ok) return;
    }
    if (ambiguousItems.length > 0) {
      alert("Existem itens com múltiplas opções. Selecione o produto correto para cada um antes de confirmar.");
      return;
    }
    if (parsedItems.some(item => item.productId.startsWith('unknown-'))) {
      alert("Existem produtos não identificados. Revise os itens antes de confirmar.");
      setShowPreview(true);
      return;
    }
    try {
      await addOrder({
        customerName,
        campaignCode,
        destinationCity,
        responsible: displayName,
        status: "pending",
        items: parsedItems,
      });
      try { await deductInventoryStock(parsedItems, warehouse); } catch (e) {
        console.error("Erro ao deduzir estoque:", e);
        alert("Pedido criado, mas houve um erro ao deduzir o estoque. Verifique o catálogo manualmente.");
      }
      getInventory().then(setInventory).catch(() => {});
      setCustomerName("");
      setCampaignCode("");
      setWarehouse("");
      setDestinationCity("");
      setRawItems("");
      setParsedItems([]);
      setShowPreview(false);
      setActiveTab("list");
      localStorage.removeItem('orderForm');
      await loadOrders();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar pedido.");
    }
  };

  const openSeparationView = async (order: Order) => {
    setLoadingOrderId(order.id);
    try {
      const full = await getOrderFull(order.id);
      setSeparatingOrder(full);
    } catch {
      alert("Erro ao carregar o pedido. Tente novamente.");
    } finally {
      setLoadingOrderId(null);
    }
  };

  const toggleSeparation = async (order: Order, itemIndex: number) => {
    const item = order.items[itemIndex];
    if (!item.isSeparated) {
      setPhotoItemQueue({ ...item });
      setPhotoItemIndex(itemIndex);
      setSeparatingOrder(order);
    } else {
      const newItems = order.items.map((it, i) =>
        i === itemIndex ? { ...it, isSeparated: false, photoUrl: undefined } : it
      );
      try {
        await updateOrder(order.id, { items: newItems });
        setSeparatingOrder({ ...order, items: newItems });
      } catch {
        alert("Erro ao atualizar item. Tente novamente.");
      }
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>, type: 'item' | 'packed') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (type === 'item' && photoItemQueue && separatingOrder && photoItemIndex !== null) {
        const newItems = separatingOrder.items.map((it, i) =>
          i === photoItemIndex
            ? { ...it, isSeparated: true, photoUrl: base64 }
            : it
        );
        const updatedStatus = separatingOrder.status === 'pending' ? 'separating' : separatingOrder.status;
        await updateOrder(separatingOrder.id, { items: newItems, status: updatedStatus });
        setSeparatingOrder({ ...separatingOrder, items: newItems, status: updatedStatus });
        setPhotoItemQueue(null);
        setPhotoItemIndex(null);
        if (newItems.every(i => i.isSeparated)) {
          const packedData = { ...separatingOrder, items: newItems, status: updatedStatus };
          setTimeout(() => { setPackedPhotoQueue(packedData); }, 300);
        }
      } else if (type === 'packed' && packedPhotoQueue) {
        await updateOrder(packedPhotoQueue.id, { packedPhotoUrl: base64, status: "closed" });
        setSeparatingOrder(null);
        setPackedPhotoQueue(null);
        await loadOrders();
      }
    };
    reader.readAsDataURL(file);
  };

  const statusMap = {
    pending: { label: "Pendente" },
    separating: { label: "Separando" },
    closed: { label: "Fechado" },
    shipped: { label: "Enviado" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-white">Gestão de Pedidos</h1>
          <p className="text-slate-500">Crie, separe e acompanhe os pedidos.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="create">Criar</TabsTrigger>
          <TabsTrigger value="list">Gerenciar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {separatingOrder && !packedPhotoQueue ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Separando Pedido: {separatingOrder.customerName}</CardTitle>
                  <CardDescription>
                    Campanha: {separatingOrder.campaignCode} | Destino: {separatingOrder.destinationCity}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSeparatingOrder(null)}>Voltar</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {separatingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50 shadow-sm">
                      <Checkbox
                        id={`item-${idx}`}
                        checked={item.isSeparated}
                        onCheckedChange={() => toggleSeparation(separatingOrder, idx)}
                        disabled={separatingOrder.status === 'closed' || separatingOrder.status === 'shipped'}
                      />
                      <div className="flex-1">
                        <label htmlFor={`item-${idx}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          <span className="font-bold mr-2">{item.quantity}x</span>
                          {item.name}
                        </label>
                        <p className="text-xs text-slate-500 mt-1">Cód: {item.productId}</p>
                      </div>
                      {item.photoUrl && (
                        <div className="h-10 w-10 border rounded overflow-hidden">
                          <img src={item.photoUrl} alt="separado" className="object-cover w-full h-full" />
                        </div>
                      )}
                    </div>
                  ))}
                  {separatingOrder.packedPhotoUrl && (
                    <div className="mt-6 p-4 bg-slate-800/40 rounded-lg border border-slate-800 flex flex-col items-center">
                      <p className="font-medium text-white mb-2">Caixa Fechada:</p>
                      <img src={separatingOrder.packedPhotoUrl} alt="Caixa embalada" className="max-w-xs rounded shadow-sm border" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="text-slate-400">{format(order.createdAt, 'dd/MM HH:mm')}</TableCell>
                        <TableCell className="font-bold text-white">{order.customerName}</TableCell>
                        <TableCell className="text-slate-300">{order.items.length} itens</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-slate-800 text-slate-400' : order.status === 'separating' ? 'bg-amber-500/10 text-amber-500' : order.status === 'closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {statusMap[order.status].label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" disabled={loadingOrderId === order.id} onClick={() => openSeparationView(order)}>
                            {loadingOrderId === order.id ? "..." : order.status === 'pending' || order.status === 'separating' ? "Separar" : "Visualizar"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!orders || orders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          {orders === undefined ? "Carregando..." : "Nenhum pedido encontrado."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardContent className="p-3 flex flex-col gap-3 md:hidden">
                {orders?.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white text-sm">{order.customerName}</span>
                      <span className="text-xs text-slate-400">{order.items.length} itens · {format(order.createdAt, 'dd/MM HH:mm')}</span>
                      <span className={`mt-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-slate-800 text-slate-400' : order.status === 'separating' ? 'bg-amber-500/10 text-amber-500' : order.status === 'closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        {statusMap[order.status].label}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" disabled={loadingOrderId === order.id} onClick={() => openSeparationView(order)}>
                      {loadingOrderId === order.id ? "..." : order.status === 'pending' || order.status === 'separating' ? "Separar" : "Ver"}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!orders || orders.length === 0) && (
                  <p className="text-center py-8 text-slate-500 text-sm">
                    {orders === undefined ? "Carregando..." : "Nenhum pedido encontrado."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Criar Novo Pedido</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do Cliente</label>
                    <Input
                      value={customerName}
                      onChange={e => { setCustomerName(e.target.value); setErrors(prev => ({...prev, customerName: undefined})); }}
                      onBlur={e => { if (e.target.value.trim().length < 3 || /\d/.test(e.target.value)) setErrors(prev => ({...prev, customerName: "Mínimo 3 letras, sem números."})); }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          if (e.currentTarget.value.trim().length < 3 || /\d/.test(e.currentTarget.value)) {
                            setErrors(prev => ({...prev, customerName: "Mínimo 3 letras, sem números."}));
                          } else { e.preventDefault(); document.getElementById("input-campanha")?.focus(); }
                        }
                      }}
                    />
                    {errors.customerName && <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Código da Campanha</label>
                    <Select value={campaignCode} onValueChange={(value) => { setCampaignCode(value || ""); setWarehouse(""); }}>
                      <SelectTrigger id="input-campanha" className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPANHAS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Depósito de Origem</label>
                    <Select value={warehouse} onValueChange={(value) => setWarehouse(value as WarehouseId)} disabled={!campaignCode}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={campaignCode ? "Selecione o depósito..." : "Selecione a campanha primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseOptions.map(w => (<SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cidade de Destino</label>
                    <Input
                      value={destinationCity}
                      onChange={e => { setDestinationCity(e.target.value); setErrors(prev => ({...prev, destinationCity: undefined})); }}
                      onBlur={e => { if (e.target.value.trim().length < 3 || /\d/.test(e.target.value)) setErrors(prev => ({...prev, destinationCity: "Mínimo 3 letras, sem números."})); }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          if (e.currentTarget.value.trim().length < 3 || /\d/.test(e.currentTarget.value)) {
                            setErrors(prev => ({...prev, destinationCity: "Mínimo 3 letras, sem números."}));
                          } else { e.preventDefault(); document.getElementById("input-responsavel")?.focus(); }
                        }
                      }}
                    />
                    {errors.destinationCity && <p className="text-red-500 text-xs mt-1">{errors.destinationCity}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Responsável</label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-300 opacity-60 cursor-not-allowed select-none items-center">
                      {displayName || "—"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 relative">
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium flex justify-between">
                      Produtos e Quantidades
                      <span className="text-xs text-slate-400 font-normal">Coloque 1 item por linha</span>
                    </label>
                    <Textarea
                      rows={10}
                      className="font-mono text-sm leading-relaxed whitespace-pre-wrap"
                      placeholder={"Ex:\n10 - vida de jesus\n5 - 21 dias para mudar"}
                      value={rawItems}
                      onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                      onChange={e => {
                        setRawItems(e.target.value);
                        const lines = e.target.value.split("\n");
                        const lastLine = lines[lines.length - 1].trim();
                        const match = lastLine.match(/^(\d+)(?:\s*[-xX]\s*|\s+)(.+)$/);
                        const searchStr = match ? match[2] : lastLine;
                        if (searchStr.length >= 2 && products) {
                          const filtered = products.filter(p =>
                            p.name.toLowerCase().includes(searchStr.toLowerCase()) ||
                            searchStr.toLowerCase().split(" ").some(word => word.length >= 3 && p.name.toLowerCase().includes(word))
                          ).sort((a, b) => {
                            const aLower = a.name.toLowerCase();
                            const bLower = b.name.toLowerCase();
                            const s = searchStr.toLowerCase();
                            const aStarts = aLower.startsWith(s) ? 0 : aLower.includes(s) ? 1 : 2;
                            const bStarts = bLower.startsWith(s) ? 0 : bLower.includes(s) ? 1 : 2;
                            return aStarts - bStarts;
                          }).slice(0, searchStr.length < 3 ? 10 : searchStr.length < 5 ? 8 : 5);
                          setSuggestions(filtered);
                        } else {
                          setSuggestions([]);
                        }
                      }}
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-50 w-full max-w-[calc(100vw-2rem)] bg-slate-800 border border-slate-700 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                        {suggestions.map(s => (
                          <div
                            key={s.id}
                            className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
                            onClick={() => {
                              const lines = rawItems.split("\n");
                              const lastLine = lines[lines.length - 1];
                              const match = lastLine.match(/^(\d+)(?:\s*[-xX]\s*|\s+)/);
                              const prefix = match ? match[0] : "";
                              lines[lines.length - 1] = prefix + s.name;
                              setRawItems(lines.join("\n"));
                              setSuggestions([]);
                            }}
                          >
                            <span className="text-slate-400 font-mono text-xs mr-2">{s.id}</span>
                            {s.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="w-full md:w-auto" onClick={() => {
                    setSuggestions([]);
                    const lines = rawItems.split("\n");
                    const lastLine = lines[lines.length - 1].trim();
                    if (!lastLine.match(/^\d+/)) { lines.pop(); setRawItems(lines.join("\n")); }
                    handleParseItems();
                  }}>
                    <Search className="mr-2 h-4 w-4" /> Validar Itens
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={(open) => { setShowPreview(open); if (!open) { setManualSearch(null); setManualSearchResults([]); } }}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Validar Itens do Pedido</DialogTitle>
            <DialogDescription className="text-slate-400">Revise os itens antes de confirmar o pedido.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {parsedItems.filter(item => !item.productId.startsWith('unknown-')).length > 0 && (
              <div className="space-y-2">
                <p className="text-green-400 text-sm font-medium"> Produtos encontrados:</p>
                {parsedItems.map((item, idx) => !item.productId.startsWith('unknown-') && (
                  <div key={idx} className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{item.quantity}x</span>
                    <span className="text-slate-200 text-sm flex-1">{item.name}</span>
                    {(() => {
                      const disp = getStock(item.productId);
                      if (disp === null) return null;
                      const ok = disp >= item.quantity;
                      return (
                        <span className={`text-xs font-mono ${ok ? "text-emerald-400" : "text-red-400"}`}>
                          {disp} em estoque
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
            {ambiguousItems.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-yellow-400 text-sm font-medium">Produtos com múltiplas opções — escolha o correto:</p>
                {ambiguousItems.map((amb) => (
                  <div key={amb.idx} className="bg-slate-800 p-3 rounded-lg border border-yellow-500/30">
                    <p className="text-slate-400 text-xs mb-2">Digitado: <span className="text-white">{amb.query}</span></p>
                    <div className="space-y-1">
                      {amb.options.map(opt => (
                        <button
                          key={opt.id}
                          className="w-full text-left px-3 py-2 rounded text-sm hover:bg-indigo-600 text-slate-200 border border-slate-700"
                          onClick={() => {
                            const newItems = [...parsedItems];
                            newItems[amb.idx] = { ...newItems[amb.idx], productId: opt.id, name: opt.name };
                            setParsedItems(newItems);
                            setAmbiguousItems(prev => prev.filter(a => a.idx !== amb.idx));
                          }}
                        >
                          <span className="text-slate-400 font-mono text-xs mr-2">{opt.id}</span>
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {parsedItems.filter(item => item.productId.startsWith('unknown-')).length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-red-400 text-sm font-medium">Produtos não encontrados — busque manualmente:</p>
                {parsedItems.map((item, idx) => item.productId.startsWith('unknown-') && (
                  <div key={idx} className="bg-slate-800 p-3 rounded-lg border border-red-500/30">
                    <p className="text-slate-400 text-xs mb-2">Digitado: <span className="text-white">{item.name}</span></p>
                    <Input
                      placeholder="Buscar produto no catálogo..."
                      className="h-8 text-xs mb-1"
                      onChange={e => {
                        const q = e.target.value;
                        if (q.length >= 2 && products) {
                          setManualSearchResults(
                            products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
                              .sort((a, b) => (a.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1) - (b.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1))
                              .slice(0, 8)
                          );
                          setManualSearch({ idx, query: q });
                        } else {
                          setManualSearchResults([]);
                        }
                      }}
                    />
                    {manualSearch?.idx === idx && manualSearchResults.length > 0 && (
                      <div className="bg-slate-700 rounded border border-slate-600 max-h-32 overflow-y-auto">
                        {manualSearchResults.map(r => (
                          <div key={r.id} className="px-2 py-1 text-xs text-slate-200 hover:bg-indigo-600 cursor-pointer"
                            onClick={() => {
                              const newItems = [...parsedItems];
                              newItems[idx] = { ...item, productId: r.id, name: r.name };
                              setParsedItems(newItems);
                              setManualSearch(null);
                              setManualSearchResults([]);
                            }}>
                            <span className="text-slate-400 font-mono mr-1">{r.id}</span> {r.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrder} disabled={!profileLoaded}>
              <PlusCircle className="mr-2 h-4 w-4" /> Confirmar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(photoItemQueue || packedPhotoQueue) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`relative w-full max-w-sm mx-4 rounded-xl p-4 ${packedPhotoQueue ? 'bg-green-50 border border-green-200' : 'bg-white'}`}>
            {packedPhotoQueue ? (
              <>
                <h2 className="text-green-800 font-semibold text-base mb-1">Pedido Separado!</h2>
                <p className="text-green-700 text-sm mb-4">Todos os itens foram separados. Agora tire uma foto das caixas fechadas para encerrar o pedido.</p>
                <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg bg-green-600 hover:bg-green-700 text-white cursor-pointer flex-col items-center gap-2 justify-center" })}>
                  <Package className="h-8 w-8 shrink-0" />
                  <span>Foto do Pedido Embalado</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'packed')} />
                </label>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-base mb-1 text-slate-800">Foto do Item Separado</h2>
                <p className="text-sm text-slate-600 mb-4">Tire uma foto de {photoItemQueue?.quantity} unidades de {photoItemQueue?.name}</p>
                <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                  <Camera className="h-8 w-8 shrink-0" />
                  <span>Tirar Foto / Anexar</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(e, 'item')} />
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
