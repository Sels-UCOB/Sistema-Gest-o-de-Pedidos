import Dexie, { type EntityTable } from "dexie";

export interface Product {
  id: string; // product code, e.g., "184523"
  name: string; // product name, e.g., "21 dias para mudar"
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  isSeparated: boolean;
  photoUrl?: string; // base64 string
}

export interface Order {
  id: string;
  customerName: string;
  campaignCode: string;
  destinationCity: string;
  responsible: string;
  status: "pending" | "separating" | "closed" | "shipped";
  items: OrderItem[];
  packedPhotoUrl?: string; // base64 string
  createdAt: number;
  shipmentId?: string;
}

export interface Shipment {
  id: string;
  type: "transportadora" | "presencial";
  carrierName?: string;
  carrierPhone?: string;
  shippingDate: number;
  estimatedArrival?: number;
  orderIds: string[];
  status: "pending" | "shipped";
  receiptPhotoUrls?: string[]; // base64 strings
  createdAt: number;
}

export const db = new Dexie("OrderManagementDB") as Dexie & {
  products: EntityTable<Product, "id">;
  orders: EntityTable<Order, "id">;
  shipments: EntityTable<Shipment, "id">;
};

db.version(1).stores({
  products: "id, name",
  orders: "id, customerName, status, createdAt, shipmentId",
  shipments: "id, type, status, createdAt",
});
