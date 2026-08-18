import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ApiError, type ApiErrorBody } from '@/types/api';

/**
 * Auth wiring is done via setters instead of importing the Pinia auth store
 * directly, to avoid a client.ts <-> stores/auth.ts import cycle (the store
 * itself calls into this client).
 */
let getAuthToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/**
 * Laravel currently emits a PHP deprecation notice before some JSON payloads
 * in local development. Axios leaves those as strings despite the JSON
 * content type. Capacitor's native HTTP bridge can additionally wrap that
 * string as a JSON string. Recover only a complete trailing JSON document;
 * all other response bodies remain untouched and surface through the normal
 * error path.
 */
export function recoverJsonResponse(data: unknown, contentType?: string): unknown {
  if (typeof data !== 'string' || !contentType?.toLowerCase().includes('application/json')) return data;

  const body = data.trim();
  let document = body;

  try {
    const parsed = JSON.parse(body);
    if (typeof parsed !== 'string') return parsed;
    document = parsed.trim();
  } catch {
    // The PHP warning was not itself valid JSON; look for the response body.
  }

  const objectStart = document.indexOf('{');
  const arrayStart = document.indexOf('[');
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (!starts.length) return data;

  try {
    return JSON.parse(document.slice(Math.min(...starts)));
  } catch {
    return data;
  }
}

export function setAuthTokenGetter(fn: () => string | null) {
  getAuthToken = fn;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/**
 * Capacitor's browser-style XHR bridge still applies browser forbidden-header
 * rules. The local Laravel site is a name-based virtual host, so Android must
 * send `Host: cci.test` while connecting through 10.0.2.2. The direct native
 * API permits that header and also avoids WebView CORS restrictions.
 */
interface NativeFormDataEntry {
  key: string;
  value: string;
  type: 'base64File' | 'string';
  contentType?: string;
  fileName?: string;
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read upload'));
    reader.readAsDataURL(blob);
  });
}

async function serializeNativeFormData(formData: FormData): Promise<NativeFormDataEntry[]> {
  const values: Array<[string, FormDataEntryValue]> = [];
  formData.forEach((value, key) => values.push([key, value]));

  return Promise.all(
    values.map(async ([key, value]) => {
      if (typeof value === 'string') return { key, value, type: 'string' as const };

      return {
        key,
        value: await readBlobAsBase64(value),
        type: 'base64File' as const,
        contentType: value.type || 'application/octet-stream',
        fileName: value.name || 'upload',
      };
    }),
  );
}

const nativeHttpAdapter: AxiosAdapter = async (config) => {
  const headers = AxiosHeaders.from(config.headers);
  const timeout = typeof config.timeout === 'number' && config.timeout > 0 ? config.timeout : undefined;
  let requestData = config.data;
  let dataType: 'formData' | undefined;

  // CapacitorHttp's direct native bridge only accepts JSON values. Convert
  // multipart uploads to its documented base64 file-entry format instead.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    requestData = await serializeNativeFormData(config.data);
    dataType = 'formData';
    headers.set('Content-Type', 'multipart/form-data');
  }

  const response = await CapacitorHttp.request({
    url: axios.getUri(config),
    method: (config.method ?? 'get').toUpperCase(),
    headers: Object.fromEntries(
      Object.entries(headers.toJSON()).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)]),
    ),
    data: requestData,
    ...(dataType ? { dataType } : {}),
    connectTimeout: timeout,
    readTimeout: timeout,
  });

  const axiosResponse: AxiosResponse = {
    data: response.data,
    status: response.status,
    statusText: '',
    headers: AxiosHeaders.from(response.headers),
    config,
    request: null,
  };

  if (!config.validateStatus || config.validateStatus(response.status)) {
    return axiosResponse;
  }

  throw new AxiosError(
    `Request failed with status code ${response.status}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    null,
    axiosResponse,
  );
};

function contentTypeFromHeaders(headers: unknown): string | undefined {
  if (headers instanceof AxiosHeaders) {
    const contentType = headers.get('content-type');
    return typeof contentType === 'string' ? contentType : undefined;
  }
  if (typeof headers === 'object' && headers !== null) {
    const values = headers as Record<string, unknown>;
    const contentType = values['content-type'] ?? values['Content-Type'];
    return typeof contentType === 'string' ? contentType : undefined;
  }
  return undefined;
}

function errorBodyFrom(data: unknown): ApiErrorBody {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as { message: unknown }).message === 'string'
  ) {
    return data as ApiErrorBody;
  }
  return { message: 'Something went wrong. Please try again.' };
}

const configuredApiHostHeader = import.meta.env.VITE_API_HOST_HEADER;
const apiHostHeader =
  typeof configuredApiHostHeader === 'string' && configuredApiHostHeader
    ? configuredApiHostHeader
    : undefined;
const useApiMocks = import.meta.env.VITE_USE_API_MOCKS === 'true';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  // CapacitorHttp bypasses the WebView, and therefore MSW. Mocked native
  // builds must stay on the browser transport so the service worker handles
  // the request; real API builds retain the native adapter and Host support.
  adapter: Capacitor.isNativePlatform() && !useApiMocks ? nativeHttpAdapter : undefined,
  headers: {
    Accept: 'application/json',
    ...(apiHostHeader ? { Host: apiHostHeader } : {}),
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    response.data = recoverJsonResponse(response.data, contentTypeFromHeaders(response.headers));
    return response;
  },
  (error) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, { message: 'Network error. Check your connection.' }));
    }
    const { status } = error.response;
    const data = recoverJsonResponse(error.response.data, contentTypeFromHeaders(error.response.headers));
    if (status === 401) onUnauthorized();
    const body = errorBodyFrom(data);
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
