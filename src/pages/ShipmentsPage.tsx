import React, { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Order, Shipment } from "../lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, FileText, Truck, Printer, Search } from "lucide-react";
import { format } from "date-fns";

// Basic implementation of PDF generator using native printing or window print
export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("list");
  
  // Queries
  const allOrders = useLiveQuery(() => db.orders.orderBy("createdAt").reverse().toArray());
  const shipments = useLiveQuery(() => db.shipments.orderBy("createdAt").reverse().toArray());
  
  const closedOrders = allOrders?.filter(o => o.status === "closed") || [];
  
  // New Shipment State
  const [shippingType, setShippingType] = useState<"transportadora" | "presencial">("transportadora");
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [shippingDate, setShippingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // UI State
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  
  // Report filters
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
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival).getTime() : undefined,
        orderIds: selectedOrderIds,
        status: "pending",
        createdAt: Date.now(),
        receiptPhotoUrls: []
      });

      // Update orders
      for (const oid of selectedOrderIds) {
        await db.orders.update(oid, { shipmentId, status: "shipped" });
      }

      setShippingType("transportadora");
      setCarrierName("");
      setCarrierPhone("");
      setShippingDate(format(new Date(), "yyyy-MM-dd"));
      setEstimatedArrival("");
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
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Gestão de Envios</h1>
          <p className="text-slate-400">Agrupe pedidos e gere envios.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="list">Lista de Envios</TabsTrigger>
          <TabsTrigger value="create">Novo Envio</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardContent className="p-0">
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
                      <TableCell>{format(shipment.shippingDate, 'dd/MM/yyyy')}</TableCell>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Transportadora</Label>
                        <Input value={carrierName} onChange={e => setCarrierName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone (Contato)</Label>
                        <Input value={carrierPhone} onChange={e => setCarrierPhone(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Envio</Label>
                      <Input type="date" value={shippingDate} onChange={e => setShippingDate(e.target.value)} />
                    </div>
                    {shippingType === "transportadora" && (
                      <div className="space-y-2">
                        <Label>Previsão de Chegada</Label>
                        <Input type="date" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} />
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
            <CardHeader className="flex flex-row justify-between items-center">
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

      {/* Report PDF View - visible only on print */}
      <div className="hidden print:block space-y-12 bg-white text-black text-sm">
        <h1 className="text-2xl font-bold border-b pb-2">Relatório de Envios e Pedidos</h1>
        
        {shipments?.map(shipment => {
          // Filter if dates selected
          if (reportStartDate && new Date(shipment.shippingDate) < new Date(reportStartDate)) return null;
          if (reportEndDate && new Date(shipment.shippingDate) > new Date(reportEndDate)) return null;
          
          return (
            <div key={shipment.id} className="border p-4 rounded-lg break-inside-avoid shadow-sm mb-6">
              <h2 className="text-xl font-bold bg-slate-100 p-2 rounded flex justify-between">
                <span>Envio - {format(shipment.shippingDate, 'dd/MM/yyyy')}</span>
                <span>{shipment.type.toUpperCase()}</span>
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                <div>
                  <p><strong>Transportadora:</strong> {shipment.carrierName || "N/A"}</p>
                  <p><strong>Telefone:</strong> {shipment.carrierPhone || "N/A"}</p>
                </div>
                <div>
                  <p><strong>Previsão de Chegada:</strong> {shipment.estimatedArrival ? format(shipment.estimatedArrival, 'dd/MM/yyyy') : "N/A"}</p>
                </div>
              </div>

              {shipment.receiptPhotoUrls && shipment.receiptPhotoUrls.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-bold mb-2">Comprovantes:</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {shipment.receiptPhotoUrls.map((url, i) => (
                      <img key={i} src={url} alt="Comprovante" className="max-h-40 object-cover border" />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-bold border-b mb-2">Pedidos Nestes Envio</h3>
                <div className="space-y-4">
                  {shipment.orderIds.map(oid => {
                     const order = allOrders?.find(o => o.id === oid);
                     if (!order) return null;
                     return (
                       <div key={oid} className="bg-slate-50 p-3 rounded">
                         <div className="flex justify-between font-semibold border-b border-slate-200 pb-2 mb-2">
                           <span>{order.customerName} - {order.destinationCity}</span>
                           <span>Campanha: {order.campaignCode}</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <ul className="text-xs space-y-1">
                             {order.items.map((it, idx) => (
                               <li key={idx} className="flex justify-between">
                                 <span>{it.quantity}x {it.name}</span>
                               </li>
                             ))}
                           </ul>
                           {order.packedPhotoUrl && (
                             <div className="flex flex-col items-center justify-center">
                               <p className="text-[10px] font-bold text-slate-500 mb-1">Caixa Fechada</p>
                               <img src={order.packedPhotoUrl} className="max-h-32 border" alt="Embalado" />
                             </div>
                           )}
                         </div>
                       </div>
                     )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!activeShipmentId} onOpenChange={() => setActiveShipmentId(null)}>
        <DialogContent className="max-w-sm text-center border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Anexar Comprovantes</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tire fotos dos comprovantes fiscais ou recibos da transportadora
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-4">
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

            {activeShipmentId && shipments?.find(s => s.id === activeShipmentId)?.receiptPhotoUrls?.map((url, i) => (
               <img key={i} src={url} alt="Comprovante" className="max-h-48 object-cover border rounded" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
