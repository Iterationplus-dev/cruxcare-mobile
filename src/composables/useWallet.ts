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
