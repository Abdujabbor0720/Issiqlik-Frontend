import { create } from 'zustand';

/**
 * JONLI ULANISH HOLATI (socket).
 *
 * - `idle` — ulanish hali boshlanmagan yoki foydalanuvchi chiqqan;
 * - `connecting` — birinchi ulanish yoki uzilishdan keyin qayta urinish;
 * - `live` — hodisalar kelmoqda, ekran o'z-o'zidan yangilanadi;
 * - `offline` — server javob bermayapti, ekrandagi raqamlar ESKIRISHI mumkin.
 *
 * ⚠️⚠️ Bu holat EKRANDA ko'rsatiladi (yon panel). Nazorat markazida
 * «ekrandagi ma'lumot jonlimi» degan savol eng muhimi: ulanish jimgina
 * uzilsa, operator soatlab eski xaritaga qarab o'tirardi.
 *
 * ⚠️ Saqlanmaydi (persist yo'q): sahifa qayta ochilganda eski «jonli»
 * holat bir lahza ham ko'rinmasligi kerak.
 */
export type RealtimeLink = 'idle' | 'connecting' | 'live' | 'offline';

interface RealtimeState {
  link: RealtimeLink;
  setLink: (link: RealtimeLink) => void;
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  link: 'idle',
  setLink: (link) => set((state) => (state.link === link ? state : { link })),
}));
