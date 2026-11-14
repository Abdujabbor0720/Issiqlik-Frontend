import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FiltersState {
  /**
   * TANLANGAN TUMAN — butun ilova bo'ylab UMUMIY.
   *
   * ⚠️⚠️ `null` = «Umumiy» (butun viloyat). Bo'sh massiv ishlatilmaydi:
   * ikki xil «bo'sh» qiymat (`null` va `[]`) bo'lsa, har tekshiruv
   * joyida ikkalasini ham hisobga olish kerak bo'lardi va bittasi
   * albatta unutilardi.
   *
   * ⚠️ BITTA tuman, massiv EMAS (biznes qarori). Ko'p tanlov bilan
   * «14 ta tuman tanlangan» degan holat paydo bo'lardi va ekrandagi
   * raqam na butun viloyatniki, na aniq bir tumanniki bo'lardi —
   * rahbar esa ko'rsatkichni AYNAN shu ikki kesimda o'qiydi:
   * «viloyat bo'yicha» yoki «Jalaquduq bo'yicha».
   */
  districtId: string | null;
  setDistrict: (id: string | null) => void;
  clearDistrict: () => void;
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      districtId: null,
      setDistrict: (id) => set({ districtId: id }),
      clearDistrict: () => set({ districtId: null }),
    }),
    {
      name: 'issiqlik.filters',
      /*
       * ⚠️ Versiya oshirildi: ilgari `districtIds: string[]` saqlanardi.
       * Migratsiyasiz eski qiymat massiv bo'lib tiklanib, `districtId`
       * massiv bo'lib qolardi va so'rovga `?districtIds=a,b` o'rniga
       * `[object Object]` ketardi — xato esa butunlay boshqa joyda
       * ko'rinardi.
       */
      version: 2,
      migrate: (persisted) => {
        const legacy = persisted as { districtIds?: unknown } | null;
        const ids = legacy?.districtIds;
        return {
          districtId:
            Array.isArray(ids) && typeof ids[0] === 'string' ? ids[0] : null,
        } as FiltersState;
      },
      partialize: (state) => ({ districtId: state.districtId }),
    },
  ),
);

/**
 * So'rov parametri — `?districtIds=<id>`.
 *
 * ⚠️ Server hamon MASSIV kutadi (`districtIds`) va bu ataylab
 * o'zgartirilmadi: hisobot va eksport kelajakda bir nechta tumanni
 * birga olishi mumkin. Interfeys bitta tuman bilan ishlaydi, shartnoma
 * esa kengroq qoladi — teskarisi bo'lsa, ko'p tanlov kerak bo'lganda
 * butun API ni qayta yozish kerak bo'lardi.
 */
export function districtParams(
  districtId: string | null,
): Record<string, string> {
  return districtId ? { districtIds: districtId } : {};
}
