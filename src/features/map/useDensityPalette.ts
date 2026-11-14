import { useMemo } from 'react';
import { useUiStore } from '@/store/ui.store';

/**
 * ZICHLIK SHKALASI — tumanning ko'k to'ldirmasi.
 *
 * ⚠️⚠️ TO'LDIRMA rangi HOLAT rangi EMAS va bu ongli qaror. Xaritada
 * ikkita boshqa-boshqa savol bor:
 *   • «bu yerda QANCHA obyekt bor» → maydon rangi (ko'k shkala);
 *   • «ularning AHVOLI qanday»     → belgi rangi (yashil/sariq/qizil).
 * Maydon ham holat rangi bilan bo'yalsa, xarita rang-barang dog'lar
 * to'plamiga aylanib, ikkala savolga ham javob bermay qo'yardi.
 *
 * ⚠️ Pog'onalar ATAYLAB kam (6 ta): uzluksiz gradientda qo'shni ikki
 * tuman bir xil ko'rinadi va «qaysi biri to'qroq» degan savol
 * javobsiz qoladi. Diskret pog'ona esa farqni ko'rsatadi.
 */
const LIGHT_RAMP = [
  '#eef4fb',
  '#dbe9f7',
  '#bfd9f1',
  '#9bc3e7',
  '#6fa6d8',
  '#4285c4',
];

const DARK_RAMP = [
  '#13202e',
  '#17293b',
  '#1d3b50',
  '#234b72',
  '#2b5e8f',
  '#356fa6',
];

export interface DensityPalette {
  dark: boolean;
  /** Tuman uchun rang — butun viloyat shkalasi bo'yicha. */
  hexFor: (total: number) => string;
  /** Chegara chizig'i rangi. */
  strokeHex: string;
  /** Tanlangan tuman chegarasi. */
  selectedStrokeHex: string;
  /**
   * YOLG'IZ tuman ko'rinishidagi to'ldirma.
   *
   * ⚠️ Zichlik shkalasidan OLINMAYDI: ekranda bitta ko'pburchak qolgan
   * va uning rangini taqqoslaydigan hech narsa yo'q — ya'ni rang
   * ma'no tashimaydi. Buning o'rniga u ATAYLAB OCH: ustida qozonxona
   * nuqtalari turadi va to'q fon ularni yutib yuborardi.
   */
  soloHex: string;
}

export function useDensityPalette(maxTotal: number): DensityPalette {
  const theme = useUiStore((state) => state.theme);
  const dark = theme === 'dark';

  return useMemo(() => {
    const ramp = dark ? DARK_RAMP : LIGHT_RAMP;

    return {
      dark,
      hexFor: (total: number): string => {
        if (total <= 0) return ramp[0];
        /*
         * ⚠️ Shkala eng katta tumanga MOSLANADI, qat'iy chegaralar
         * bilan emas. Filtrda bitta tuman qolganda qat'iy shkala
         * uni «eng och» qilib ko'rsatardi — holbuki u ekrandagi
         * yagona tuman va uning rangi hech narsa bilan
         * taqqoslanmaydi.
         */
        const safeMax = Math.max(1, maxTotal);
        const step = Math.min(
          ramp.length - 1,
          1 + Math.floor((total / safeMax) * (ramp.length - 2)),
        );
        return ramp[step];
      },
      strokeHex: dark ? '#0c131b' : '#ffffff',
      selectedStrokeHex: dark ? '#7db7e6' : '#12538f',
      soloHex: ramp[1],
    };
  }, [dark, maxTotal]);
}
