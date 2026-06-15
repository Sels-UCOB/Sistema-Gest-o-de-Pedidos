"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Order, Shipment } from "@/lib/db";
import { getOrders, getShipments, getCampanhas, CampanhaDef } from "@/lib/supabase-db";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageNav } from "@/components/ui/page-nav";
import { Printer, Camera, X } from "lucide-react";
import { format, subDays } from "date-fns";
import type { CampoId } from "@/lib/campos";
import { useUserRole } from "@/lib/user-context";

const PAGE_SIZE = 15;
const default30 = () => format(subDays(new Date(), 30), "yyyy-MM-dd");

interface ReportRow {
  order: Order;
  shipment: Shipment;
}

export default function ReportsPage() {
  const { profileLoaded, refreshTick } = useUserRole();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(default30);
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [campoFilter, setCampoFilter] = useState("ALL");
  const [responsibleFilter, setResponsibleFilter] = useState("ALL");
  const [tipoFilter, setTipoFilter] = useState<"ALL" | "envio" | "acerto">("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewPhotos, setPreviewPhotos] = useState<string[] | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s, camp] = await Promise.all([getOrders(), getShipments(), getCampanhas()]);
      setOrders(o);
      setShipments(s);
      setCampanhas(camp);
    } catch {
      alert("Erro ao carregar relatórios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!profileLoaded) return; load(); }, [load, profileLoaded, refreshTick]);

  const shipmentMap = useMemo(() => new Map(shipments.map(s => [s.id, s])), [shipments]);

  const rows = useMemo((): ReportRow[] => {
    return orders
      .filter(o => o.shipmentId && shipmentMap.has(o.shipmentId))
      .map(o => ({ order: o, shipment: shipmentMap.get(o.shipmentId!)! }))
      .filter(({ shipment, order }) => {
        const d = shipment.shippingDate;
        if (startDate && d < new Date(startDate + "T00:00:00").getTime()) return false;
        if (endDate && d > new Date(endDate + "T23:59:59").getTime()) return false;
        if (campoFilter !== "ALL" && campanhas.find(c => c.code === order.campaignCode)?.campo !== (campoFilter as CampoId)) return false;
        if (responsibleFilter !== "ALL" && order.responsible !== responsibleFilter) return false;
        if (tipoFilter !== "ALL" && order.tipo !== tipoFilter) return false;
        return true;
      })
      .sort((a, b) => b.shipment.shippingDate - a.shipment.shippingDate);
  }, [orders, shipmentMap, campanhas, startDate, endDate, campoFilter, responsibleFilter, tipoFilter]);

  // reset página ao mudar filtros
  const prevFilters = useMemo(() => ({ startDate, endDate, campoFilter, responsibleFilter, tipoFilter }),
    [startDate, endDate, campoFilter, responsibleFilter, tipoFilter]);
  useEffect(() => { setPage(0); }, [prevFilters]);

  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rows, page]
  );

  const responsibles = useMemo(() => {
    const names = orders
      .filter(o => o.shipmentId && shipmentMap.has(o.shipmentId))
      .map(o => o.responsible)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [orders, shipmentMap]);

  const allSelected = rows.length > 0 && rows.every(r => selectedIds.includes(r.order.id));
  const someSelected = selectedIds.length > 0;

  const toggleRow = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : rows.map(r => r.order.id));

  const rowsToPrint = someSelected
    ? rows.filter(r => selectedIds.includes(r.order.id))
    : rows;

  const defaultEndDate = format(new Date(), "yyyy-MM-dd");
  const hasFilters = startDate !== default30() || endDate !== defaultEndDate || campoFilter !== "ALL" || responsibleFilter !== "ALL" || tipoFilter !== "ALL";

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const period =
      startDate || endDate
        ? `Período: ${startDate ? format(new Date(startDate + "T00:00:00"), "dd/MM/yyyy") : "—"} até ${endDate ? format(new Date(endDate + "T00:00:00"), "dd/MM/yyyy") : "—"}`
        : "Todos os registros";

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>Relatório de Pedidos — Sels UCOB</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 28px; background: white; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 12px; }
        .header h1 { font-size: 18px; font-weight: bold; color: #1e293b; }
        .header p { font-size: 10px; color: #64748b; margin-top: 3px; }
        .meta { text-align: right; }
        .meta strong { font-size: 22px; font-weight: bold; color: #1e293b; display: block; line-height: 1; }
        .meta span { font-size: 10px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e293b; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .bold { font-weight: 600; color: #1e293b; font-size: 12px; }
        .sub { font-size: 10px; color: #64748b; margin-top: 1px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
        .badge-trans   { background: #dbeafe; color: #1d4ed8; }
        .badge-pres    { background: #d1fae5; color: #065f46; }
        .badge-acerto  { background: #ede9fe; color: #5b21b6; }
        .photos { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .photos img { width: 60px; height: 60px; object-fit: cover; border: 1px solid #e2e8f0; border-radius: 4px; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        @media print { body { padding: 12px; } tr { page-break-inside: avoid; } }
      </style>
    </head><body>
      <div class="header">
        <div>
          <h1>Sels UCOB — Relatório de Pedidos</h1>
          <p>${period}</p>
          <p>Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        </div>
        <div class="meta">
          <strong>${rowsToPrint.length}</strong>
          <span>pedido(s)</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Cliente / Destino</th>
            <th>Materiais</th>
            <th>Envio</th>
            <th style="white-space:nowrap">Data</th>
            <th>Responsável</th>
            <th>Comprovante</th>
          </tr>
        </thead>
        <tbody>
          ${rowsToPrint.map(({ order, shipment }) => `
            <tr>
              <td>
                <div class="bold">${order.customerName}</div>
                <div class="sub">${order.destinationCity}</div>
                <div class="sub">Camp: ${order.campaignCode}</div>
              </td>
              <td>${order.items.map(it => `<div>${it.quantity}× ${it.name}</div>`).join("")}</td>
              <td>
                <span class="badge ${shipment.type === "transportadora" ? "badge-trans" : shipment.type === "acerto" ? "badge-acerto" : "badge-pres"}">
                  ${shipment.type === "transportadora" ? "Transportadora" : shipment.type === "acerto" ? "Acerto" : "Presencial"}
                </span>
                <div class="sub" style="margin-top:3px">${shipment.carrierName ?? shipment.pickupName ?? "—"}</div>
              </td>
              <td style="white-space:nowrap">${format(shipment.shippingDate, "dd/MM/yyyy")}</td>
              <td>${order.responsible}</td>
              <td>
                ${shipment.receiptPhotoUrls?.length
                  ? `<div class="photos">${shipment.receiptPhotoUrls.slice(0, 3).map(url => `<img src="${url}" />`).join("")}${shipment.receiptPhotoUrls.length > 3 ? `<div class="sub" style="align-self:center">+${shipment.receiptPhotoUrls.length - 3}</div>` : ""}</div>`
                  : '<span style="color:#94a3b8">—</span>'
                }
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">Sels UCOB — Sistema de Gestão de Pedidos</div>
    </body></html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.onafterprint = () => win.close(); win.print(); }, 500);
  };

  return (
    <div className="space-y-6">

      {/* Header + botão imprimir */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl tracking-tight text-white">Relatórios</h1>
          <p className="text-slate-500 text-sm mt-0.5">Histórico de pedidos enviados</p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={loading || rowsToPrint.length === 0}
          className="shrink-0 gap-2"
        >
          <Printer className="h-4 w-4" />
          {someSelected ? `Imprimir selecionados (${rowsToPrint.length})` : `Imprimir (${rowsToPrint.length})`}
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-400">De</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="appearance-none h-10" style={{ fontSize: 16 }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-400">Até</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="appearance-none h-10" style={{ fontSize: 16 }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-400">Campo</Label>
            <Select value={campoFilter} onValueChange={v => v !== null && setCampoFilter(v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="GO">Sede</SelectItem>
                <SelectItem value="MT">MT</SelectItem>
                <SelectItem value="MS">MS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-400">Responsável</Label>
            <Select value={responsibleFilter} onValueChange={v => v !== null && setResponsibleFilter(v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-400">Tipo</Label>
            <Select value={tipoFilter} onValueChange={v => setTipoFilter(v as typeof tipoFilter)}>
              <SelectTrigger className="h-10 text-sm">
                <span className="flex-1 text-left text-sm truncate">
                  {tipoFilter === "ALL" ? "Todos" : tipoFilter === "envio" ? "Envio" : "Acerto"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="envio">Envio</SelectItem>
                <SelectItem value="acerto">Acerto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={() => { setStartDate(default30()); setEndDate(format(new Date(), "yyyy-MM-dd")); setCampoFilter("ALL"); setResponsibleFilter("ALL"); setTipoFilter("ALL"); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Strip de resumo */}
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-slate-500">
          {loading ? "Carregando..." : (
            <>
              <span className="text-white font-medium">{rows.length}</span>
              {' '}registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
              {someSelected && (
                <> · <span className="text-indigo-400 font-medium">{selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''}</span></>
              )}
            </>
          )}
        </p>
        {rows.length > 0 && !loading && (
          <button onClick={toggleAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        )}
      </div>

      {/* Tabela */}
      <Card className="border-slate-800 bg-slate-900/50">

        {/* Desktop */}
        <CardContent className="p-0 overflow-x-auto hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-12 pl-5">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={rows.length === 0} />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Materiais</TableHead>
                <TableHead>Envio</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center pr-5">Comprovante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-slate-500 text-sm">Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-slate-500 text-sm">
                    Nenhum registro encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : pageRows.map(({ order, shipment }) => (
                <TableRow
                  key={order.id}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                    selectedIds.includes(order.id) ? "bg-indigo-500/10" : ""
                  }`}
                  onClick={() => toggleRow(order.id)}
                >
                  <TableCell className="pl-5" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleRow(order.id)} />
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-white text-sm leading-tight">{order.customerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{order.destinationCity}</p>
                    <p className="text-xs text-slate-600">Camp: {order.campaignCode}</p>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      {order.items.map((it, i) => (
                        <p key={i} className="text-slate-300"><span className="text-slate-500">{it.quantity}×</span> {it.name}</p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      shipment.type === "transportadora" ? "bg-blue-500/20 text-blue-300"
                      : shipment.type === "acerto"       ? "bg-violet-500/20 text-violet-300"
                                                         : "bg-emerald-500/20 text-emerald-300"
                    }`}>
                      {shipment.type === "transportadora" ? "Transportadora" : shipment.type === "acerto" ? "Acerto" : "Presencial"}
                    </span>
                    {(shipment.carrierName ?? shipment.pickupName) && (
                      <p className="text-xs text-slate-500 mt-1">{shipment.carrierName ?? shipment.pickupName}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300 whitespace-nowrap">
                    {format(shipment.shippingDate, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">{order.responsible}</TableCell>
                  <TableCell className="text-center pr-5" onClick={e => e.stopPropagation()}>
                    {shipment.receiptPhotoUrls?.length ? (
                      <button
                        onClick={() => setPreviewPhotos(shipment.receiptPhotoUrls!)}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{shipment.receiptPhotoUrls.length}</span>
                      </button>
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        {/* Mobile */}
        <CardContent className="p-4 flex flex-col gap-3 md:hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">Carregando...</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-sm">Nenhum registro encontrado.</p>
          ) : pageRows.map(({ order, shipment }) => (
            <div
              key={order.id}
              className={`p-4 rounded-xl border space-y-3 cursor-pointer transition-all ${
                selectedIds.includes(order.id)
                  ? "border-indigo-500/40 bg-indigo-500/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/30"
              }`}
              onClick={() => toggleRow(order.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Checkbox
                    checked={selectedIds.includes(order.id)}
                    onCheckedChange={() => toggleRow(order.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm leading-tight">{order.customerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{order.destinationCity} · Camp {order.campaignCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {shipment.receiptPhotoUrls?.length ? (
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewPhotos(shipment.receiptPhotoUrls!); }}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 p-1"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="text-xs">{shipment.receiptPhotoUrls.length}</span>
                    </button>
                  ) : null}
                  <span className="text-xs text-slate-500 whitespace-nowrap">{format(shipment.shippingDate, "dd/MM/yy")}</span>
                </div>
              </div>
              <div className="pl-7 space-y-0.5">
                {order.items.map((it, i) => (
                  <p key={i} className="text-xs text-slate-300"><span className="text-slate-500">{it.quantity}×</span> {it.name}</p>
                ))}
              </div>
              <div className="pl-7 flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  shipment.type === "transportadora" ? "bg-blue-500/20 text-blue-300"
                  : shipment.type === "acerto"       ? "bg-violet-500/20 text-violet-300"
                                                     : "bg-emerald-500/20 text-emerald-300"
                }`}>
                  {shipment.type === "transportadora" ? "Transportadora" : shipment.type === "acerto" ? "Acerto" : "Presencial"}
                </span>
                <span className="text-xs text-slate-500">{order.responsible}</span>
              </div>
            </div>
          ))}
        </CardContent>

        <PageNav
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          loading={loading}
        />
      </Card>

      {/* Modal de fotos */}
      {previewPhotos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewPhotos(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Comprovantes de Envio</h3>
              <button
                onClick={() => setPreviewPhotos(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto p-5">
              {previewPhotos.map((url, i) => (
                <img key={i} src={url} alt={`Comprovante ${i + 1}`} className="w-full rounded-xl border border-slate-800 object-contain" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
