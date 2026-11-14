/**
 * SANA — faqat shu yerda formatlanadi.
 *
 * ⚠️⚠️ `toLocaleDateString('uz-UZ')` TAQIQLANADI: natija kod yozilgan
 * joyga emas, kod ISHLAYOTGAN muhitga bog'liq — brauzer sozlamasi,
 * operatsion tizim locale'i. Shu sababli bitta jadvalda bir ustun
 * «21-may, 2025», ikkinchisi «21.05.2025» bo'lib qolardi.
 */

const MONTHS_UZ = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

const MONTHS_UZ_CAP = MONTHS_UZ.map((m) => m[0].toUpperCase() + m.slice(1));

/** Toshkent (+5, DST yo'q) — tizimning yagona mintaqasi. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function toTashkent(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + TASHKENT_OFFSET_MS);
}

/** `21-may, 2025` */
export function formatDateUz(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = toTashkent(value);
  if (!d) return '—';
  return `${d.getUTCDate()}-${MONTHS_UZ[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** `21-may, 2025 14:30` */
export function formatDateTimeUz(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = toTashkent(value);
  if (!d) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDateUz(value)} ${hh}:${mm}`;
}

/** `14:30` */
export function formatTimeUz(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = toTashkent(value);
  if (!d) return '—';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

/** `Yanvar, 2026` */
export function formatMonthUz(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = toTashkent(value);
  if (!d) return '—';
  return `${MONTHS_UZ_CAP[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/**
 * «3 soat oldin» — nisbiy vaqt.
 *
 * ⚠️ Faqat YAQIN o'tmish uchun: bir kundan oshsa aniq sana
 * ko'rsatiladi. «47 kun oldin» degan yozuv hech kimga yordam
 * bermaydi, «27-sentabr, 2026» esa beradi.
 */
export function formatRelativeUz(
  value: Date | string | null | undefined,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDateTimeUz(value);

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'kecha';
  if (days < 7) return `${days} kun oldin`;

  return formatDateUz(value);
}

/**
 * Grafik o'qi uchun qisqa yorliq.
 * ⚠️ Kunlik qadam bo'lsa sana, soatlik bo'lsa vaqt: ikkalasi ham
 * ko'rsatilsa, 24 ta yorliq bir-biriga tegib ketardi.
 */
export function formatAxisLabel(iso: string, bucket: 'hour' | 'day'): string {
  const d = toTashkent(iso);
  if (!d) return '';
  if (bucket === 'day') {
    return `${d.getUTCDate()}-${MONTHS_UZ[d.getUTCMonth()].slice(0, 3)}`;
  }
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
}

/** `<input type="date">` uchun — EKRANGA chiqarilmaydi. */
export function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}
