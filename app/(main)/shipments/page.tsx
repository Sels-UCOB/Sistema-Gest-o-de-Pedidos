"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Order, Shipment } from "@/lib/db";
import { getOrders, getShipments, addShipment, updateOrder, appendReceiptPhoto } from "@/lib/supabase-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Truck } from "lucide-react";
import { format } from "date-fns";
import { useUserRole } from "@/lib/user-context";

export default function ShipmentsPage() {
  const { profileLoaded, refreshTick } = useUserRole();
  const [activeTab, setActiveTab] = useState("create");
  const [pickupName, setPickupName] = useState("");
  const [allOrders, setAllOrders] = useState<Order[] | undefined>(undefined);
  const [shipments, setShipments] = useState<Shipment[] | undefined>(undefined);

  const loadOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      setAllOrders(data);
    } catch {
      setAllOrders([]);
    }
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      const data = await getShipments();
      setShipments(data);
    } catch {
      setShipments([]);
    }
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    loadOrders();
    loadShipments();
  }, [loadOrders, loadShipments, profileLoaded, refreshTick]);

  const closedOrders = allOrders?.filter(o => o.status === "closed") || [];

  const [shippingType, setShippingType] = useState<"transportadora" | "presencial">("transportadora");
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [shippingDate, setShippingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);


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
        shippingDate: new Date(shippingDate).getTime(),
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

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        await appendReceiptPhoto(activeShipmentId, base64);
        await loadShipments();
      } catch (err) {
        console.error(err);
        alert("Erro ao salvar comprovante.");
      }
      setActiveShipmentId(null);
    };
    reader.readAsDataURL(file);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-white">Gestão de Envios</h1>
          <p className="text-slate-500">Agrupe pedidos e gere envios.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="create">Novo</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
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
                  {shipments?.map(shipment => (
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
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setActiveShipmentId(shipment.id)}>
                          Comprovantes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!shipments || shipments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        {shipments === undefined ? "Carregando..." : "Nenhum envio registrado."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardContent className="p-3 flex flex-col gap-3 md:hidden">
              {shipments?.map(shipment => (
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
                  <Button size="sm" variant="outline" onClick={() => setActiveShipmentId(shipment.id)}>
                    Comprovantes
                  </Button>
                </div>
              ))}
              {(!shipments || shipments.length === 0) && (
                <p className="text-center py-8 text-slate-500 text-sm">
                  {shipments === undefined ? "Carregando..." : "Nenhum envio registrado."}
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

      {activeShipmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActiveShipmentId(null)}>
          <div className="relative w-full max-w-sm mx-4 rounded-xl p-4 bg-slate-900 border border-slate-800" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-base mb-1 text-white">Anexar Comprovantes</h2>
            <p className="text-sm text-slate-400 mb-4">Tire fotos dos comprovantes fiscais ou recibos da transportadora</p>
            <div className="flex flex-col gap-4">
              <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                <Camera className="h-8 w-8 shrink-0" />
                <span>Adicionar Foto</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptPhotoCapture} />
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
