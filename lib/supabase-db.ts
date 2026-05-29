import { supabase } from "./supabase";
import type { Product, Order, OrderItem, Shipment, FiorinoPlan } from "./db";
import type { CampoId } from "./campos";

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function upsertProducts(products: Product[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < products.length; i += CHUNK) {
    const { error } = await supabase
      .from("products")
      .upsert(products.slice(i, i + CHUNK), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function upsertProduct(product: Product): Promise<void> {
  const { error } = await supabase.from("products").upsert(product, { onConflict: "id" });
  if (error) throw error;
}

export async function updateProduct(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("products").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error: invError } = await supabase.from("inventory").delete().eq("product_id", id);
  if (invError) throw invError;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function clearProducts(): Promise<void> {
  const { error: invError } = await supabase.from("inventory").delete().neq("product_id", "");
  if (invError) throw invError;
  const { error } = await supabase.from("products").delete().neq("id", "");
  if (error) throw error;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    customerName: row.customer_name as string,
    campaignCode: (row.campaign_code as string) ?? "",
    destinationCity: row.destination_city as string,
    responsible: row.responsible as string,
    status: row.status as Order["status"],
    tipo: ((row.tipo as string) === "acerto" ? "acerto" : "envio"),
    items: (row.items as OrderItem[]) ?? [],
    packedPhotoUrl: (row.packed_photo_url as string) ?? undefined,
    createdAt: row.created_at as number,
    shipmentId: (row.shipment_id as string) ?? undefined,
  };
}

function mapOrderSlim(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    customerName: row.customer_name as string,
    campaignCode: (row.campaign_code as string) ?? "",
    destinationCity: row.destination_city as string,
    responsible: row.responsible as string,
    status: row.status as Order["status"],
    tipo: ((row.tipo as string) === "acerto" ? "acerto" : "envio"),
    items: ((row.items as OrderItem[]) ?? []).map(it => ({ ...it, photoUrl: undefined })),
    createdAt: row.created_at as number,
    shipmentId: (row.shipment_id as string) ?? undefined,
  };
}

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase.rpc("get_orders_slim");
  if (error) throw error;
  return (data ?? []).map(mapOrderSlim);
}

const SLIM_COLS = "id, customer_name, campaign_code, destination_city, responsible, status, tipo, items, created_at, shipment_id";

export async function getClosedOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(SLIM_COLS)
    .eq("status", "closed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapOrderSlim);
}

export async function getOrdersPaged(page: number, pageSize = 25): Promise<{ orders: Order[]; hasMore: boolean }> {
  const from = page * pageSize;
  const { data, error } = await supabase
    .from("orders")
    .select(SLIM_COLS)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > pageSize;
  return { orders: rows.slice(0, pageSize).map(mapOrderSlim), hasMore };
}

export async function getOrderFull(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapOrder(data);
}

export async function addOrder(order: Omit<Order, "id" | "createdAt">): Promise<Order> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id: session.user.id,
      customer_name: order.customerName,
      campaign_code: order.campaignCode,
      destination_city: order.destinationCity,
      responsible: order.responsible,
      status: order.status,
      tipo: order.tipo ?? "envio",
      items: order.items,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapOrder(data);
}

export async function deleteOrder(id: string): Promise<void> {
  const { error, count } = await supabase
    .from("orders")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if ((count ?? 0) === 0) throw new Error("Pedido não encontrado ou sem permissão para excluir.");
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.items !== undefined) row.items = updates.items;
  if (updates.packedPhotoUrl !== undefined) row.packed_photo_url = updates.packedPhotoUrl;
  if (updates.shipmentId !== undefined) row.shipment_id = updates.shipmentId;
  if (updates.customerName !== undefined) row.customer_name = updates.customerName;
  if (updates.campaignCode !== undefined) row.campaign_code = updates.campaignCode;
  if (updates.destinationCity !== undefined) row.destination_city = updates.destinationCity;
  if (updates.tipo !== undefined) row.tipo = updates.tipo;

  const { error } = await supabase.from("orders").update(row).eq("id", id);
  if (error) throw error;
}

export interface GalleryMetaRow {
  id: string;
  customer_name: string;
  campaign_code: string;
  created_at: number;
  photo_type: "item" | "packed";
  order_id: string;
  product_id: string | null;
  item_name: string | null;
  item_qty: number | null;
}

export async function getGalleryMetadata(): Promise<GalleryMetaRow[]> {
  const { data, error } = await supabase.rpc("get_gallery_metadata");
  if (error) throw error;
  return (data ?? []) as GalleryMetaRow[];
}

export async function getSinglePhoto(orderId: string, photoType: string, productId?: string | null): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_single_photo", {
    p_order_id: orderId,
    p_photo_type: photoType,
    p_product_id: productId ?? null,
  });
  if (error) throw error;
  return data as string | null;
}

// ─── Shipments ───────────────────────────────────────────────────────────────

function mapShipment(row: Record<string, unknown>): Shipment {
  return {
    id: row.id as string,
    type: row.type as Shipment["type"],
    carrierName: (row.carrier_name as string) ?? undefined,
    carrierPhone: (row.carrier_phone as string) ?? undefined,
    shippingDate: row.shipping_date as number,
    pickupName: (row.pickup_name as string) ?? undefined,
    orderIds: (row.order_ids as string[]) ?? [],
    status: row.status as Shipment["status"],
    receiptPhotoUrls: (row.receipt_photo_urls as string[]) ?? [],
    createdAt: row.created_at as number,
  };
}

export async function getShipments(): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapShipment);
}

export async function addShipment(shipment: Omit<Shipment, "id" | "createdAt">): Promise<Shipment> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      user_id: session.user.id,
      type: shipment.type,
      carrier_name: shipment.carrierName ?? null,
      carrier_phone: shipment.carrierPhone ?? null,
      shipping_date: shipment.shippingDate,
      pickup_name: shipment.pickupName ?? null,
      order_ids: shipment.orderIds,
      status: shipment.status,
      receipt_photo_urls: shipment.receiptPhotoUrls ?? [],
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapShipment(data);
}

export async function updateShipment(id: string, updates: {
  type?: Shipment["type"];
  carrierName?: string | null;
  carrierPhone?: string | null;
  shippingDate?: number;
  pickupName?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.carrierName !== undefined) row.carrier_name = updates.carrierName ?? null;
  if (updates.carrierPhone !== undefined) row.carrier_phone = updates.carrierPhone ?? null;
  if (updates.shippingDate !== undefined) row.shipping_date = updates.shippingDate;
  if (updates.pickupName !== undefined) row.pickup_name = updates.pickupName ?? null;
  const { error } = await supabase.from("shipments").update(row).eq("id", id);
  if (error) throw error;
}

export async function appendReceiptPhoto(id: string, photoUrl: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("shipments")
    .select("receipt_photo_urls")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  const existing = (data?.receipt_photo_urls as string[]) ?? [];
  const { error } = await supabase
    .from("shipments")
    .update({ receipt_photo_urls: [...existing, photoUrl], status: "shipped" })
    .eq("id", id);
  if (error) throw error;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryRow {
  product_id: string;
  warehouse_id: string;
  quantity: number;
}

export async function getInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, warehouse_id, quantity");
  if (error) throw error;
  return data ?? [];
}

export async function addInventoryStock(productId: string, warehouseId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc("add_inventory", {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
  });
  if (error) throw error;
}

export async function bulkSetInventory(rows: InventoryRow[]): Promise<void> {
  const { error } = await supabase.rpc("bulk_set_inventory", { rows });
  if (error) throw error;
}

export async function deductInventoryStock(items: OrderItem[], warehouseId: string): Promise<void> {
  for (const item of items) {
    if (item.productId.startsWith("unknown-")) continue;
    const { error } = await supabase.rpc("deduct_inventory", {
      p_product_id: item.productId,
      p_warehouse_id: warehouseId,
      p_quantity: item.quantity,
    });
    if (error) throw error;
  }
}

// ─── Profiles (admin) ────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "operator";
  campo: CampoId | null;
  has_fiorino: boolean;
}

export async function getProfiles(): Promise<ProfileRow[]> {
  // RPC traz email (de auth.users) mas foi criado antes de has_fiorino existir.
  // Buscamos has_fiorino direto de profiles em paralelo e mesclamos.
  const [rpcRes, colsRes] = await Promise.all([
    supabase.rpc("get_profiles_with_email"),
    supabase.from("profiles").select("id, has_fiorino"),
  ]);
  if (rpcRes.error) throw rpcRes.error;

  const fiorinoMap: Record<string, boolean> = Object.fromEntries(
    (colsRes.data ?? []).map((r: { id: string; has_fiorino: boolean }) => [r.id, r.has_fiorino ?? false])
  );

  return (rpcRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    full_name: row.full_name as string | null,
    email: row.email as string | null,
    role: (row.role ?? "operator") as "admin" | "operator",
    campo: (row.campo ?? null) as CampoId | null,
    has_fiorino: fiorinoMap[row.id as string] ?? false,
  }));
}

export async function updateProfile(id: string, updates: Partial<Pick<ProfileRow, "role" | "campo" | "has_fiorino">>): Promise<void> {
  const { error } = await supabase.from("profiles").update(updates).eq("id", id);
  if (error) throw error;
}

// ─── Storage: Photo Cleanup ──────────────────────────────────────────────────

function urlToStoragePath(url: string): string | null {
  const marker = "/order-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function deleteOrderPhotos(photoUrls: string[]): Promise<void> {
  const paths = photoUrls.map(urlToStoragePath).filter(Boolean) as string[];
  if (paths.length === 0) return;
  await supabase.storage.from("order-photos").remove(paths);
}

export async function deleteOrderAllPhotos(orderId: string): Promise<void> {
  const { data } = await supabase.storage.from("order-photos").list(`orders/${orderId}`);
  if (!data || data.length === 0) return;
  const paths = data.map(f => `orders/${orderId}/${f.name}`);
  await supabase.storage.from("order-photos").remove(paths);
}

// ─── Storage: Photo Upload ───────────────────────────────────────────────────

/**
 * Faz upload de uma foto de item/caixa para o Supabase Storage.
 * Retorna a URL pública (curta) da imagem — nunca base64.
 */
export async function uploadOrderPhoto(
  file: File,
  orderId: string,
  type: "item" | "packed",
  productId?: string | null
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const seg = productId ? `-${productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}` : "";
  const path = `orders/${orderId}/${type}${seg}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("order-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("order-photos").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Faz upload de um comprovante de envio para o Supabase Storage.
 * Retorna a URL pública da imagem.
 */
export async function uploadReceiptPhoto(file: File, shipmentId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `receipts/${shipmentId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("order-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("order-photos").getPublicUrl(path);
  return data.publicUrl;
}

// ─── Fiorino Plans ────────────────────────────────────────────────────────────

function mapFiorinoPlan(row: Record<string, unknown>): FiorinoPlan {
  return {
    id: row.id as string,
    date: row.date as string,
    campo: (row.campo as string | null) ?? null,
    campaignCode: (row.campaign_code as string | null) ?? null,
    type: row.type as string,
    notes: (row.notes as string | null) ?? null,
    boxes: (row.boxes as FiorinoPlan["boxes"]) ?? [],
    occupancyPct: (row.occupancy_pct as number) ?? 0,
    boxCount: (row.box_count as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

export async function getFiorinoPlans(): Promise<FiorinoPlan[]> {
  const { data, error } = await supabase
    .from("fiorino_plans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFiorinoPlan);
}

const MAX_FIORINO_PLANS = 5;

export async function addFiorinoPlan(plan: Omit<FiorinoPlan, "id" | "createdAt">): Promise<FiorinoPlan> {
  const { data: { session } } = await supabase.auth.getSession();

  // Enforce cap: delete oldest plans so total stays at MAX_FIORINO_PLANS after insert
  const { data: existing } = await supabase
    .from("fiorino_plans")
    .select("id")
    .order("created_at", { ascending: true });

  if (existing && existing.length >= MAX_FIORINO_PLANS) {
    const overflow = existing.slice(0, existing.length - MAX_FIORINO_PLANS + 1);
    const ids = overflow.map((r: { id: string }) => r.id);
    await supabase.from("fiorino_plans").delete().in("id", ids);
  }

  const { data, error } = await supabase
    .from("fiorino_plans")
    .insert({
      date: plan.date,
      campo: plan.campo ?? null,
      campaign_code: plan.campaignCode ?? null,
      type: plan.type,
      notes: plan.notes ?? null,
      boxes: plan.boxes,
      occupancy_pct: plan.occupancyPct,
      box_count: plan.boxCount,
      created_by: session?.user.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapFiorinoPlan(data);
}

export async function deleteFiorinoPlan(id: string): Promise<void> {
  const { error } = await supabase.from("fiorino_plans").delete().eq("id", id);
  if (error) throw error;
}
