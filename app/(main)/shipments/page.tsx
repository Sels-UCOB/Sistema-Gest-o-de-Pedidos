"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Order, Shipment } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Truck, Printer } from "lucide-react";
import { format } from "date-fns";

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("create");
  const [pickupName, setPickupName] = useState("");

  const allOrders = useLiveQuery(() => db.orders.orderBy("createdAt").reverse().toArray());
  const shipments = useLiveQuery(() => db.shipments.orderBy("createdAt").reverse().toArray());

  const closedOrders = allOrders?.filter(o => o.status === "closed") || [];

  const [shippingType, setShippingType] = useState<"transportadora" | "presencial">("transportadora");
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [shippingDate, setShippingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);

  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  const handleCreateShipment = async () => {
    if (selectedOrderIds.length === 0) {
      alert("Selecione pelo menos um pedido!");
      return;
    }

    try {
      const shipmentId = crypto.randomUUID();
      await db.shipments.add({
        id: shipmentId,
        type: shippingType,
        carrierName: shippingType === "transportadora" ? carrierName : undefined,
        carrierPhone: shippingType === "transportadora" ? carrierPhone : undefined,
        shippingDate: new Date(shippingDate).getTime(),
        pickupName: shippingType === "presencial" ? pickupName : undefined,
        orderIds: selectedOrderIds,
        status: "pending",
        createdAt: Date.now(),
        receiptPhotoUrls: []
      });

      for (const oid of selectedOrderIds) {
        await db.orders.update(oid, { shipmentId, status: "shipped" });
      }

      setShippingType("transportadora");
      setCarrierName("");
      setCarrierPhone("");
      setShippingDate(format(new Date(), "yyyy-MM-dd"));
      setPickupName("");
      setSelectedOrderIds([]);
      setActiveTab("list");
    } catch (err) {
      console.error(err);
      alert("Erro ao criar envio.");
    }
  };

  const handleReceiptPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeShipmentId) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const shipment = await db.shipments.get(activeShipmentId);
      if (shipment) {
        const newUrls = [...(shipment.receiptPhotoUrls || []), base64];
        await db.shipments.update(activeShipmentId, {
          receiptPhotoUrls: newUrls,
          status: "shipped"
        });
      }
      setActiveShipmentId(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePrintReport = () => {
    const filtered = shipments?.filter(s => {
      if (reportStartDate && new Date(s.shippingDate) < new Date(reportStartDate)) return false;
      if (reportEndDate && new Date(s.shippingDate) > new Date(reportEndDate)) return false;
      return true;
    }) || [];

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>Relatório de Envios — Sels UCOB</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; background: white; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e293b; padding-bottom: 12px; }
        .header-left h1 { font-size: 22px; font-weight: bold; color: #1e293b; }
        .header-left p { font-size: 11px; color: #64748b; margin-top: 2px; }
        .header-right { text-align: right; font-size: 11px; color: #64748b; }
        .header-right strong { font-size: 16px; color: #1e293b; display: block; }
        .envio { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 32px; page-break-inside: avoid; overflow: hidden; }
        .envio-header { background: #1e293b; color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
        .envio-header span { font-size: 13px; font-weight: bold; }
        .badge { padding: 2px 10px; border-radius: 20px; font-size: 11px; color: white; }
        .secao { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        .secao-titulo { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .campo { border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; }
        .campo label { display: block; font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 2px; }
        .campo span { font-size: 12px; color: #1e293b; font-weight: 500; }
        .pedido { margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
        .pedido-header { background: #f8fafc; padding: 8px 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; }
        .pedido-header strong { font-size: 12px; color: #1e293b; }
        .pedido-header span { font-size: 11px; color: #64748b; }
        table.itens { width: calc(100% - 24px); border-collapse: collapse; margin: 10px 12px; }
        table.itens th { background: #f1f5f9; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; padding: 4px 8px; border: 1px solid #e2e8f0; }
        table.itens td { padding: 4px 8px; border: 1px solid #e2e8f0; font-size: 11px; }
        .comprovantes { padding: 12px 16px; }
        .comprovantes-titulo { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .comprovantes-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .comprovantes-grid img { max-width: 150px; max-height: 120px; border: 1px solid #e2e8f0; border-radius: 4px; object-fit: cover; }
        .rodape { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        @media print { body { padding: 16px; } .envio { page-break-inside: avoid; } }
      </style>
    </head><body>
    <div style="margin-bottom:24px;">
      <a href="${window.location.origin}" style="font-family:Arial,sans-serif;font-size:13px;color:#4f46e5;text-decoration:none;font-weight:bold;">
        ← Voltar ao Sistema
      </a>
    </div>
      <div class="header">
        <div class="header-left">
          <h1>Sels UCOB</h1>
          <p>Relatório de Envios e Pedidos</p>
          <p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        <div class="header-right">
          <strong>${filtered.length}</strong>
          envio(s) neste relatório
        </div>
      </div>
      ${filtered.map((shipment, si) => {
        const orders = shipment.orderIds
          .map(oid => allOrders?.find(o => o.id === oid))
          .filter(Boolean) as Order[];
        return `
        <div class="envio">
          <div class="envio-header">
            <span>Envio ${si + 1} — ${format(shipment.shippingDate, 'dd/MM/yyyy')}</span>
            <span class="badge" style="background:${shipment.type === 'presencial' ? '#10b981' : '#3b82f6'};">
              ${shipment.type === 'transportadora' ? 'Transportadora' : 'Retirada Presencial'}
            </span>
          </div>
          <div class="secao">
            <div class="secao-titulo">Informações de Transporte</div>
            <div class="grid3">
              <div class="campo"><label>Transportadora</label><span>${shipment.carrierName || '—'}</span></div>
              <div class="campo"><label>Telefone</label><span>${shipment.carrierPhone || '—'}</span></div>
            </div>
          </div>
          <div class="secao">
            <div class="secao-titulo">Pedidos (${orders.length})</div>
            ${orders.map(order => `
              <div class="pedido">
                <div class="pedido-header">
                  <strong>${order.customerName} — ${order.destinationCity}</strong>
                  <span>Campanha: ${order.campaignCode} | Resp: ${order.responsible}</span>
                </div>
                <table class="itens">
                  <thead><tr><th>Qtd</th><th>Produto</th></tr></thead>
                  <tbody>
                    ${order.items.map(it => `
                      <tr>
                        <td style="width:40px;text-align:center">${it.quantity}x</td>
                        <td>${it.name}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')}
          </div>
          ${shipment.receiptPhotoUrls?.length ? `
            <div class="comprovantes">
              <div class="comprovantes-titulo">Comprovantes de Envio</div>
              <div class="comprovantes-grid">
                ${shipment.receiptPhotoUrls.map(url => `<img src="${url}" />`).join('')}
              </div>
            </div>
          ` : ''}
        </div>`;
      }).join('')}
      <div class="rodape">Sels UCOB — Sistema de Gestão de Pedidos</div>
    </body></html>`);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
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
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="create">Novo</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
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
                        Nenhum envio registrado.
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
                <p className="text-center py-8 text-slate-500 text-sm">Nenhum envio registrado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Criar Nova Remessa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Método de Entrega</Label>
                    <RadioGroup value={shippingType} onValueChange={(v) => setShippingType(v as any)} className="flex space-x-4">
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
                        <Input
                          placeholder="Nome completo"
                          value={pickupName}
                          onChange={(e) => setPickupName(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <Button className="w-full" onClick={handleCreateShipment}>
                    <Truck className="mr-2 h-4 w-4" /> Finalizar Envio
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

        <TabsContent value="reports" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle>Relatórios e Exportação</CardTitle>
                <CardDescription>Visualize o espelho dos envios ou pedidos</CardDescription>
              </div>
              <Button onClick={handlePrintReport} variant="secondary">
                <Printer className="mr-2 h-4 w-4" /> Imprimir Relatório
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="space-y-2 flex-1">
                  <Label>Data Inicial (Opcional)</Label>
                  <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Data Final (Opcional)</Label>
                  <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {activeShipmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-sm mx-4 rounded-xl p-4 bg-slate-900 border border-slate-800">
            <h2 className="font-semibold text-base mb-1 text-white">Anexar Comprovantes</h2>
            <p className="text-sm text-slate-400 mb-4">Tire fotos dos comprovantes fiscais ou recibos da transportadora</p>
            <div className="flex flex-col gap-4">
              <label className={buttonVariants({ size: "lg", className: "w-full h-24 text-lg cursor-pointer flex-col items-center gap-2 justify-center" })}>
                <Camera className="h-8 w-8 shrink-0" />
                <span>Adicionar Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptPhotoCapture}
                />
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
