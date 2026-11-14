import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import type { AlertEvent, BoilerStatusEvent } from '@/shared/api/types';
import { useAuthStore } from '@/store/auth.store';

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

    const starter = setTimeout(() => {
      if (disposed) return;
      socket = connect();
    }, 0);

    function connect(): Socket {
      const instance = io(`${SOCKET_URL}/realtime`, {
        transports: ['websocket'],
        query: user!.districtId ? { districtId: user!.districtId } : {},
        // ⚠️ Avtomatik qayta ulanish — cheksiz, lekin ORTIB BORUVCHI
        // kechikish bilan: server qayta ishga tushayotganda o'nlab
        // mijoz bir vaqtda urinsa, u yana yiqilardi.
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15_000,
      });

      socketRef.current = instance;

      const scheduleRefresh = (): void => {
        if (flushTimer.current) return;
        flushTimer.current = setTimeout(() => {
          flushTimer.current = null;
          void queryClient.invalidateQueries({ queryKey: ['summary'] });
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
      if (flushTimer.current) clearTimeout(flushTimer.current);
      // ⚠️ To'da hisoblagichi ham tozalanadi: aks holda sahifa
      // almashganda eski hisob yangi to'daga qo'shilib, «yana 9 ta»
      // degan yolg'on xabar chiqardi.
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burst.current = 0;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user, queryClient]);
}
