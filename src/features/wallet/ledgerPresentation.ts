import type { TransactionType, TransactionTypeLike } from '@/types/wallet';

/** Known API ledger types get a specific Material Symbol. */
const ledgerTypeIcons: Record<TransactionType, string> = {
  'order-payment': 'shopping_bag',
  withdrawal: 'arrow_outward',
  transfer: 'swap_horiz',
  deposit: 'account_balance_wallet',
  refund: 'undo',
  adjustment: 'tune',
  'commitment-interest': 'trending_up',
  'cooperative-contribution': 'savings',
  'cooperative-help': 'volunteer_activism',
  'rank-earning': 'workspace_premium',
  // Deliberately not the `deposit` wallet icon: money that arrived because
  // somebody was treated is not money the therapist funded, and the two rows
  // sit next to each other in one statement.
  earning: 'medical_services',
  'loyalty-reserve': 'loyalty',
};

/**
 * Do not validate server values against a closed enum here. The API can add
 * ledger types independently, and unfamiliar types intentionally use the
 * generic receipt icon until the app learns a dedicated treatment.
 */
export function ledgerIconForType(type: TransactionTypeLike): string {
  return ledgerTypeIcons[type as TransactionType] ?? 'receipt_long';
}
