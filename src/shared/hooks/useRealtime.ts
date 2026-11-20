import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { get, tokenStore } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type {
  AlertEvent,
  BoilerStatusEvent,
  IncidentRealtimeEvent,
  NotificationRealtimeEvent,
} from '@/shared/api/types';
import { useAuthStore } from '@/store/auth.store';
import { useRealtimeStore } from '@/store/realtime.store';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

/** Bir vaqtda ekranda ko'rinadigan kritik xabarlar soni. */
const MAX_TOASTS = 3;
/** To'da shu muddat ichida kelgan xabarlardan iborat deb hisoblanadi. */
const BURST_WINDOW_MS = 2500;

/**
 * JONLI YANGILANISH.
 *
 * ⚠️⚠️ Hodisa kelganda KESH BEKOR QILINADI, qo'lda YOZILMAYDI.
 * Hodisa yengil (id + holat), ekrandagi ma'lumot esa agregat
 * (tumanlar bo'yicha sanoq, o'rtacha harorat, diagramma). Ularni
 * qo'lda hisoblab qo'yish server hisoblaganidan ASTA-SEKIN ajralib
 * ketardi — ekranda 17 ta faol, serverda esa 19 ta.
 *
 * ⚠️ Bekor qilish TO'PLAB bajariladi (800 ms): bir vaqtda o'nlab
 * kotyol holati o'zgarishi mumkin (masalan tarmoq tiklanganda) va
 * har biri uchun alohida qayta so'rov yuborilsa, brauzer o'nlab
 * bir xil so'rovni ketma-ket yuborardi.
 */
export function useRealtime(): void {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Joriy to'dada nechta kritik xabar keldi. */
  const burst = useRef(0);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    /*
     * ⚠️⚠️ ULANISH BIR QADAM KECHIKTIRILADI (`setTimeout 0`).
     *
     * React `StrictMode` da effekt development'da IKKI marta ishga
     * tushadi: ulandi → darhol uzildi → yana ulandi. Birinchi soket
     * qo'l berishib (handshake) ulgurmasdan yopilgani uchun brauzer
     * HAR sahifa ochilishida konsolga «WebSocket is closed before the
     * connection is established» ogohlantirishini yozardi — va u
     * haqiqiy ulanish xatolari orasida chalg'itib turardi.
     *
     * Kechikish bilan birinchi urinish umuman BOSHLANMAYDI: tozalash
     * undan oldin ishlaydi va taymer bekor qilinadi.
     */
    let disposed = false;
    let socket: Socket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const starter = setTimeout(() => {
      if (disposed) return;
      socket = connect();
    }, 0);

    function connect(): Socket {
      const instance = io(`${SOCKET_URL}/realtime`, {
        transports: ['websocket'],
        query: user!.districtId ? { districtId: user!.districtId } : {},
        /*
         * ⚠️⚠️ TOKEN — FUNKSIYA, qiymat emas: socket.io uni HAR (qayta)
         * ulanishda chaqiradi. Qiymat bo'lsa, 30 daqiqadan keyin muddati
         * o'tgan token bilan qayta ulanib, XAVF xabarlari jimgina kelmay
         * qo'yardi. Server vakolatni tokendagi emas, BAZADAGI rol/tuman
         * bo'yicha beradi (`realtime.gateway.ts`).
         */
        auth: (cb: (data: Record<string, unknown>) => void) =>
          cb({ token: tokenStore.access() ?? '' }),
        // ⚠️ Avtomatik qayta ulanish — cheksiz, lekin ORTIB BORUVCHI
        // kechikish bilan: server qayta ishga tushayotganda o'nlab
        // mijoz bir vaqtda urinsa, u yana yiqilardi.
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15_000,
      });

      socketRef.current = instance;

      /*
       * ⚠️ Ulanish holati yon panelda ko'rsatiladi. `connect_error` —
       * server javob bermadi (socket.io o'zi qayta urinadi). Oddiy
       * uzilishdan keyin ham u O'ZI qayta ulanadi — bu «ulanmoqda».
       *
       * ⚠️⚠️ ISTISNO — `io server disconnect` (serverning o'zi uzdi):
       * socket.io bu holda QAYTA ULANMAYDI. Usiz panel abadiy
       * «Ulanmoqda…» da qolib, operator eskirgan xaritaga qarab
       * o'tirardi. Endi u «Aloqa uzilgan» va 5 s dan keyin qo'lda qayta
       * urinish (darhol emas: server yana uzsa, tinimsiz halqa bo'lardi).
       */
      const { setLink } = useRealtimeStore.getState();
      setLink('connecting');
      instance.on('connect', () => setLink('live'));
      instance.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          setLink('offline');
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!disposed) instance.connect();
          }, 5000);
          return;
        }
        setLink('connecting');
      });
      instance.on('connect_error', () => setLink('offline'));

      const scheduleRefresh = (): void => {
        if (flushTimer.current) return;
        flushTimer.current = setTimeout(() => {
          flushTimer.current = null;
          void queryClient.invalidateQueries({ queryKey: ['summary'] });
          void queryClient.invalidateQueries({ queryKey: ['gauges'] });
          void queryClient.invalidateQueries({ queryKey: ['districtRows'] });
          void queryClient.invalidateQueries({ queryKey: ['map'] });
          void queryClient.invalidateQueries({ queryKey: ['points'] });
          void queryClient.invalidateQueries({ queryKey: ['attention'] });
          void queryClient.invalidateQueries({ queryKey: ['boilers'] });
        }, 800);
      };

      instance.on('boiler:status', (_event: BoilerStatusEvent) => {
        scheduleRefresh();
      });

      /*
       * ⚠️ XAVF o'zgarishi — ro'yxat, karta, dashboard, yon panel soni
       * (`incidents` prefiksi) birga yangilanadi. Hodisa faqat VAKOLATLI
       * xonalarga keladi (server tanlaydi).
       */
      instance.on('incident:changed', (_event: IncidentRealtimeEvent) => {
        void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      });

      /*
       * ⚠️ SHAXSIY ogohlantirish — shu foydalanuvchiga yuborilgan XAVF
       * (javobgar, tuman/tashkilot mas'uli yoki eskalatsiya). Bu xabar
       * har doim ekranga chiqadi: u aynan «sizga» yo'naltirilgan.
       */
      instance.on(
        'incident:notification',
        (event: NotificationRealtimeEvent) => {
          void queryClient.invalidateQueries({
            queryKey: ['incidentNotifications'],
          });
          void queryClient.invalidateQueries({ queryKey: ['incidents'] });
          const text =
            event.level > 0
              ? `Eskalatsiya (${event.level}-daraja): ${event.title}`
              : event.title;
          if (event.severity === 'critical') {
            toast.error(text, { duration: 8000, id: event.notificationId });
          } else {
            toast(text, {
              duration: 6000,
              id: event.notificationId,
              icon: '⚠️',
            });
          }
        },
      );

      /*
       * ⚠️ Token muddati tugadi yoki vakolat o'zgardi — server XAVF
       * xonalaridan chiqardi. Yengil so'rov (`/auth/me`) HTTP interceptor
       * orqali tokenni yangilaydi, keyin YANGI token bilan qayta ulanamiz.
       */
      instance.on('auth:expired', () => {
        void get(API.auth.me)
          .catch(() => undefined)
          .finally(() => {
            if (!disposed) {
              instance.disconnect();
              instance.connect();
            }
          });
      });

      instance.on('alert:new', (event: AlertEvent) => {
        scheduleRefresh();
        void queryClient.invalidateQueries({ queryKey: ['alerts'] });

        /*
         * ⚠️ FAQAT KRITIK ogohlantirish ekranda ko'rsatiladi: har
         * ogohlantirish uchun xabar chiqsa, sovuq kechada ekran
         * bildirishnoma bilan to'lib ketardi.
         */
        if (event.severity !== 'critical') return;

        /*
         * ⚠️⚠️ BIR VAQTDA KO'PI BILAN 3 TA XABAR.
         *
         * Ogohlantirishlar TO'DA bo'lib keladi: gaz uzilsa yoki
         * tarmoq tiklansa, bir necha soniyada o'nlab kotyol holati
         * o'zgaradi. Cheklovsiz ekran 14 ta qalqib chiquvchi xabar
         * bilan to'lib, xaritani ham, jadvalni ham butunlay yopib
         * qo'yardi — operator esa ularni birin-ketin yopish bilan
         * ovora bo'lardi.
         *
         * Qolganlari YO'QOLMAYDI: ular «Diqqat talab qiladi»
         * ro'yxatida va «Ogohlantirishlar» bo'limida turadi, hisob
         * esa yakuniy xabarda aytiladi.
         */
        burst.current += 1;

        if (burst.current <= MAX_TOASTS) {
          toast.error(event.message, { duration: 6000, id: event.alertId });
        }

        if (burstTimer.current) clearTimeout(burstTimer.current);
        burstTimer.current = setTimeout(() => {
          const hidden = burst.current - MAX_TOASTS;
          if (hidden > 0) {
            toast.error(`Yana ${hidden} ta kritik ogohlantirish`, {
              id: 'alert-burst',
              duration: 7000,
            });
          }
          burst.current = 0;
          burstTimer.current = null;
        }, BURST_WINDOW_MS);
      });

      return instance;
    }

    return () => {
      disposed = true;
      clearTimeout(starter);
      if (retryTimer) clearTimeout(retryTimer);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      // ⚠️ To'da hisoblagichi ham tozalanadi: aks holda sahifa
      // almashganda eski hisob yangi to'daga qo'shilib, «yana 9 ta»
      // degan yolg'on xabar chiqardi.
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burst.current = 0;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
      useRealtimeStore.getState().setLink('idle');
    };
  }, [user, queryClient]);
}
