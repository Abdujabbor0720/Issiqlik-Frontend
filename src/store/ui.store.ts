import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /**
   * YON PANEL YIG'ILGANMI.
   *
   * ⚠️ Saqlanadi: foydalanuvchi uni bir marta yig'sa, har sahifa
   * ochilishida qaytadan yig'ishga majbur bo'lmasligi kerak. Noutbuk
   * ekranida xarita uchun qo'shimcha 168 px — sezilarli farq.
   */
  railCollapsed: boolean;
  toggleRail: () => void;
}

/**
 * ⚠️ `<html>` sinfi SHU YERDAN qo'yiladi, komponent effektidan emas.
 * Komponentda bo'lsa, sahifa avval OCH rejimda chizilib, keyin to'q
 * rejimga sakrardi — «oq chaqnash» deb ataladigan aynan shu nuqson.
 */
function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },

      railCollapsed: false,
      toggleRail: () =>
        set((state) => ({ railCollapsed: !state.railCollapsed })),
    }),
    {
      name: 'issiqlik.ui',
      /*
       * ⚠️ Faqat ikkita maydon saqlanadi. Butun holat saqlansa,
       * kelajakda qo'shiladigan vaqtinchalik maydonlar ham
       * localStorage'ga tushib, sahifa qayta ochilganda eski holat
       * bilan qotib qolardi.
       */
      partialize: (state) => ({
        theme: state.theme,
        railCollapsed: state.railCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        // Saqlangan tanlov tiklangach — darhol qo'llanadi.
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
