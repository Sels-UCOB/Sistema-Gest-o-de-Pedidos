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
