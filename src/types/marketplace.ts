export interface ProductMedia {
  url: string;
  alt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  category: string;
  media: ProductMedia[];
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  /** Server-recalculated at every read/checkout — never summed client-side. */
  subtotal: number;
  currency: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled';

export interface OrderTimelineEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  reference: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: OrderStatus;
  placedById: string;
  onBehalfOfId: string | null;
  timeline: OrderTimelineEvent[];
  createdAt: string;
}

/** Server-quoted checkout preview — the only source of the resulting total/fees/balance. */
export interface CheckoutQuote {
  subtotal: number;
  fees: number;
  total: number;
  currency: string;
  /** Wallet balance after this order pays, computed server-side — never derived on the client. */
  walletBalanceAfter: number;
  expiresAt: string;
}
