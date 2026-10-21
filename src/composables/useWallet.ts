import { useQuery } from '@tanstack/vue-query';
import { walletApi } from '@/api/wallet.api';

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
  });
}

export function useLedger() {
  return useQuery({
    queryKey: ['wallet', 'ledger'],
    queryFn: () => walletApi.ledger(),
  });
}

/**
 * A therapist's earnings, per client payment.
 *
 * Its own key rather than a slice of `['wallet']`: paying out changes both, but
 * an earning accruing changes this and the wallet's pending figure without
 * touching anything else the wallet screen shows.
 */
export function useTherapistEarnings() {
  return useQuery({
    queryKey: ['therapist', 'earnings'],
    queryFn: () => walletApi.earnings(),
  });
}
