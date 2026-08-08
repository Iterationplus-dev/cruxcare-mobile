import axios, { type InternalAxiosRequestConfig } from 'axios';
import { ApiError, type ApiErrorBody } from '@/types/api';

/**
 * Auth wiring is done via setters instead of importing the Pinia auth store
 * directly, to avoid a client.ts <-> stores/auth.ts import cycle (the store
 * itself calls into this client).
 */
let getAuthToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function setAuthTokenGetter(fn: () => string | null) {
  getAuthToken = fn;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, { message: 'Network error. Check your connection.' }));
    }
    const { status, data } = error.response;
    if (status === 401) onUnauthorized();
    const body: ApiErrorBody = data?.message
      ? data
      : { message: 'Something went wrong. Please try again.' };
    return Promise.reject(new ApiError(status, body));
  },
);

/** Attach to money-write requests so a retry after a dropped response never double-submits. */
export function idempotencyHeader(key: string) {
  return { headers: { 'Idempotency-Key': key } };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
