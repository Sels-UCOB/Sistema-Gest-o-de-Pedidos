"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Order, Shipment } from "@/lib/db";
import { getClosedOrders, getShipments, addShipment, updateOrder, updateShipment, appendReceiptPhoto, uploadReceiptPhoto } from "@/lib/supabase-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Truck, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useUserRole } from "@/lib/user-context";

function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

const CACHE_KEY_SHIPMENTS = "v1_shipments";
const CACHE_KEY_ORDERS_SLIM = "v1_orders_closed";

function readCache<T>(key: string): { data: T; ts: number } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function formatAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "Atualizado agora";
  if (mins < 60) return `Atualizado há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `Atualizado há ${hrs}h`;
}

export default function ShipmentsPage() {
  const { profileLoaded, refreshTick } = useUserRole();
  const [activeTab, setActiveTab] = useState("create");
  const [pickupName, setPickupName] = useState("");
  const [allOrders, setAllOrders] = useState<Order[] | undefined>(undefined);
  const [shipments, setShipments] = useState<Shipment[] | undefined>(undefined);

  const [loadError, setLoadError] = useState(false);
  const [cacheTs, setCacheTs] = useState<number | null>(null);

  // Restaura cache imediatamente no mount — sem "Carregando..." se já há dados salvos
  useEffect(() => {
    const sc = readCache<Shipment[]>(CACHE_KEY_SHIPMENTS);
    if (sc) { setShipments(sc.data); setCacheTs(sc.ts); }
    const oc = readCache<Order[]>(CACHE_KEY_ORDERS_SLIM);
    if (oc) setAllOrders(oc.data);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await withTimeout(getClosedOrders());
      setAllOrders(data);
      writeCache(CACHE_KEY_ORDERS_SLIM, data);
    } catch {
      setAllOrders(prev => prev ?? []);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadShipments = useCallback(async () => {
    try {
      const data = await withTimeout(getShipments());
      setShipments(data);
      setLoadError(false);
      const ts = Date.now();
      writeCache(CACHE_KEY_SHIPMENTS, data);
      setCacheTs(ts);
    } catch {
      setShipments(prev => prev ?? []);
      setLoadError(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(() => {
    setShipments(undefined);
    setAllOrders(undefined);
    setLoadError(false);
    loadOrders();
    loadShipments();
  }, [loadOrders, loadShipments]);

  useEffect(() => {
    if (!profileLoaded) return;
    loadOrders();
    loadShipments();
  }, [loadOrders, loadShipments, profileLoaded, refreshTick]);

  const closedOrders = allOrders?.filter(o => o.status === "closed") || [];

  const [filterShip, setFilterShip] = useState("");

  const filteredShipments = (shipments ?? []).filter(s => {
    if (!filterShip) return true;
    const q = filterShip.toLowerCase();
    return (
      (s.carrierName ?? "").toLowerCase().includes(q) ||
      (s.pickupName ?? "").toLowerCase().includes(q)
    );
  });

  const [shippingType, setShippingType] = useState<"transportadora" | "presencial">("transportadora");
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [shippingDate, setShippingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editType, setEditType] = useState<"transportadora" | "presencial">("transportadora");
  const [editCarrierName, setEditCarrierName] = useState("");
  const [editCarrierPhone, setEditCarrierPhone] = useState("");
  const [editShippingDate, setEditShippingDate] = useState("");
  const [editPickupName, setEditPickupName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditType(shipment.type);
    setEditCarrierName(shipment.carrierName ?? "");
    setEditCarrierPhone(shipment.carrierPhone ?? "");
    setEditShippingDate(format(shipment.shippingDate, "yyyy-MM-dd"));
    setEditPickupName(shipment.pickupName ?? "");
  };

  const handleSaveEditShipment = async () => {
    if (!editingShipment) return;
    if (editType === "transportadora" && !editCarrierName.trim()) { alert("Informe o nome da transportadora."); return; }
    if (editType === "presencial" && !editPickupName.trim()) { alert("Informe o nome de quem vai retirar."); return; }
    setEditSaving(true);
    try {
      await updateShipment(editingShipment.id, {
        type: editType,
        carrierName: editType === "transportadora" ? editCarrierName : null,
        carrierPhone: editType === "transportadora" ? editCarrierPhone : null,
        shippingDate: new Date(editShippingDate + "T00:00:00").getTime(),
        pickupName: editType === "presencial" ? editPickupName : null,
      });
      setEditingShipment(null);
      await loadShipments();
    } catch {
      alert("Erro ao salvar alterações.");
    } finally {
      setEditSaving(false);
    }
  };


  const handleCreateShipment = async () => {
    if (selectedOrderIds.length === 0) { alert("Selecione pelo menos um pedido!"); return; }
    if (shippingType === "transportadora" && !carrierName.trim()) { alert("Informe o nome da transportadora."); return; }
    if (shippingType === "presencial" && !pickupName.trim()) { alert("Informe o nome de quem vai retirar."); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const newShipment = await addShipment({
        type: shippingType,
        carrierName: shippingType === "transportadora" ? carrierName : undefined,
        carrierPhone: shippingType === "transportadora" ? carrierPhone : undefined,
        shippingDate: new Date(shippingDate + "T00:00:00").getTime(),
        pickupName: shippingType === "presencial" ? pickupName : undefined,
        orderIds: selectedOrderIds,
        status: "pending",
        receiptPhotoUrls: [],
      });

      await Promise.all(
        selectedOrderIds.map(oid => updateOrder(oid, { shipmentId: newShipment.id, status: "shipped" }))
      );

      setShippingType("transportadora");
      setCarrierName("");
      setCarrierPhone("");
      setShippingDate(format(new Date(), "yyyy-MM-dd"));
      setPickupName("");
      setSelectedOrderIds([]);
      setActiveTab("list");
      // Invalida o cache de pedidos para que a página de pedidos reflita os status atualizados
      try { localStorage.removeItem("v1_orders_list"); } catch {}
      await loadShipments();
      await loadOrders();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar envio.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiptPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeShipmentId) return;
    try {
      const url = await uploadReceiptPhoto(file, activeShipmentId);
      await appendReceiptPhoto(activeShipmentId, url);
      await loadShipments();
      setActiveShipmentId(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar comprovante. Verifique sua conexão e tente novamente.");
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Gestão de Envios</h1>
          <p className="text-slate-500">Agrupe pedidos e gere envios.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="create">Novo</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {cacheTs && (
            <p className="text-xs text-slate-500 mb-2">{formatAge(cacheTs)}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mb-4 items-start sm:items-center">
            <Input
              placeholder="Buscar transportadora ou retirada..."
              value={filterShip}
              onChange={e => setFilterShip(e.target.value)}
              className="sm:w-72 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-9"
            />
            <span className="text-slate-500 text-sm self-center">
              {filteredShipments.length} envio{filteredShipments.length !== 1 ? "s" : ""}
              {filterShip && shipments && shipments.length !== filteredShipments.length
                ? ` de ${shipments.length}` : ""}
            </span>
          </div>
          {loadError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">Falha ao carregar os dados. Verifique sua conexão.</p>
              <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={handleRetry}>
                Tentar novamente
              </Button>
            </div>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data de Envio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map(shipment => (
                    <TableRow key={shipment.id}>
                      <TableCell>{format(shipment.shippingDate, 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium capitalize">{shipment.type}</span>
                          {shipment.type === "transportadora" && <span className="text-xs text-slate-400">{shipment.carrierName}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{shipment.orderIds.length} pedidos</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${shipment.status === "shipped" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {shipment.status === "shipped" ? "Enviado/Concluído" : "Aguardando Comprovante"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-1">
                        {shipment.status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => openEditShipment(shipment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setActiveShipmentId(shipment.id)}>
                          Comprovantes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredShipments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        {shipments === undefined
                          ? "Carregando..."
                          : filterShip
                            ? "Nenhum envio corresponde à busca."
                            : "Nenhum envio registrado."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardContent className="p-3 flex flex-col gap-3 md:hidden">
              {filteredShipments.map(shipment => (
                <div key={shipment.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-white text-sm">
                      {shipment.type === "transportadora" ? shipment.carrierName : "Retirada Presencial"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(shipment.shippingDate, 'dd/MM/yyyy')} · {shipment.orderIds.length} pedidos
                    </span>
                    <span className={`mt-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${shipment.status === "shipped" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {shipment.status === "shipped" ? "Enviado" : "Aguardando"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {shipment.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => openEditShipment(shipment)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setActiveShipmentId(shipment.id)}>
                      Comprovantes
                    </Button>
                  </div>
                </div>
              ))}
              {filteredShipments.length === 0 && (
                <p className="text-center py-8 text-slate-500 text-sm">
                  {shipments === undefined
                    ? "Carregando..."
                    : filterShip
                      ? "Nenhum envio corresponde à busca."
                      : "Nenhum envio registrado."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Criar Nova Remessa</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Método de Entrega</Label>
                    <RadioGroup value={shippingType} onValueChange={(v) => setShippingType(v as "transportadora" | "presencial")} className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="transportadora" id="trans" />
                        <Label htmlFor="trans">Transportadora</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="presencial" id="pres" />
                        <Label htmlFor="pres">Retirada Presencial</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {shippingType === "transportadora" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Transportadora</Label>
                        <Input value={carrierName} onChange={e => setCarrierName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone (Contato)</Label>
                        <Input value={carrierPhone} onChange={e => setCarrierPhone(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Envio</Label>
                      <Input type="date" value={shippingDate} onChange={e => setShippingDate(e.target.value)} />
                    </div>
                    {shippingType === "presencial" && (
                      <div className="space-y-2">
                        <Label>Nome de Quem Retirou</Label>
                        <Input placeholder="Nome completo" value={pickupName} onChange={(e) => setPickupName(e.target.value)} />
                      </div>
                    )}
                  </div>

                  <Button className="w-full" onClick={handleCreateShipment} disabled={submitting}>
                    <Truck className="mr-2 h-4 w-4" /> {submitting ? "Salvando..." : "Finalizar Envio"}
                  </Button>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <Label className="mb-4 block text-slate-300">Pedidos Fechados Aguardando Envio</Label>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {closedOrders.map(order => (
                      <div key={order.id} className="flex items-start space-x-3 bg-slate-800/40 p-3 border border-slate-800 rounded shadow-sm">
                        <Checkbox
                          id={order.id}
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedOrderIds([...selectedOrderIds, order.id]);
                            else setSelectedOrderIds(selectedOrderIds.filter(id => id !== order.id));
                          }}
                        />
                        <div className="flex-1">
                          <Label htmlFor={order.id} className="font-semibold text-white">{order.customerName}</Label>
                          <p className="text-xs text-slate-400">{order.destinationCity} | {order.items.length} itens</p>
                        </div>
                      </div>
                    ))}
                    {closedOrders.length === 0 && (
                      <div className="text-sm text-slate-500 text-center py-4">Nenhum pedido aguardando envio.</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={!!editingShipment} onOpenChange={(open) => { if (!open) setEditingShipment(null); }}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Envio</DialogTitle>
            <DialogDescription className="text-slate-400">Altere os dados do envio enquanto ele aguarda comprovante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Método de Entrega</Label>
              <RadioGroup value={editType} onValueChange={(v) => setEditType(v as "transportadora" | "presencial")} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="transportadora" id="edit-trans" />
                  <Label htmlFor="edit-trans">Transportadora</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="presencial" id="edit-pres" />
                  <Label htmlFor="edit-pres">Retirada Presencial</Label>
                </div>
              </RadioGroup>
            </div>
            {editType === "transportadora" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transportadora</Label>
                  <Input value={editCarrierName} onChange={e => setEditCarrierName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={editCarrierPhone} onChange={e => setEditCarrierPhone(e.target.value)} />
                </div>
              </div>
            )}
            {editType === "presencial" && (
              <div className="space-y-2">
                <Label>Nome de Quem Retirou</Label>
                <Input value={editPickupName} onChange={e => setEditPickupName(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Data de Envio</Label>
              <Input type="date" value={editShippingDate} onChange={e => setEditShippingDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShipment(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditShipment} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeShipmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActiveShipmentId(null)}>
          <div className="relative w-full max-w-sm mx-4 rounded-xl p-4 bg-slate-900 border border-slate-800" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-base mb-1 text-white">Anexar Comprovantes</h2>
            <p className="text-sm text-slate-400 mb-4">Tire fotos dos comprovantes fiscais ou recibos da transportadora</p>
            <div className="flex flex-col gap-4">
              <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                <Camera className="h-8 w-8 shrink-0" />
                <span>Adicionar Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleReceiptPhotoCapture} />
              </label>
              {shipments?.find(s => s.id === activeShipmentId)?.receiptPhotoUrls?.map((url, i) => (
                <img key={i} src={url} alt="Comprovante" className="max-h-48 object-cover border rounded" />
              ))}
            </div>
            <button
              onClick={() => setActiveShipmentId(null)}
              className="absolute top-2 right-2 text-slate-400 hover:text-white text-lg font-bold px-2"
            >✕</button>
          </div>
        </div>
      )}

    </div>
  );
}
