import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { get, setSessionExpiredHandler, tokenStore } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type { AuthUser } from '@/shared/api/types';
import { useAuthStore } from '@/store/auth.store';

/**
 * ⚠️ `QueryClient` komponent TASHQARISIDA yaratiladi. Ichida bo'lsa,
 * har qayta chizishda yangi mijoz tug'ilib, butun kesh tashlanardi
 * va sahifa doimiy «yuklanmoqda» holatida turardi.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /*
       * ⚠️ 30 soniya «yangi» hisoblanadi. Telemetriya doimiy oqadi,
       * lekin agregatlar (tumanlar bo'yicha sanoq) har soniyada
       * o'zgarmaydi. Bundan tashqari haqiqiy yangilanish WebSocket
       * orqali keladi (`useRealtime`) — bu yerdagi qiymat shunchaki
       * zaxira qavat.
       */
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      /*
       * ⚠️ 4xx xatolarida QAYTA URINILMAYDI. «Ruxsat yetarli emas»
       * yoki «topilmadi» uch marta takrorlanganda ham o'zgarmaydi,
       * faqat serverga ortiqcha yuk va foydalanuvchiga uch baravar
       * uzoq kutish qo'shilardi.
       */
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>{children}</SessionBootstrap>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--surface)',
            color: 'var(--ink-strong)',
            fontSize: '13px',
            borderRadius: '11px',
            boxShadow: 'var(--shadow-pop)',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#118a56', secondary: '#fff' } },
          error: { iconTheme: { primary: '#c8362c', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}

/**
 * SESSIYANI TIKLASH.
 *
 * ⚠️⚠️ Sahifa yangilanganda foydalanuvchi tokeni localStorage'da
 * qoladi, lekin `user` holati BO'SH bo'ladi. Shu tekshiruvsiz
 * marshrut qo'riqchisi uni «kirmagan» deb bilib, F5 bosilgan har
 * safar login sahifasiga uloqtirardi.
 *
 * ⚠️ `ready` bayrog'i ham shu sababli: tekshiruv tugamaguncha hech
 * narsa chizilmaydi, aks holda login sahifasi bir lahza «miltillab»
 * o'tardi.
 */
function SessionBootstrap({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      queryClient.clear();
    });
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;

    const restore = async (): Promise<void> => {
      if (!tokenStore.access()) {
        if (!cancelled) {
          setUser(null);
          setChecked(true);
        }
        return;
      }
      try {
        const user = await get<AuthUser>(API.auth.me);
        if (!cancelled) setUser(user);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  if (!checked) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--canvas)]">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-meta text-muted">Yuklanmoqda…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
