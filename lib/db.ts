import type { PlacedBox } from "@/app/(main)/fiorino/viewer";

export type { PlacedBox };

export interface FiorinoPlan {
  id: string;
  date: string;
  campo: string | null;
  campaignCode: string | null;
  type: string;
  notes: string | null;
  boxes: PlacedBox[];
  occupancyPct: number;
  boxCount: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  isSeparated: boolean;
  photoUrl?: string;
}

export interface Order {
  id: string;
  customerName: string;
  campaignCode: string;
  destinationCity: string;
  responsible: string;
  status: "pending" | "separating" | "closed" | "shipped";
  items: OrderItem[];
  packedPhotoUrl?: string;
  createdAt: number;
  shipmentId?: string;
}

export interface Shipment {
  id: string;
  type: "transportadora" | "presencial";
  carrierName?: string;
  carrierPhone?: string;
  shippingDate: number;
  pickupName?: string;
  orderIds: string[];
  status: "pending" | "shipped";
  receiptPhotoUrls?: string[];
  createdAt: number;
}
