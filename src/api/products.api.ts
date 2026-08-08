import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { Product } from '@/types/marketplace';

export interface ProductQuery {
  search?: string;
  category?: string;
  sort?: 'price-asc' | 'price-desc' | 'popular';
  cursor?: string;
}

export const productsApi = {
  async list(query: ProductQuery = {}): Promise<CursorPage<Product>> {
    const { data } = await apiClient.get<CursorPage<Product>>('/products', { params: query });
    return data;
  },

  async get(id: string): Promise<Product> {
    const { data } = await apiClient.get<Product>(`/products/${id}`);
    return data;
  },
};
