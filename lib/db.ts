import Dexie, { type EntityTable } from "dexie";

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
