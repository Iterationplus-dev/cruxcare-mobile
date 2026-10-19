export interface ProductMedia {
  url: string;
  alt: string;
}

export interface Product {
  id: string;
  name: string;
  /** Product copy is optional in the API; the UI renders a neutral empty state. */
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  category: string;
  media: ProductMedia[];
  /**
   * C2's collapsible sections. Optional because the API carries neither yet —
   * `products.details` exists and is empty on all 21 rows — so the sections
   * render as "not listed" until something fills them.
   */
  howToUse?: string | null;
  ingredients?: string | null;
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

/** How an order can be paid. An order is placed only once it is paid for. */
export type CheckoutPaymentMethod = 'wallet' | 'card';

/** Server-quoted checkout preview — the only source of the resulting total/fees/balance. */
export interface CheckoutQuote {
  /** The `subject` of a card payment intent. A new quote replaces the old one,
   *  so a card payment always starts from the latest quote's id. */
  quoteId: string;
  subtotal: number;
  fees: number;
  total: number;
  currency: string;
  /** Wallet balance after this order pays, computed server-side — never derived
   *  on the client. Negative is the shortfall. */
  walletBalanceAfter: number;
  /** False means a wallet order would be refused with `insufficient_funds`. */
  walletSufficient: boolean;
  /** The options to offer, in the order to show them. */
  paymentMethods: CheckoutPaymentMethod[];
  expiresAt: string;
}
