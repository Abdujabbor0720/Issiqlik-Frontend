import { create } from 'zustand';
import { post, tokenStore } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type { AuthUser, LoginResponse } from '@/shared/api/types';

interface AuthState {
  user: AuthUser | null;
  /** Boshlang'ich tekshiruv tugadimi — usiz login sahifasi MILTILLAYDI. */
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  login: (login: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Ruxsat tekshiruvi — UI elementlarini yashirish uchun. */
  can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,

  setUser: (user) => set({ user, ready: true }),

  login: async (login, password) => {
    const result = await post<LoginResponse>(API.auth.login, { login, password });
    tokenStore.set(result.accessToken, result.refreshToken);
    set({ user: result.user, ready: true });
    return result.user;
  },

  logout: async () => {
    const refreshToken = tokenStore.refresh();
    try {
      /*
       * ⚠️ Server chaqiruvi `try` ichida: tarmoq uzilgan bo'lsa ham
       * foydalanuvchi tizimdan CHIQISHI kerak. Aks holda «chiqish»
       * tugmasi ishlamay qolardi va u o'z hisobida qolib ketardi —
       * eng yomoni, birov ortidan kelib shu yerda ishlay olardi.
       */
      if (refreshToken) await post(API.auth.logout, { refreshToken });
    } catch {
      // Jim: mahalliy tozalash baribir bajariladi.
    }
    tokenStore.clear();
    set({ user: null, ready: true });
  },

  /**
   * ⚠️ Bu FAQAT ko'rinishni boshqaradi, himoya EMAS. Haqiqiy tekshiruv
   * serverda (`PermissionsGuard`): tugmani yashirish hujumchiga
   * to'siq bo'lmaydi, u so'rovni to'g'ridan-to'g'ri yuboradi.
   * Bu yerdagi maqsad — foydalanuvchiga bosmaydigan tugmani
   * ko'rsatmaslik.
   */
  can: (permission) => get().user?.permissions.includes(permission) ?? false,
}));
