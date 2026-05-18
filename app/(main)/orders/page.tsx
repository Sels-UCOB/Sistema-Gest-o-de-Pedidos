"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Order, OrderItem } from "@/lib/db";
import { findBestMatch } from "@/lib/string-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Search, PlusCircle, CheckCircle2, ChevronRight, Package, Box } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("create");
  const products = useLiveQuery(() => db.products.toArray());
  const orders = useLiveQuery(() => db.orders.orderBy("createdAt").reverse().toArray());
  const [customerName, setCustomerName] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [responsible, setResponsible] = useState("");
  const [rawItems, setRawItems] = useState("");

  React.useEffect(() => {
    const saved = localStorage.getItem('orderForm');
    if (saved) {
      const f = JSON.parse(saved);
      setCustomerName(f.customerName || '');
      setCampaignCode(f.campaignCode || '');
      setDestinationCity(f.destinationCity || '');
      setResponsible(f.responsible || '');
      setRawItems(f.rawItems || '');
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem('orderForm', JSON.stringify({
      customerName, campaignCode, destinationCity, responsible, rawItems
    }));
  }, [customerName, campaignCode, destinationCity, responsible, rawItems]);

  const [parsedItems, setParsedItems] = useState<OrderItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [separatingOrder, setSeparatingOrder] = useState<Order | null>(null);
  const [photoItemQueue, setPhotoItemQueue] = useState<OrderItem | null>(null);
  const [packedPhotoQueue, setPackedPhotoQueue] = useState<Order | null>(null);

  const RESPONSAVEIS = [
    "Maycon Douglas",
    "Victor Fialho",
    "Juan Vazquez",
    "Leticia Lobato",
    "Outro",
  ];
  const CAMPANHAS = [
    "ABC - 1976",
    "ALM - 5847",
    "ALM SA - 5387",
    "APLAC - 2935",
    "APLAC SA - 2976",
    "AOM - 7485",
    "AOM SA - 7101",
    "ASM - 4261",
    "ASM SA - 4289",
    "IABC - 1677",
  ];
  const [errors, setErrors] = useState<{customerName?: string, destinationCity?: string}>({});
  const [suggestions, setSuggestions] = useState<{id: string, name: string}[]>([]);
  const [customResponsible, setCustomResponsible] = useState("");
  const [customResponsibleError, setCustomResponsibleError] = useState("");
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

    if (!nomeValido(customerName)) {
      newErrors.customerName = "Mínimo 3 letras, sem números.";
    }
    if (!nomeValido(destinationCity)) {
      newErrors.destinationCity = "Mínimo 3 letras, sem números.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    if (responsible === "Outro" && customResponsible.trim().length < 3) {
      alert("Digite o nome do responsável.");
      return;
    }
    if (parsedItems.length === 0) {
      alert("Adicione pelo menos um item ao pedido.");
      return;
    }
    if (parsedItems.some(item => item.productId.startsWith('unknown-'))) {
      alert("Existem produtos não identificados. Revise os itens antes de confirmar.");
      setShowPreview(true);
      return;
    }
    try {
      await db.orders.add({
        id: crypto.randomUUID(),
        customerName,
        campaignCode,
        destinationCity,
        responsible: responsible === "Outro" ? customResponsible.trim() : responsible,
        status: "pending",
        items: parsedItems,
        createdAt: Date.now()
      });
      setCustomResponsible("");
      setCustomerName("");
      setCampaignCode("");
      setDestinationCity("");
      setResponsible("");
      setRawItems("");
      setParsedItems([]);
      setShowPreview(false);
      setActiveTab("list");
      localStorage.removeItem('orderForm');
    } catch (err) {
      console.error(err);
      alert("Erro ao criar pedido.");
    }
  };

  const toggleSeparation = async (order: Order, itemIndex: number) => {
    const item = order.items[itemIndex];
    if (!item.isSeparated) {
      setPhotoItemQueue({ ...item });
      setSeparatingOrder(order);
    } else {
      const newItems = [...order.items];
      newItems[itemIndex].isSeparated = false;
      newItems[itemIndex].photoUrl = undefined;
      await db.orders.update(order.id, { items: newItems });
      setSeparatingOrder({ ...order, items: newItems });
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>, type: 'item' | 'packed') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (type === 'item' && photoItemQueue && separatingOrder) {
        const newItems = separatingOrder.items.map(it =>
          it.productId === photoItemQueue.productId
            ? { ...it, isSeparated: true, photoUrl: base64 }
            : it
        );
        const updatedStatus = separatingOrder.status === 'pending' ? 'separating' : separatingOrder.status;
        await db.orders.update(separatingOrder.id, { items: newItems, status: updatedStatus });
        setSeparatingOrder({ ...separatingOrder, items: newItems, status: updatedStatus });
        setPhotoItemQueue(null);
        if (newItems.every(i => i.isSeparated)) {
          const packedData = { ...separatingOrder, items: newItems, status: updatedStatus };
          setTimeout(() => {
            setPackedPhotoQueue(packedData);
          }, 300);
        }
      } else if (type === 'packed' && packedPhotoQueue) {
        await db.orders.update(packedPhotoQueue.id, {
          packedPhotoUrl: base64,
          status: "closed"
        });
        setSeparatingOrder(null);
        setPackedPhotoQueue(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const statusMap = {
    pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
    separating: { label: "Separando", color: "bg-blue-100 text-blue-800" },
    closed: { label: "Fechado", color: "bg-green-100 text-green-800" },
    shipped: { label: "Enviado", color: "bg-purple-100 text-purple-800" },
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
                <Button variant="outline" onClick={() => setSeparatingOrder(null)}>
                  Voltar
                </Button>
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
                          <Button size="sm" variant="ghost" onClick={() => setSeparatingOrder(order)}>
                            {order.status === 'pending' || order.status === 'separating' ? "Separar" : "Visualizar"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!orders || orders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          Nenhum pedido encontrado.
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
                    <Button size="sm" variant="ghost" onClick={() => setSeparatingOrder(order)}>
                      {order.status === 'pending' || order.status === 'separating' ? "Separar" : "Ver"}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!orders || orders.length === 0) && (
                  <p className="text-center py-8 text-slate-500 text-sm">Nenhum pedido encontrado.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Pedido</CardTitle>
            </CardHeader>
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
                          } else {
                            e.preventDefault();
                            document.getElementById("input-campanha")?.focus();
                          }
                        }
                      }}
                    />
                    {errors.customerName && <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Código da Campanha</label>
                    <Select value={campaignCode} onValueChange={(value) => setCampaignCode(value || "")}>
                      <SelectTrigger id="input-campanha" className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPANHAS.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
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
                          } else {
                            e.preventDefault();
                            document.getElementById("input-responsavel")?.focus();
                          }
                        }
                      }}
                    />
                    {errors.destinationCity && <p className="text-red-500 text-xs mt-1">{errors.destinationCity}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Responsável</label>
                    <Select value={responsible} onValueChange={(value) => value !== null && setResponsible(value)}>
                      <SelectTrigger id="input-responsavel" className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {RESPONSAVEIS.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {responsible === "Outro" && (
                      <div>
                        <Input
                          placeholder="Digite o nome do responsável"
                          value={customResponsible}
                          onChange={e => { setCustomResponsible(e.target.value); setCustomResponsibleError(""); }}
                          onBlur={e => {
                            if (e.target.value.trim().length < 3 || /\d/.test(e.target.value))
                              setCustomResponsibleError("Mínimo 3 letras, sem números.");
                          }}
                          className="mt-2"
                        />
                        {customResponsibleError && <p className="text-red-500 text-xs mt-1">{customResponsibleError}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 relative">
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium flex justify-between">
                      Produtos e Quantidades
                      <span className="text-xs text-slate-400 font-normal">Coloque 1 item por linha (ex: 10 - Vida de Jesus)</span>
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
                  <Button onClick={() => {
                    setSuggestions([]);
                    const lines = rawItems.split("\n");
                    const lastLine = lines[lines.length - 1].trim();
                    if (!lastLine.match(/^\d+/)) {
                      lines.pop();
                      setRawItems(lines.join("\n"));
                    }
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
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
                    <span className="text-slate-200 text-sm">{item.name}</span>
                    <span className="text-slate-500 font-mono text-xs ml-auto">{item.productId}</span>
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
                              .sort((a, b) => {
                                const aStarts = a.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
                                const bStarts = b.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
                                return aStarts - bStarts;
                              })
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
            <Button onClick={handleCreateOrder}>
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
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handlePhotoCapture(e, 'packed')} />
                </label>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-base mb-1 text-slate-800">Foto do Item Separado</h2>
                <p className="text-sm text-slate-600 mb-4">Tire uma foto de {photoItemQueue?.quantity} unidades de {photoItemQueue?.name}</p>
                <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                  <Camera className="h-8 w-8 shrink-0" />
                  <span>Tirar Foto / Anexar</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handlePhotoCapture(e, 'item')} />
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
