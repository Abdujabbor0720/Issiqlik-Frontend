import {
  Baby,
  Building,
  Building2,
  GraduationCap,
  Hospital,
  Landmark,
  School,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { GaugeItem } from '@/shared/api/types';

/**
 * OBYEKT TURI → ikonka. Kalit — katalogdagi MASHINA KODI (`school`), nom
 * emas: nom admin tomonidan tahrirlanadi va unga bog'lanib bo'lmaydi.
 * Yangi tur qo'shilsa (kod noma'lum) — umumiy bino ikonkasi.
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
  school: School,
  kindergarten: Baby,
  college: GraduationCap,
  hospital: Hospital,
  clinic: Stethoscope,
  admin: Landmark,
  residential: Building2,
  other: Building,
};

export function typeIcon(code: string | null | undefined): LucideIcon {
  return (code && TYPE_ICONS[code]) || Building;
}

/** Turi belgilanmagan muassasalar uchun tab kaliti. */
export const UNTYPED_KEY = 'none';
export const ALL_KEY = 'all';

export function typeKeyOf(item: GaugeItem): string {
  return item.objectTypeId ?? UNTYPED_KEY;
}

/**
 * Sarlavha uchun KO'PLIK: «Maktab» → «Maktablar».
 *
 * ⚠️ O'zbek tilida «-lar» qo'shimchasi unli uyg'unligisiz — har qanday
 * nomga to'g'ri qo'shiladi («Ma‘muriy bino» → «Ma‘muriy binolar»).
 * Admin nomni o'zi ko'plikda yozgan bo'lsa, ikkinchi marta qo'shilmaydi.
 */
export function pluralTypeName(name: string): string {
  const trimmed = name.trim();
  return /lar$/i.test(trimmed) ? trimmed : `${trimmed}lar`;
}

/**
 * Tabiiy tartib: «2-maktab» «10-maktab» dan OLDIN.
 * ⚠️ Oddiy `localeCompare` raqamni matn deb solishtiradi va «10» ni
 * «2» dan oldin qo'yardi — ro'yxat tartibsiz ko'rinardi.
 */
const collator = new Intl.Collator('uz', {
  numeric: true,
  sensitivity: 'base',
});

export function compareItems(a: GaugeItem, b: GaugeItem): number {
  return (
    collator.compare(a.organizationName ?? '', b.organizationName ?? '') ||
    collator.compare(a.lotNumber, b.lotNumber)
  );
}

/** Jonli: aloqa bor (holat «offline» emas). */
export function isLive(item: GaugeItem): boolean {
  return item.status !== 'offline';
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export interface GaugeStats {
  total: number;
  online: number;
  avgInlet: number | null;
  avgOutlet: number | null;
  avgDelta: number | null;
}

/**
 * Sarlavhadagi o'rtachalar — FAQAT JONLI qozonxonalar bo'yicha.
 *
 * ⚠️ Aloqasi uzilganlarning oxirgi qiymati kunlar oldingi bo'lishi
 * mumkin: ular qo'shilsa, «hozirgi o'rtacha» o'tmishni ko'rsatardi.
 * Jonli birorta ham bo'lmasa — «—», nol emas.
 */
export function gaugeStats(items: GaugeItem[]): GaugeStats {
  const live = items.filter(isLive);
  const inlets = live.flatMap((item) =>
    item.inlet === null ? [] : [item.inlet],
  );
  const outlets = live.flatMap((item) =>
    item.outlet === null ? [] : [item.outlet],
  );
  const deltas = live.flatMap((item) =>
    item.inlet === null || item.outlet === null
      ? []
      : [item.outlet - item.inlet],
  );
  return {
    total: items.length,
    online: live.length,
    avgInlet: mean(inlets),
    avgOutlet: mean(outlets),
    avgDelta: mean(deltas),
  };
}

/** ΔT = chiqish − kirish (ikkalasi ham ma'lum bo'lsa). */
export function deltaT(item: GaugeItem): number | null {
  return item.inlet === null || item.outlet === null
    ? null
    : item.outlet - item.inlet;
}
