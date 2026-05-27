"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/user-context";
import { getOrdersForGallery, getShipments } from "@/lib/supabase-db";
import type { Order, Shipment } from "@/lib/db";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

type PhotoEntry = {
  id: string;
  customerName: string;
  campaignCode: string;
  createdAt: number;
  photoUrl: string;
  type: "item" | "packed" | "receipt";
  itemName?: string;
  itemQty?: number;
};

export default function GalleryPage() {
  const { isAdmin, profileLoaded } = useUserRole();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState<"all" | "item" | "packed" | "receipt">("all");

  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin) { router.replace("/orders"); return; }
    Promise.all([getOrdersForGallery(), getShipments()])
      .then(([o, s]) => { setOrders(o); setShipments(s); })
      .catch(() => alert("Erro ao carregar galeria."))
      .finally(() => setLoading(false));
  }, [profileLoaded, isAdmin, router]);

  const allPhotos = useMemo<PhotoEntry[]>(() => {
    const entries: PhotoEntry[] = [];

    // fotos de pedidos (itens separados + caixas embaladas)
    for (const order of orders) {
      for (const item of order.items) {
        if (item.photoUrl) {
          entries.push({
            id: `${order.id}-item-${item.productId}`,
            customerName: order.customerName,
            campaignCode: order.campaignCode,
            createdAt: order.createdAt,
            photoUrl: item.photoUrl,
            type: "item",
            itemName: item.name,
            itemQty: item.quantity,
          });
        }
      }
      if (order.packedPhotoUrl) {
        entries.push({
          id: `${order.id}-packed`,
          customerName: order.customerName,
          campaignCode: order.campaignCode,
          createdAt: order.createdAt,
          photoUrl: order.packedPhotoUrl,
          type: "packed",
        });
      }
    }

    // comprovantes de envio
    for (const shipment of shipments) {
      const label = shipment.carrierName ?? shipment.pickupName ?? "Envio";
      const detail = `${shipment.orderIds.length} ped.`;
      for (let i = 0; i < (shipment.receiptPhotoUrls ?? []).length; i++) {
        const url = shipment.receiptPhotoUrls![i];
        entries.push({
          id: `${shipment.id}-receipt-${i}`,
          customerName: label,
          campaignCode: detail,
          createdAt: shipment.shippingDate,
          photoUrl: url,
          type: "receipt",
        });
      }
    }

    // mais recente primeiro
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries;
  }, [orders, shipments]);

  const campaigns = useMemo(
    () => [...new Set(orders.map(o => o.campaignCode))].sort(),
    [orders]
  );

  const filtered = useMemo(() => {
    return allPhotos.filter(p => {
      if (filterType !== "all" && p.type !== filterType) return false;
      // filtro de campanha só se aplica a fotos de pedidos
      if (filterCampaign !== "all" && p.type !== "receipt" && p.campaignCode !== filterCampaign) return false;
      if (filterCustomer && !p.customerName.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
      return true;
    });
  }, [allPhotos, filterCampaign, filterCustomer, filterType]);

  if (!profileLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight text-white">Galeria de Pedidos</h1>
        <p className="text-slate-500">Fotos de pedidos finalizados e comprovantes de envio.</p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
        <Input
          placeholder="Buscar cliente / transportadora..."
          value={filterCustomer}
          onChange={e => setFilterCustomer(e.target.value)}
          className="sm:w-64 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
        <Select value={filterCampaign} onValueChange={v => setFilterCampaign(v ?? "all")}>
          <SelectTrigger className="sm:w-56 bg-slate-900 border-slate-700 text-slate-200">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="sm:w-52 bg-slate-900 border-slate-700 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="item">Itens separados</SelectItem>
            <SelectItem value="packed">Caixas embaladas</SelectItem>
            <SelectItem value="receipt">Comprovantes de envio</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-slate-500 text-sm">
          {filtered.length} foto{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          {allPhotos.length === 0
            ? "Nenhuma foto registrada ainda."
            : "Nenhuma foto encontrada para os filtros selecionados."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="group cursor-pointer rounded-xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-indigo-500/50 transition-colors"
              onClick={() => setPreviewUrl(entry.photoUrl)}
            >
              <div className="aspect-square overflow-hidden bg-slate-800">
                <img
                  src={entry.photoUrl}
                  alt={entry.type === "receipt" ? "Comprovante de envio" : entry.type === "packed" ? "Caixa embalada" : entry.itemName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-2.5">
                <p className="text-white text-xs font-medium truncate">{entry.customerName}</p>
                <p className="text-slate-500 text-[10px] truncate mt-0.5">{entry.campaignCode}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    entry.type === "packed"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : entry.type === "receipt"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-indigo-500/15 text-indigo-400"
                  }`}>
                    {entry.type === "packed"
                      ? "Embalado"
                      : entry.type === "receipt"
                        ? "Comprovante"
                        : `${entry.itemQty}x ${entry.itemName?.split(" ").slice(0, 3).join(" ")}`}
                  </span>
                  <span className="text-slate-600 text-[9px]">{format(entry.createdAt, "dd/MM/yy")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-9 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-4 h-4" /> Fechar
            </button>
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
