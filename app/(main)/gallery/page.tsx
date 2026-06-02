"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/user-context";
import { getGalleryMetadataPaged, getPhotosBulk, getShipments } from "@/lib/supabase-db";
import type { GalleryMetaRow } from "@/lib/supabase-db";
import type { Shipment } from "@/lib/db";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

const PAGE_SIZE = 24;

type MetaEntry = {
  id: string;
  customerName: string;
  campaignCode: string;
  createdAt: number;
  type: "item" | "packed" | "receipt";
  orderId?: string;
  productId?: string | null;
  itemName?: string;
  itemQty?: number;
  photoUrl?: string; // receipts only — URL já disponível
};

type PhotoCardProps = {
  entry: MetaEntry;
  photoUrl: string | null | undefined;
  onPreview: (url: string) => void;
};

// photoUrl: string = tem foto | null = sem foto | undefined = ainda carregando
const PhotoCard = memo(({ entry, photoUrl, onPreview }: PhotoCardProps) => {
  const url = entry.photoUrl ?? photoUrl;
  const status: "loading" | "done" | "noPhoto" =
    url === undefined ? "loading" : url ? "done" : "noPhoto";

  const badgeClass =
    entry.type === "packed"  ? "bg-emerald-500/15 text-emerald-400" :
    entry.type === "receipt" ? "bg-amber-500/15 text-amber-400"     :
                               "bg-indigo-500/15 text-indigo-400";
  const badgeLabel =
    entry.type === "packed"  ? "Embalado"    :
    entry.type === "receipt" ? "Comprovante" :
    `${entry.itemQty}x ${entry.itemName?.split(" ").slice(0, 3).join(" ")}`;

  return (
    <div
      // [transform:translateZ(0)] força GPU layer no pai, garantindo que overflow-hidden
      // clips corretamente filhos com transform:scale durante scroll
      className="group cursor-pointer rounded-xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-indigo-500/50 transition-colors [transform:translateZ(0)]"
      onClick={() => { if (url && status === "done") onPreview(url); }}
    >
      <div className="aspect-square overflow-hidden bg-slate-800 flex items-center justify-center">
        {status === "done" && url ? (
          <img
            src={url}
            alt={entry.itemName ?? entry.type}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : status === "noPhoto" ? (
          <div className="flex flex-col items-center gap-1 text-slate-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            <span className="text-[10px]">Sem foto</span>
          </div>
        ) : (
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <div className="p-2.5">
        <p className="text-white text-xs font-medium truncate">{entry.customerName}</p>
        <p className="text-slate-500 text-[10px] truncate mt-0.5">{entry.campaignCode}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
          <span className="text-slate-600 text-[9px]">{format(entry.createdAt, "dd/MM/yy")}</span>
        </div>
      </div>
    </div>
  );
});

export default function GalleryPage() {
  const { isAdmin, profileLoaded } = useUserRole();
  const router = useRouter();

  const [metaRows, setMetaRows] = useState<GalleryMetaRow[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  // string = URL disponível | null = sem foto | undefined = ainda não carregado
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState<"all" | "item" | "packed" | "receipt">("all");

  const loadPhotos = useCallback(async (rows: GalleryMetaRow[]) => {
    if (rows.length === 0) return;
    try {
      const urls = await getPhotosBulk(
        rows.map(r => ({ id: r.id, orderId: r.order_id, type: r.photo_type, productId: r.product_id }))
      );
      setPhotoUrls(prev => ({ ...prev, ...urls }));
    } catch {
      // Em caso de erro, marca como null (sem foto) para não ficar girando
      const fallback = Object.fromEntries(rows.map(r => [r.id, null]));
      setPhotoUrls(prev => ({ ...prev, ...fallback }));
    }
  }, []);

  // Carregamento inicial: primeira página + remessas em paralelo
  useEffect(() => {
    if (!profileLoaded) return;
    if (!isAdmin) { router.replace("/orders"); return; }

    Promise.all([getGalleryMetadataPaged(0, PAGE_SIZE), getShipments()])
      .then(([{ rows, total: t }, ships]) => {
        setMetaRows(rows);
        setTotal(t);
        setShipments(ships);
        setLoadingMeta(false);
        loadPhotos(rows); // dispara sem bloquear a UI
      })
      .catch(() => {
        alert("Erro ao carregar galeria.");
        setLoadingMeta(false);
      });
  }, [profileLoaded, isAdmin, router, loadPhotos]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const { rows, total: t } = await getGalleryMetadataPaged(metaRows.length, PAGE_SIZE);
      setMetaRows(prev => [...prev, ...rows]);
      setTotal(t);
      loadPhotos(rows);
    } catch {
      alert("Erro ao carregar mais fotos.");
    } finally {
      setLoadingMore(false);
    }
  }, [metaRows.length, loadPhotos]);

  const allEntries = useMemo<MetaEntry[]>(() => {
    const entries: MetaEntry[] = metaRows.map(r => ({
      id: r.id,
      customerName: r.customer_name,
      campaignCode: r.campaign_code,
      createdAt: r.created_at,
      type: r.photo_type,
      orderId: r.order_id,
      productId: r.product_id,
      itemName: r.item_name ?? undefined,
      itemQty: r.item_qty ?? undefined,
    }));

    for (const s of shipments) {
      const label = s.carrierName ?? s.pickupName ?? "Envio";
      for (let i = 0; i < (s.receiptPhotoUrls ?? []).length; i++) {
        entries.push({
          id: `${s.id}-receipt-${i}`,
          customerName: label,
          campaignCode: `${s.orderIds.length} ped.`,
          createdAt: s.shippingDate,
          type: "receipt",
          photoUrl: s.receiptPhotoUrls![i],
        });
      }
    }

    const seen = new Set<string>();
    return entries
      .filter(e => !seen.has(e.id) && !!seen.add(e.id))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [metaRows, shipments]);

  const campaigns = useMemo(
    () => [...new Set(metaRows.map(r => r.campaign_code))].sort(),
    [metaRows]
  );

  const filtered = useMemo(() => allEntries.filter(p => {
    if (filterType !== "all" && p.type !== filterType) return false;
    if (filterCampaign !== "all" && p.type !== "receipt" && p.campaignCode !== filterCampaign) return false;
    if (filterCustomer && !p.customerName.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
    return true;
  }), [allEntries, filterCampaign, filterCustomer, filterType]);

  const hasMore = metaRows.length < total;

  if (!profileLoaded || loadingMeta) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Galeria de Pedidos</h1>
        <p className="text-slate-500 text-sm">
          Fotos de pedidos finalizados e comprovantes de envio.
          {total > 0 && <span className="ml-1 text-slate-600">({total} registros no total)</span>}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
        <Input
          placeholder="Buscar cliente / transportadora..."
          value={filterCustomer}
          onChange={e => setFilterCustomer(e.target.value)}
          className="w-full sm:w-72 h-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
        <Select value={filterCampaign} onValueChange={v => setFilterCampaign(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-56 h-10 bg-slate-900 border-slate-700 text-slate-200">
            <span className="flex-1 text-left text-sm truncate">
              {filterCampaign === "all" ? "Todas as campanhas" : filterCampaign}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-full sm:w-52 h-10 bg-slate-900 border-slate-700 text-slate-200">
            <span className="flex-1 text-left text-sm truncate">
              {filterType === "all" ? "Todos os tipos"
                : filterType === "item" ? "Itens separados"
                : filterType === "packed" ? "Caixas embaladas"
                : "Comprovantes de envio"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="item">Itens separados</SelectItem>
            <SelectItem value="packed">Caixas embaladas</SelectItem>
            <SelectItem value="receipt">Comprovantes de envio</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-slate-500 text-sm">
          {filtered.length} foto{filtered.length !== 1 ? "s" : ""} encontradas
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          {allEntries.length === 0
            ? "Nenhuma foto registrada ainda."
            : "Nenhuma foto encontrada para os filtros selecionados."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(entry => (
            <PhotoCard
              key={entry.id}
              entry={entry}
              photoUrl={entry.type === "receipt" ? entry.photoUrl : photoUrls[entry.id]}
              onPreview={setPreviewUrl}
            />
          ))}
        </div>
      )}

      {/* Botão carregar mais */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </>
            ) : (
              `Carregar mais (${total - metaRows.length} restantes)`
            )}
          </button>
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
