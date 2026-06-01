"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { Order, OrderItem, Product } from "@/lib/db";
import { getProducts, getOrdersPaged, getOrderFull, addOrder, updateOrder, deleteOrder, deductInventoryStock, getInventory, uploadOrderPhoto, deleteOrderPhotos, deleteOrderAllPhotos } from "@/lib/supabase-db";
import type { InventoryRow } from "@/lib/supabase-db";

// ── Cache local (stale-while-revalidate) ─────────────────────────────────────
const CK_ORDERS    = "v1_orders_list";
const CK_PRODUCTS  = "v1_products";
const CK_INVENTORY = "v1_inventory";

function cacheRead<T>(key: string): T | null {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r).data as T) : null; } catch { return null; }
}
function cacheWrite<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}
function cacheTsRead(key: string): number | null {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r).ts as number) : null; } catch { return null; }
}
function formatAge(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "Atualizado agora";
  if (m < 60) return `Atualizado há ${m} min`;
  return `Atualizado há ${Math.floor(m / 60)}h`;
}
import { CAMPO_MAP, WAREHOUSES, WarehouseId } from "@/lib/campos";
import { findBestMatch, findTopMatches } from "@/lib/string-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PageNav } from "@/components/ui/page-nav";
import { Camera, Search, PlusCircle, ChevronRight, Package, Pencil, Trash2, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/lib/user-context";


// ── Parser de mensagens WPP ──────────────────────────────────────────────────

type WppItem = { qty: number; rawText: string; matched: Product | null };

// Palavras que indicam fim da lista de itens em mensagens informais
const WPP_STOP_RE = /\s+(e\s+)?(?:enviar|mandar|entregar|para\s+\w|no\s+acerto|pelo\s+|por\s+gentileza|comprovante|obrigad|valeu|att\b|abs\b|aguardo|segue|favor\b|ok\b|destino|total|valor)/i;

// Extrai pares {qty, rawText} de uma mensagem informal sem tentar casar produtos
function extractFragments(text: string): { qty: number; rawText: string }[] {
  if (!text.trim()) return [];

  const numRe = /\b(\d+)\s+/g;
  const positions: { qty: number; textStart: number; numStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    positions.push({ qty: parseInt(m[1]), textStart: m.index + m[0].length, numStart: m.index });
  }
  if (positions.length === 0) return [];

  const cleanup = (raw: string): string => {
    let f = raw.trim();
    const stop = WPP_STOP_RE.exec(f);
    if (stop) f = f.slice(0, stop.index);
    return f
      .replace(/[,;!?.\s]+$/, "")
      .replace(/\s+e\s*$/, "")
      .replace(/^(?:combos?\s+(?:de\s+)?|unidades?\s+(?:de\s+)?|caixas?\s+(?:de\s+)?|exemplares?\s+(?:de\s+)?|volumes?\s+(?:de\s+)?)/i, "")
      .replace(/^(?:da\s+|do\s+|de\s+|dos\s+|das\s+|um\s+|uma\s+)/i, "")
      .trim();
  };

  const results: { qty: number; rawText: string }[] = [];
  let i = 0;
  while (i < positions.length) {
    const { qty, textStart } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].numStart : text.length;
    const fragment = cleanup(text.slice(textStart, end));

    // Fragmento muito curto = apenas separador (ex: "1 - 21 dias" → fragmento "-").
    // O próximo número faz parte do nome do produto, não é uma quantidade.
    // Mescla: usa qty atual + "{próximo número} {próximo fragmento}" como rawText.
    if (fragment.length < 2 && i + 1 < positions.length) {
      const next = positions[i + 1];
      const nextEnd = i + 2 < positions.length ? positions[i + 2].numStart : text.length;
      const nextFragment = cleanup(text.slice(next.textStart, nextEnd));
      const merged = `${next.qty} ${nextFragment}`.trim();
      if (merged.length >= 2) results.push({ qty, rawText: merged });
      i += 2;
      continue;
    }

    if (fragment.length >= 2) results.push({ qty, rawText: fragment });
    i++;
  }
  return results;
}

// Parser local completo (fallback quando IA não está disponível)
function parseWppMessage(text: string, products: Product[]): WppItem[] {
  if (products.length === 0) return [];
  return extractFragments(text).map(f => {
    const matched = findBestMatch(f.rawText, products);
    // Se o nome do produto começa com o número capturado como qty mas o rawText
    // não começa com esse número, o número era parte do nome, não a quantidade.
    // Ex: rawText="dias para mudar", qty=21, produto="21 Dias para Mudar" → qty=1.
    let qty = f.qty;
    if (matched && !f.rawText.trim().startsWith(String(f.qty))) {
      if (new RegExp(`^${f.qty}\\b`, 'i').test(matched.name)) qty = 1;
    }
    return { qty, rawText: f.rawText, matched };
  });
}

export default function OrdersPage() {
  const { displayName, isAdmin, campo, profileLoaded, refreshTick } = useUserRole();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const CAMPANHAS = useMemo(() => {
    const all = Object.keys(CAMPO_MAP).sort();
    if (isAdmin || !campo) return all;
    return all.filter(c => CAMPO_MAP[c] === campo);
  }, [isAdmin, campo]);
  const [activeTab, setActiveTab] = useState("create");
  const [products, setProducts] = useState<Product[] | undefined>(undefined);
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [cacheTs, setCacheTs] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [tipo, setTipo] = useState<"envio" | "acerto">("envio");
  const [rawItems, setRawItems] = useState("");

  // Restaura cache imediatamente (antes mesmo do login estar confirmado)
  useEffect(() => {
    const co = cacheRead<Order[]>(CK_ORDERS);
    if (co) { setOrders(co); setCacheTs(cacheTsRead(CK_ORDERS)); }
    const cp = cacheRead<Product[]>(CK_PRODUCTS);
    if (cp) setProducts(cp);
    const ci = cacheRead<InventoryRow[]>(CK_INVENTORY);
    if (ci) setInventory(ci);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const { orders: data, hasMore: more } = await getOrdersPaged(0, 15);
      setOrders(data);
      setHasMore(more);
      setCurrentPage(0);
      cacheWrite(CK_ORDERS, data);
      setCacheTs(Date.now());
    } catch {
      setOrders(prev => prev ?? []);
      setHasMore(false);
    }
  }, []);

  const goToPage = async (n: number) => {
    setLoadingMore(true);
    try {
      const { orders: data, hasMore: more } = await getOrdersPaged(n, 15);
      setOrders(data);
      setHasMore(more);
      setCurrentPage(n);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!profileLoaded) return;
    getProducts()
      .then(data => { setProducts(data); cacheWrite(CK_PRODUCTS, data); })
      .catch(() => setProducts(prev => prev ?? []));
    getInventory()
      .then(data => { setInventory(data); cacheWrite(CK_INVENTORY, data); })
      .catch(() => setInventory(prev => prev ?? []));
    loadOrders();
  }, [loadOrders, profileLoaded, refreshTick]);

  // Restaura pedido ativo após primeira carga (separatingOrder como guarda evita dupla restauração)
  useEffect(() => {
    if (!orders || separatingOrder) return;
    const savedId = localStorage.getItem("active_separation_order_id");
    if (!savedId) return;
    const order = orders.find(o => o.id === savedId && (o.status === "pending" || o.status === "separating"));
    if (order) {
      setActiveTab("list");
      openSeparationView(order);
    } else {
      localStorage.removeItem("active_separation_order_id");
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const saved = localStorage.getItem('orderForm');
    if (saved) {
      const f = JSON.parse(saved);
      setCustomerName(f.customerName || '');
      setCampaignCode(f.campaignCode || '');
      setDestinationCity(f.destinationCity || '');
      setRawItems(f.rawItems || '');
      if (f.tipo === 'acerto') setTipo('acerto');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('orderForm', JSON.stringify({
      customerName, campaignCode, destinationCity, rawItems, tipo
    }));
  }, [customerName, campaignCode, destinationCity, rawItems]);

  const [parsedItems, setParsedItems] = useState<OrderItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [separatingOrder, setSeparatingOrder] = useState<Order | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [photoItemQueue, setPhotoItemQueue] = useState<OrderItem | null>(null);
  const [photoItemIndex, setPhotoItemIndex] = useState<number | null>(null);
  const [packedPhotoQueue, setPackedPhotoQueue] = useState<Order | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [warehouse, setWarehouse] = useState<WarehouseId | "">("");

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── WPP converter ──
  const [wppText, setWppText] = useState("");
  const [wppResult, setWppResult] = useState<WppItem[] | null>(null);
  const [wppLoading, setWppLoading] = useState(false);
  const [wppMode, setWppMode] = useState<"ai" | "local" | null>(null);
  const [wppEditSearch, setWppEditSearch] = useState<{ idx: number; query: string } | null>(null);
  const [wppEditResults, setWppEditResults] = useState<Product[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const handleConvertWpp = async () => {
    if (!products) return;
    setWppLoading(true);
    let usedAi = false;
    try {
      // Passo 1: extrai fragmentos localmente
      const fragments = extractFragments(wppText);
      if (fragments.length > 0) {
        // Passo 2: top 8 candidatos por fragmento (pré-filtro local)
        const withOptions = fragments.map(f => ({
          qty: f.qty,
          rawText: f.rawText,
          options: findTopMatches(f.rawText, products, 8),
        }));
        const toSend = withOptions.filter(c => c.options.length > 0);

        if (toSend.length > 0) {
          // Passo 3: manda só os candidatos pré-filtrados para o Groq
          const res = await fetch("/api/wpp-parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: wppText, candidates: toSend }),
          });
          if (res.ok) {
            const data = await res.json() as { items?: { qty: number; productName: string }[] };
            if (data.items && data.items.length > 0) {
              // Itens resolvidos pela IA + itens sem candidatos (não reconhecidos)
              const aiResults: WppItem[] = data.items.map(item => ({
                qty: item.qty,
                rawText: item.productName,
                matched: findBestMatch(item.productName, products),
              }));
              const noMatch: WppItem[] = withOptions
                .filter(c => c.options.length === 0)
                .map(f => ({ qty: f.qty, rawText: f.rawText, matched: null }));
              setWppResult([...aiResults, ...noMatch]);
              usedAi = true;
            }
          }
        }
      }
    } catch { /* fallback abaixo */ }
    if (!usedAi) setWppResult(parseWppMessage(wppText, products));
    setWppMode(usedAi ? "ai" : "local");
    setWppEditSearch(null);
    setWppEditResults([]);
    setWppLoading(false);
  };

  const updateWppQty = (idx: number, delta: number) =>
    setWppResult(prev => prev ? prev.map((item, i) =>
      i === idx ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ) : prev);

  const updateWppProduct = (idx: number, product: Product) => {
    setWppResult(prev => prev ? prev.map((item, i) =>
      i === idx ? { ...item, matched: product } : item
    ) : prev);
    setWppEditSearch(null);
    setWppEditResults([]);
  };

  const handleWppItemSearch = (idx: number, query: string) => {
    setWppEditSearch({ idx, query });
    if (query.length >= 2 && products) {
      setWppEditResults(
        products
          .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) =>
            (a.name.toLowerCase().startsWith(query.toLowerCase()) ? -1 : 1) -
            (b.name.toLowerCase().startsWith(query.toLowerCase()) ? -1 : 1)
          )
          .slice(0, 6)
      );
    } else {
      setWppEditResults([]);
    }
  };

  const handleFillFromWpp = () => {
    if (!wppResult) return;
    const items = wppResult.map(r => ({
      productId: r.matched?.id ?? `unknown-${Date.now()}-${Math.random()}`,
      name: r.matched?.name ?? r.rawText,
      quantity: r.qty,
      isSeparated: false,
    }));
    if (items.every(i => i.productId.startsWith("unknown-"))) return;
    setParsedItems(items);
    setAmbiguousItems([]);
    setRawItems(items.filter(i => !i.productId.startsWith("unknown-")).map(i => `${i.quantity} - ${i.name}`).join("\n"));
    setWppText("");
    setWppResult(null);
    setWppEditSearch(null);
    setWppEditResults([]);
    setShowPreview(true);
  };

  const canDelete = (order: Order) => order.status !== "shipped";

  const handleDeleteOrder = async (order: Order) => {
    if (!await confirm(`Excluir o pedido de "${order.customerName}"?`, { description: "Esta ação não pode ser desfeita.", confirmLabel: "Excluir", destructive: true })) return;
    setDeletingOrderId(order.id);
    try {
      await deleteOrder(order.id);
      deleteOrderAllPhotos(order.id).catch(() => {});
      setOrders(prev => {
        const updated = (prev ?? []).filter(o => o.id !== order.id);
        cacheWrite(CK_ORDERS, updated);
        return updated;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir pedido.";
      alert(msg);
    } finally {
      setDeletingOrderId(null);
    }
  };

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCampaignCode, setEditCampaignCode] = useState("");
  const [editDestinationCity, setEditDestinationCity] = useState("");
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editAddSearch, setEditAddSearch] = useState("");
  const [editAddResults, setEditAddResults] = useState<Product[]>([]);
  const [editKnownPhotoUrls, setEditKnownPhotoUrls] = useState<Set<string>>(new Set());

  const openEditOrder = async (order: Order) => {
    setEditAddSearch("");
    setEditAddResults([]);
    try {
      const full = await getOrderFull(order.id);
      setEditingOrder(full);
      setEditCustomerName(full.customerName);
      setEditCampaignCode(full.campaignCode);
      setEditDestinationCity(full.destinationCity);
      setEditItems(full.items.map(i => ({ ...i })));
      setEditKnownPhotoUrls(new Set(full.items.map(i => i.photoUrl).filter(Boolean) as string[]));
    } catch {
      setEditingOrder(order);
      setEditCustomerName(order.customerName);
      setEditCampaignCode(order.campaignCode);
      setEditDestinationCity(order.destinationCity);
      setEditItems(order.items.map(i => ({ ...i })));
      setEditKnownPhotoUrls(new Set());
    }
  };

  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;
    const nomeValido = (val: string) => val.trim().length >= 3 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val.trim());
    if (!nomeValido(editCustomerName)) { alert("Nome do cliente: mínimo 3 letras, sem números."); return; }
    if (!nomeValido(editDestinationCity)) { alert("Cidade de destino: mínimo 3 letras, sem números."); return; }
    if (editItems.length === 0) { alert("O pedido precisa ter ao menos um item."); return; }
    setEditSaving(true);
    try {
      const newPhotoUrls = new Set(editItems.map(i => i.photoUrl).filter(Boolean));
      const orphanedPhotos = [...editKnownPhotoUrls].filter(url => !newPhotoUrls.has(url));

      await updateOrder(editingOrder.id, {
        customerName: editCustomerName,
        campaignCode: editCampaignCode,
        destinationCity: editDestinationCity,
        items: editItems,
      });

      if (orphanedPhotos.length > 0) {
        deleteOrderPhotos(orphanedPhotos).catch(() => {});
      }

      setEditingOrder(null);
      setEditAddSearch("");
      setEditAddResults([]);
      setEditKnownPhotoUrls(new Set());
      if (separatingOrder && separatingOrder.id === editingOrder.id) {
        setSeparatingOrder(prev => {
          if (!prev) return null;
          const currentMap = new Map(prev.items.map(i => [i.productId, i]));
          const mergedItems = editItems.map(edited => {
            const current = currentMap.get(edited.productId);
            return current ? { ...edited, isSeparated: current.isSeparated, photoUrl: current.photoUrl } : edited;
          });
          return { ...prev, customerName: editCustomerName, campaignCode: editCampaignCode, destinationCity: editDestinationCity, items: mergedItems };
        });
      }
      await loadOrders();
    } catch {
      alert("Erro ao salvar alterações.");
    } finally {
      setEditSaving(false);
    }
  };

  // Persiste qual pedido estava sendo separado
  useEffect(() => {
    if (separatingOrder) {
      localStorage.setItem("active_separation_order_id", separatingOrder.id);
    } else {
      localStorage.removeItem("active_separation_order_id");
    }
  }, [separatingOrder?.id]);

  // Ao abrir pedido restaurado, exibe prompt de caixa se todos os itens já estão separados
  useEffect(() => {
    if (!separatingOrder) return;
    if (separatingOrder.status === "closed" || separatingOrder.status === "shipped") return;
    if (separatingOrder.packedPhotoUrl) return;
    if (separatingOrder.items.length === 0) return;
    if (separatingOrder.items.every(i => i.isSeparated)) {
      setPackedPhotoQueue(separatingOrder);
    }
  }, [separatingOrder?.id]); // só dispara quando o pedido ativo muda, não a cada item

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

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterTipo !== "all" && o.tipo !== filterTipo) return false;
      if (filterSearch && !o.customerName.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
  }, [orders, filterSearch, filterStatus, filterTipo]);

  const [errors, setErrors] = useState<{customerName?: string, destinationCity?: string}>({});
  const [suggestions, setSuggestions] = useState<{id: string, name: string}[]>([]);
  const [ambiguousItems, setAmbiguousItems] = useState<{idx: number, query: string, options: {id: string, name: string}[]}[]>([]);
  const [manualSearch, setManualSearch] = useState<{idx: number} | null>(null);
  const [manualSearchResults, setManualSearchResults] = useState<{id: string, name: string}[]>([]);
  const [expandedAmbiguous, setExpandedAmbiguous] = useState<Set<number>>(new Set());

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
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); setDialogError("Preencha o nome do cliente e a cidade de destino antes de confirmar."); return; }
    setErrors({});
    setDialogError(null);

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
      const ok = await confirm("Estoque insuficiente", { description: `Produtos sem saldo:\n\n${lista}\n\nDeseja criar mesmo assim?`, confirmLabel: "Criar mesmo assim" });
      if (!ok) return;
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
        tipo,
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
      setTipo("envio");
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

  const updateItemQuantity = async (idx: number, newQty: number) => {
    if (!separatingOrder || newQty < 1) return;
    const newItems = separatingOrder.items.map((it, i) =>
      i === idx ? { ...it, quantity: newQty } : it
    );
    try {
      await updateOrder(separatingOrder.id, { items: newItems });
      setSeparatingOrder({ ...separatingOrder, items: newItems });
    } catch {
      alert("Erro ao atualizar quantidade.");
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>, type: 'item' | 'packed') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      if (type === 'item' && photoItemQueue && separatingOrder && photoItemIndex !== null) {
        const url = await uploadOrderPhoto(file, separatingOrder.id, 'item', photoItemQueue.productId);
        const newItems = separatingOrder.items.map((it, i) =>
          i === photoItemIndex ? { ...it, isSeparated: true, photoUrl: url } : it
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
        const url = await uploadOrderPhoto(file, packedPhotoQueue.id, 'packed');
        await updateOrder(packedPhotoQueue.id, { packedPhotoUrl: url, status: "closed" });
        localStorage.removeItem("active_separation_order_id");
        setSeparatingOrder(null);
        setPackedPhotoQueue(null);
        await loadOrders();
      }
    } catch {
      alert("Erro ao enviar foto. Verifique sua conexão e tente novamente.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const statusMap = {
    pending: { label: "Pendente" },
    separating: { label: "Separando" },
    closed: { label: "Fechado" },
    shipped: { label: "Enviado" },
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Gestão de Pedidos</h1>
        <p className="text-slate-500 text-sm">Crie, separe e acompanhe os pedidos.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[520px]">
          <TabsTrigger value="create">Criar</TabsTrigger>
          <TabsTrigger value="wpp"><span className="hidden sm:inline">Via </span>WPP</TabsTrigger>
          <TabsTrigger value="list"><span className="sm:hidden">Lista</span><span className="hidden sm:inline">Gerenciar</span></TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {separatingOrder && !packedPhotoQueue ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 flex-wrap">
                    Separando Pedido: {separatingOrder.customerName}
                    {separatingOrder.tipo === "acerto" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider">Acerto</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Campanha: {separatingOrder.campaignCode} | Destino: {separatingOrder.destinationCity}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {separatingOrder.status !== 'closed' && separatingOrder.status !== 'shipped' && (
                    <Button size="sm" variant="ghost" onClick={() => openEditOrder(separatingOrder)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSeparatingOrder(null)}>Voltar</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {separatingOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-4 px-4 py-4 border rounded-xl transition-colors ${
                        item.isSeparated
                          ? "border-emerald-800/40 bg-emerald-900/10"
                          : "border-slate-800 bg-slate-900/50"
                      }`}
                    >
                      <Checkbox
                        id={`item-${idx}`}
                        checked={item.isSeparated}
                        onCheckedChange={() => toggleSeparation(separatingOrder, idx)}
                        disabled={separatingOrder.status === 'closed' || separatingOrder.status === 'shipped'}
                        className="h-6 w-6 shrink-0"
                      />
                      <label
                        htmlFor={`item-${idx}`}
                        className="flex-1 min-w-0 cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <span className={`text-sm font-semibold leading-snug block truncate ${item.isSeparated ? "text-slate-400 line-through" : "text-white"}`}>
                          {(separatingOrder.status === 'closed' || separatingOrder.status === 'shipped') && (
                            <span className="text-indigo-400 mr-1.5">{item.quantity}×</span>
                          )}
                          {item.name}
                        </span>
                        <p className="text-[10px] text-slate-600 mt-0.5 hidden sm:block">{item.productId}</p>
                      </label>
                      {separatingOrder.status !== 'closed' && separatingOrder.status !== 'shipped' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            className="h-6 w-6 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-base leading-none"
                            onClick={() => updateItemQuantity(idx, Math.max(1, item.quantity - 1))}
                          >−</button>
                          <span className="text-indigo-400 text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            className="h-6 w-6 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-base leading-none"
                            onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                          >+</button>
                        </div>
                      )}
                      {item.photoUrl && (
                        <div
                          className="h-12 w-12 border border-slate-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity shrink-0"
                          onClick={() => setPreviewImageUrl(item.photoUrl!)}
                        >
                          <img src={item.photoUrl} alt="separado" className="object-cover w-full h-full" />
                        </div>
                      )}
                    </div>
                  ))}
                  {separatingOrder.packedPhotoUrl && (
                    <div className="mt-6 p-4 bg-slate-800/40 rounded-lg border border-slate-800 flex flex-col items-center">
                      <p className="font-medium text-white mb-2">Caixa Fechada:</p>
                      <img
                        src={separatingOrder.packedPhotoUrl}
                        alt="Caixa embalada"
                        className="max-w-xs rounded shadow-sm border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImageUrl(separatingOrder.packedPhotoUrl!)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-b border-slate-800">
                <Input
                  placeholder="Buscar cliente..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="sm:w-52 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9"
                />
                <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? "all")}>
                  <SelectTrigger className="w-full sm:w-44 bg-slate-900 border-slate-700 text-slate-200 h-9">
                    <SelectValue>
                      {filterStatus === "all" ? "Todos os status" : filterStatus === "pending" ? "Pendente" : filterStatus === "separating" ? "Separando" : filterStatus === "closed" ? "Fechado" : "Enviado"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="separating">Separando</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                    <SelectItem value="shipped">Enviado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterTipo} onValueChange={v => setFilterTipo(v ?? "all")}>
                  <SelectTrigger className="w-full sm:w-36 bg-slate-900 border-slate-700 text-slate-200 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="envio">Envio Normal</SelectItem>
                    <SelectItem value="acerto">Acerto</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-col items-start sm:items-end self-center gap-0.5 ml-auto">
                  <span className="text-slate-500 text-sm">
                    {filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""}
                    {(filterSearch || filterStatus !== "all") && orders && orders.length !== filteredOrders.length
                      ? ` de ${orders.length}` : ""}
                  </span>
                  {cacheTs && (
                    <span className="text-slate-600 text-[10px]">{formatAge(cacheTs)}</span>
                  )}
                </div>
              </div>
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
                    {filteredOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="text-slate-400">{format(order.createdAt, 'dd/MM HH:mm')}</TableCell>
                        <TableCell className="font-bold text-white">
                          <div className="flex items-center gap-2">
                            {order.customerName}
                            {order.tipo === "acerto" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider">Acerto</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">{order.items.length} itens</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-slate-800 text-slate-400' : order.status === 'separating' ? 'bg-amber-500/10 text-amber-500' : order.status === 'closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {statusMap[order.status].label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canDelete(order) && (
                              <Button
                                size="sm" variant="ghost"
                                disabled={deletingOrderId === order.id}
                                onClick={() => handleDeleteOrder(order)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" disabled={loadingOrderId === order.id} onClick={() => openSeparationView(order)}>
                              {loadingOrderId === order.id ? "..." : order.status === 'pending' || order.status === 'separating' ? "Separar" : "Visualizar"}
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          {orders === undefined
                            ? "Carregando..."
                            : (filterSearch || filterStatus !== "all")
                              ? "Nenhum pedido corresponde à busca."
                              : "Nenhum pedido encontrado."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardContent className="p-3 flex flex-col gap-3 md:hidden">
                {filteredOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                    <div className="flex flex-col gap-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{order.customerName}</span>
                        {order.tipo === "acerto" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider">Acerto</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{order.items.length} itens · {format(order.createdAt, 'dd/MM HH:mm')}</span>
                      <span className={`mt-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-slate-800 text-slate-400' : order.status === 'separating' ? 'bg-amber-500/10 text-amber-500' : order.status === 'closed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        {statusMap[order.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {canDelete(order) && (
                        <Button
                          size="sm" variant="ghost"
                          disabled={deletingOrderId === order.id}
                          onClick={() => handleDeleteOrder(order)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={loadingOrderId === order.id} onClick={() => openSeparationView(order)}>
                        {loadingOrderId === order.id ? "..." : order.status === 'pending' || order.status === 'separating' ? "Separar" : "Ver"}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <p className="text-center py-8 text-slate-500 text-sm">
                    {orders === undefined
                      ? "Carregando..."
                      : (filterSearch || filterStatus !== "all")
                        ? "Nenhum pedido corresponde à busca."
                        : "Nenhum pedido encontrado."}
                  </p>
                )}
              </CardContent>
              <PageNav
                page={currentPage}
                pageSize={15}
                hasMore={hasMore}
                onChange={goToPage}
                loading={loadingMore}
              />
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
                    <label className="text-sm font-medium">Tipo de Pedido</label>
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden h-10">
                      <button
                        type="button"
                        onClick={() => setTipo("envio")}
                        className={`flex-1 text-sm font-medium transition-colors ${tipo === "envio" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                      >
                        Envio Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipo("acerto")}
                        className={`flex-1 text-sm font-medium transition-colors border-l border-slate-700 ${tipo === "acerto" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                      >
                        Acerto
                      </button>
                    </div>
                  </div>
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
                          } else { e.preventDefault(); }
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
                        // Múltiplas linhas preenchidas = colagem — sem autocomplete
                        if (lines.filter(l => l.trim().length > 0).length > 1) { setSuggestions([]); return; }
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

        <TabsContent value="wpp" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Converter Mensagem WPP</CardTitle>
              <CardDescription>Cole a mensagem informal do WhatsApp e extraia os itens automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={6}
                className="font-mono text-sm leading-relaxed"
                placeholder={"Ex: Favor faturar 10 combos da vida e saúde e 5 bíblias para ABC!"}
                value={wppText}
                onChange={e => { setWppText(e.target.value); setWppResult(null); }}
              />
              <Button
                onClick={handleConvertWpp}
                disabled={!wppText.trim() || !products || wppLoading}
              >
                {wppLoading ? (
                  <><div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Analisando...</>
                ) : (
                  <><Wand2 className="mr-2 h-4 w-4" />Converter</>
                )}
              </Button>

              {wppResult !== null && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  {wppResult.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Nenhum item encontrado. Verifique o texto e tente novamente.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-slate-500">
                          {wppResult.filter(r => r.matched).length} de {wppResult.length} itens reconhecidos
                        </p>
                        {wppMode === "ai" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                            ✦ IA Groq
                          </span>
                        )}
                        {wppMode === "local" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-500 border border-slate-700">
                            Análise local
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {wppResult.map((item, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border overflow-hidden ${
                              item.matched
                                ? "border-emerald-800/40 bg-emerald-900/10"
                                : "border-red-800/40 bg-red-900/10"
                            }`}
                          >
                            {/* Item row */}
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              {/* Qty stepper */}
                              <div className="flex items-center shrink-0">
                                <button
                                  className="w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-slate-700 text-sm font-bold transition-colors"
                                  onClick={() => updateWppQty(i, -1)}
                                >−</button>
                                <span className="text-slate-300 font-mono text-sm w-8 text-center select-none">{item.qty}×</span>
                                <button
                                  className="w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-slate-700 text-sm font-bold transition-colors"
                                  onClick={() => updateWppQty(i, 1)}
                                >+</button>
                              </div>

                              {/* Product name */}
                              <div className="flex-1 min-w-0">
                                {item.matched ? (
                                  <>
                                    <p className="text-sm text-emerald-300 font-medium truncate">{item.matched.name}</p>
                                    {item.rawText.toLowerCase() !== item.matched.name.toLowerCase() && (
                                      <p className="text-[10px] text-slate-600 truncate">"{item.rawText}"</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm text-red-400 truncate">
                                    {item.rawText}
                                    <span className="text-slate-600 text-xs ml-1">— não encontrado</span>
                                  </p>
                                )}
                              </div>

                              {/* Search toggle + status */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  className="text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5 transition-colors"
                                  onClick={() => {
                                    if (wppEditSearch?.idx === i) {
                                      setWppEditSearch(null);
                                      setWppEditResults([]);
                                    } else {
                                      handleWppItemSearch(i, "");
                                    }
                                  }}
                                >
                                  {item.matched ? "trocar" : "buscar"}
                                </button>
                                <span className={`text-xs font-bold ${item.matched ? "text-emerald-500" : "text-red-500"}`}>
                                  {item.matched ? "✓" : "✗"}
                                </span>
                              </div>
                            </div>

                            {/* Inline search panel */}
                            {wppEditSearch?.idx === i && (
                              <div className="border-t border-slate-700 p-2 bg-slate-900/60 space-y-1">
                                <Input
                                  autoFocus
                                  placeholder="Buscar produto no catálogo..."
                                  value={wppEditSearch.query}
                                  onChange={e => handleWppItemSearch(i, e.target.value)}
                                  className="h-7 text-xs bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                />
                                {wppEditResults.length > 0 && (
                                  <div className="bg-slate-800 rounded border border-slate-700 max-h-36 overflow-y-auto">
                                    {wppEditResults.map(r => (
                                      <button
                                        key={r.id}
                                        className="w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-indigo-600 transition-colors"
                                        onClick={() => updateWppProduct(i, r)}
                                      >
                                        {r.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {wppEditSearch.query.length >= 2 && wppEditResults.length === 0 && (
                                  <p className="text-[10px] text-slate-600 px-1">Nenhum produto encontrado.</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {wppResult.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-3">
                          <p className="text-sm font-medium text-slate-300">Dados do pedido</p>
                          <div className="flex rounded-lg border border-slate-700 overflow-hidden h-10">
                            <button
                              type="button"
                              onClick={() => setTipo("envio")}
                              className={`flex-1 text-sm font-medium transition-colors ${tipo === "envio" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                            >
                              Envio Normal
                            </button>
                            <button
                              type="button"
                              onClick={() => setTipo("acerto")}
                              className={`flex-1 text-sm font-medium transition-colors border-l border-slate-700 ${tipo === "acerto" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                            >
                              Acerto
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              placeholder="Nome do cliente"
                              value={customerName}
                              onChange={e => { setCustomerName(e.target.value); setErrors(prev => ({...prev, customerName: undefined})); }}
                              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                            />
                            <Input
                              placeholder="Cidade de destino"
                              value={destinationCity}
                              onChange={e => { setDestinationCity(e.target.value); setErrors(prev => ({...prev, destinationCity: undefined})); }}
                              className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                            />
                            <Select value={campaignCode} onValueChange={v => { setCampaignCode(v || ""); setWarehouse(""); }}>
                              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                <SelectValue placeholder="Campanha..." />
                              </SelectTrigger>
                              <SelectContent>{CAMPANHAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={warehouse} onValueChange={v => setWarehouse(v as WarehouseId)} disabled={!campaignCode}>
                              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                <SelectValue placeholder={campaignCode ? "Depósito..." : "Campanha primeiro"} />
                              </SelectTrigger>
                              <SelectContent>{warehouseOptions.map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {(errors.customerName || errors.destinationCity) && (
                            <p className="text-red-400 text-xs">{errors.customerName || errors.destinationCity}</p>
                          )}
                          <Button className="w-full" onClick={handleFillFromWpp}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Criar Pedido com estes itens
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={(open) => { setShowPreview(open); if (!open) { setManualSearch(null); setManualSearchResults([]); setExpandedAmbiguous(new Set()); } }}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Validar Itens do Pedido</DialogTitle>
            <DialogDescription className="text-slate-400">Revise os itens antes de confirmar o pedido.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {parsedItems.filter(item => !item.productId.startsWith('unknown-')).length > 0 && (
              <div className="space-y-2">
                <p className="text-green-400 text-sm font-medium">Produtos encontrados:</p>
                {parsedItems.map((item, idx) => {
                  if (item.productId.startsWith('unknown-')) return null;
                  const amb = ambiguousItems.find(a => a.idx === idx);
                  const isExpanded = expandedAmbiguous.has(idx);
                  return (
                    <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="p-2 flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{item.quantity}x</span>
                        <span className="text-slate-200 text-sm flex-1">{item.name}</span>
                        {(() => {
                          const disp = getStock(item.productId);
                          if (disp === null) return null;
                          const ok = disp >= item.quantity;
                          return <span className={`text-xs font-mono ${ok ? "text-emerald-400" : "text-red-400"}`}>{disp} em estoque</span>;
                        })()}
                        {amb && (
                          <button
                            className="text-xs text-yellow-400 border border-yellow-500/40 rounded px-1.5 py-0.5 hover:bg-yellow-500/10 transition-colors shrink-0"
                            onClick={() => setExpandedAmbiguous(prev => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              return next;
                            })}
                          >
                            {amb.options.length} opções
                          </button>
                        )}
                      </div>
                      {amb && isExpanded && (
                        <div className="border-t border-slate-700 p-2 space-y-1 bg-slate-900/50">
                          <p className="text-[10px] text-slate-500 mb-1">Digitado: "{amb.query}" — toque para escolher outra opção</p>
                          {amb.options.map(opt => (
                            <button
                              key={opt.id}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${item.productId === opt.id ? "bg-indigo-600 text-white" : "hover:bg-indigo-600/40 text-slate-200 border border-slate-700"}`}
                              onClick={() => {
                                const newItems = [...parsedItems];
                                newItems[idx] = { ...newItems[idx], productId: opt.id, name: opt.name };
                                setParsedItems(newItems);
                                setExpandedAmbiguous(prev => { const next = new Set(prev); next.delete(idx); return next; });
                              }}
                            >
                              <span className="text-slate-400 font-mono mr-1">{opt.id}</span> {opt.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                          setManualSearch({ idx });
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
          {dialogError && (
            <p className="text-red-400 text-xs text-center px-1 -mb-2">{dialogError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPreview(false); setDialogError(null); }}>Cancelar</Button>
            <Button onClick={handleCreateOrder} disabled={!profileLoaded}>
              <PlusCircle className="mr-2 h-4 w-4" /> Confirmar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrder} onOpenChange={(open) => { if (!open) { setEditingOrder(null); setEditAddSearch(""); setEditAddResults([]); setEditKnownPhotoUrls(new Set()); } }}>
        <DialogContent className="max-w-lg border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Pedido</DialogTitle>
            <DialogDescription className="text-slate-400">Altere os dados do pedido. Itens separados são preservados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Nome do Cliente</label>
              <Input value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Código da Campanha</label>
              <Select value={editCampaignCode} onValueChange={(v) => setEditCampaignCode(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPANHAS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Cidade de Destino</label>
              <Input value={editDestinationCity} onChange={e => setEditDestinationCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Itens</label>
              <div className="space-y-2">
                {editItems.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${item.isSeparated ? "bg-emerald-900/10 border-emerald-800/40" : "bg-slate-800 border-slate-700"}`}>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                        setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it));
                      }}>−</Button>
                      <span className="text-white font-bold text-sm w-6 text-center">{item.quantity}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                        setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it));
                      }}>+</Button>
                    </div>
                    <span className={`text-sm flex-1 truncate ${item.isSeparated ? "text-emerald-400" : "text-slate-200"}`}>{item.name}</span>
                    {item.isSeparated && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">separado</span>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 shrink-0" onClick={() => {
                      setEditItems(prev => prev.filter((_, i) => i !== idx));
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="relative pt-2">
            <Input
              placeholder="Adicionar material..."
              value={editAddSearch}
              onChange={e => {
                const q = e.target.value;
                setEditAddSearch(q);
                if (q.length >= 2 && products) {
                  setEditAddResults(
                    products
                      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
                      .sort((a, b) =>
                        (a.name.toLowerCase().startsWith(q.toLowerCase()) ? -1 : 1) -
                        (b.name.toLowerCase().startsWith(q.toLowerCase()) ? -1 : 1)
                      )
                      .slice(0, 6)
                  );
                } else {
                  setEditAddResults([]);
                }
              }}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
            {editAddResults.length > 0 && (
              <div className="absolute z-20 bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
                {editAddResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      setEditItems(prev => [...prev, { productId: p.id, name: p.name, quantity: 1, isSeparated: false }]);
                      setEditAddSearch("");
                      setEditAddResults([]);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditOrder} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-9 right-0 text-white/70 hover:text-white text-sm transition-colors"
              onClick={() => setPreviewImageUrl(null)}
            >
              ✕ Fechar
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {(photoItemQueue || packedPhotoQueue) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setPhotoItemQueue(null);
            setPhotoItemIndex(null);
            setPackedPhotoQueue(null);
          }}
        >
          <div
            className={`relative w-full max-w-sm mx-4 rounded-xl p-4 ${packedPhotoQueue ? 'bg-green-50 border border-green-200' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Botão fechar */}
            <button
              className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold transition-colors ${
                packedPhotoQueue
                  ? 'text-green-700/60 hover:text-green-900 hover:bg-green-100'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              onClick={() => {
                setPhotoItemQueue(null);
                setPhotoItemIndex(null);
                setPackedPhotoQueue(null);
              }}
            >
              ✕
            </button>

            {photoUploading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-600 text-sm">Enviando foto...</p>
              </div>
            ) : packedPhotoQueue ? (
              <>
                <h2 className="text-green-800 font-semibold text-base mb-1">Pedido Separado!</h2>
                <p className="text-green-700 text-sm mb-1">Todos os itens foram separados. Tire uma foto das caixas fechadas para encerrar o pedido.</p>
                <p className="text-green-600/70 text-xs mb-4">Você pode adicionar a foto depois reabrindo o pedido.</p>
                <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg bg-green-600 hover:bg-green-700 text-white cursor-pointer flex-col items-center gap-2 justify-center" })}>
                  <Package className="h-8 w-8 shrink-0" />
                  <span>Foto do Pedido Embalado</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoCapture(e, 'packed')} />
                </label>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-base mb-1 text-slate-800">Foto do Item Separado</h2>
                <p className="text-sm text-slate-600 mb-4">Tire uma foto de {photoItemQueue?.quantity} unidades de {photoItemQueue?.name}</p>
                <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                  <Camera className="h-8 w-8 shrink-0" />
                  <span>Tirar Foto / Anexar</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoCapture(e, 'item')} />
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
