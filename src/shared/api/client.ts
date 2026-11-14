import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiEnvelope, ApiError, Paged } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_KEY = 'issiqlik.access';
const REFRESH_KEY = 'issiqlik.refresh';

export const tokenStore = {
  access: (): string | null => localStorage.getItem(ACCESS_KEY),
  refresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * ⚠️⚠️ BIR VAQTDA BITTA YANGILASH.
 *
 * Dashboard ochilganda 6–8 ta so'rov PARALLEL ketadi. Token muddati
 * tugagan bo'lsa, hammasi 401 oladi va har biri alohida `refresh`
 * yuborardi. Refresh esa ROTATSIYALI (server eski tokenni darhol
 * bekor qiladi): birinchisi yangi juftlik olardi, qolgan yettitasi
 * «token bekor qilingan» xatosini olib, foydalanuvchini tizimdan
 * chiqarib yuborardi — aynan tizim to'g'ri ishlayotgan paytda.
 *
 * Shuning uchun birinchi 401 yangilashni BOSHLAYDI, qolganlari esa
 * SHU VA'DANI kutadi.
 */
let refreshPromise: Promise<string> | null = null;

/** Sessiya tugaganda chaqiriladi — `providers.tsx` da ulanadi. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

async function refreshTokens(): Promise<string> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) throw new Error('Refresh token yo‘q');

  /*
   * ⚠️ `axios.post`, `http.post` EMAS: `http` ning interceptor'i
   * MUDDATI TUGAGAN access tokenni qo'shib yuborardi va yangilash
   * so'rovi ham 401 olardi — ya'ni cheksiz sikl.
   */
  const { data } = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  tokenStore.set(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const isAuthRoute =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthRoute &&
      tokenStore.refresh()
    ) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise ?? refreshTokens();
        const token = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      } catch {
        refreshPromise = null;
        tokenStore.clear();
        onSessionExpired?.();
      }
    }

    return Promise.reject(error);
  },
);

/**
 * XATO MATNI — foydalanuvchiga ko'rsatish uchun.
 *
 * ⚠️ `error.message` XOM holda ko'rsatilmaydi: u «Request failed with
 * status code 409» bo'lib chiqadi va operatorga hech narsa demaydi.
 * Serverdan kelgan o'zbekcha xabar har doim afzal.
 */
export function errorMessage(error: unknown, fallback = 'Xatolik yuz berdi'): string {
  if (axios.isAxiosError<ApiError>(error)) {
    const serverMessage = error.response?.data?.error?.message;
    if (serverMessage) return serverMessage;
    if (error.code === 'ECONNABORTED') return 'So‘rov vaqti tugadi';
    if (!error.response) return 'Serverga ulanib bo‘lmadi';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ───────────────── Konvertdan chiqarish ─────────────────

/**
 * ⚠️ Konvert BIR joyda ochiladi. Har chaqiruv joyi `res.data.data`
 * yozsa, bitta unutilgan joy `undefined` qaytarib, komponent
 * «ma'lumot yo'q» holatida qotib qolardi.
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<ApiEnvelope<T>>(url, config);
  return data.data;
}

/** Sahifalangan ro'yxat: `meta` konvertning TASHQARISIDA keladi. */
export async function getPaged<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Paged<T>> {
  const { data } = await http.get<ApiEnvelope<T[]>>(url, config);
  return {
    items: data.data,
    meta: data.meta ?? {
      page: 1,
      limit: data.data.length,
      total: data.data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await http.post<ApiEnvelope<T>>(url, body, config);
  return data?.data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.patch<ApiEnvelope<T>>(url, body);
  return data.data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.put<ApiEnvelope<T>>(url, body);
  return data.data;
}

export async function del(url: string): Promise<void> {
  await http.delete(url);
}

/**
 * FAYL YUKLAB OLISH (Excel).
 *
 * ⚠️ `window.open` ishlatilmaydi: u `Authorization` sarlavhasini
 * yubormaydi va server 401 qaytarardi. Fayl `blob` sifatida olinadi
 * va vaqtinchalik havola orqali saqlanadi.
 */
export async function download(
  url: string,
  fallbackName: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  const response = await http.get(url, { ...config, responseType: 'blob' });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const href = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // ⚠️ Havola BO'SHATILADI: usiz blob brauzer xotirasida sahifa
  // yopilguncha qolib ketadi va bir necha eksportdan keyin
  // o'nlab megabaytni egallaydi.
  URL.revokeObjectURL(href);
}
