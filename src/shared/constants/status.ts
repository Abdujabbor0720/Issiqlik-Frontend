import type {
  AlertSeverity,
  AlertType,
  BoilerStatus,
  RoomCondition,
  UserRole,
} from '../api/types';

/**
 * HOLAT META'SI — yagona manba.
 *
 * ⚠️ `hex` maydoni SHART va u `index.css` dagi token bilan MOS bo'lishi
 * kerak. Sabab: Leaflet (`divIcon` HTML satri) va Recharts (SVG `fill`)
 * CSS o'zgaruvchisini O'QIY OLMAYDI — ularga haqiqiy rang kerak.
 * Tailwind sinfi esa faqat DOM elementlari uchun ishlaydi.
 *
 * ⚠️ Tailwind sinflari TO'LIQ yozilgan (`bg-ok-50`, `text-ok-700`),
 * shablon bilan yig'ilmagan (`bg-${tone}-50`): Tailwind manbani
 * STATIK o'qiydi va yig'ilgan sinf nomi CSS ga umuman tushmaydi —
 * ekranda rangsiz element qolardi.
 */
export interface StatusMeta {
  key: BoilerStatus;
  label: string;
  short: string;
  hex: string;
  /** Yorliq (chip) uchun to'liq sinflar. */
  chip: string;
  /** Faqat matn rangi. */
  text: string;
  /** Diagramma / progress uchun to'ldirish. */
  fill: string;
  /** Nuqta (indikator) uchun. */
  dot: string;
  description: string;
}

export const BOILER_STATUS: Record<BoilerStatus, StatusMeta> = {
  active: {
    key: 'active',
    label: 'Faol ishlayotgan',
    short: 'Faol',
    hex: '#118a56',
    chip: 'bg-ok-50 text-ok-700 ring-1 ring-ok-200',
    text: 'text-ok-600',
    fill: 'bg-ok-500',
    dot: 'bg-ok-500',
    description: '50 °C va undan yuqori',
  },
  medium: {
    key: 'medium',
    label: 'O‘rta ishlayotgan',
    short: 'O‘rta',
    hex: '#e09e21',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200',
    text: 'text-warn-600',
    fill: 'bg-warn-400',
    dot: 'bg-warn-400',
    description: '40–50 °C oralig‘ida',
  },
  inactive: {
    key: 'inactive',
    label: 'Ishlamayotgan',
    short: 'Ishlamayapti',
    hex: '#c8362c',
    chip: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200',
    text: 'text-danger-600',
    fill: 'bg-danger-500',
    dot: 'bg-danger-500',
    description: '20–40 °C — isitmayapti',
  },
  offline: {
    key: 'offline',
    label: 'Aloqa yo‘q',
    short: 'Aloqa yo‘q',
    hex: '#637386',
    chip: 'bg-idle-100 text-idle-700 ring-1 ring-idle-200',
    text: 'text-idle-600',
    fill: 'bg-idle-400',
    dot: 'bg-idle-400',
    description: 'Signal yo‘q yoki 20 °C dan past',
  },
};

/** Afsona va filtrdagi tartib — eng yaxshidan eng yomonga. */
export const STATUS_ORDER: BoilerStatus[] = [
  'active',
  'medium',
  'inactive',
  'offline',
];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  offline: 'Aloqa uzildi',
  low_temperature: 'Harorat past',
  critical_temperature: 'Kotyol ishlamayapti',
  overheat: 'Ortiqcha qizish',
  /*
   * ⚠️ Yorliq AYNAN QAYSI datchik nosozligini aytadi: «Datchik
   * nosoz» deb qo'yilsa, ta'mirchi qaysi quvurni tekshirishni
   * bilmasdi va ikkalasini ham almashtirib yurardi.
   */
  sensor_fault: 'Chiqish datchigi nosoz',
  no_circulation: 'Suv aylanmayapti',
  room_cold: 'Xona sovuq',
};

export const ALERT_SEVERITY: Record<
  AlertSeverity,
  { label: string; chip: string; dot: string }
> = {
  critical: {
    label: 'Kritik',
    chip: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200',
    dot: 'bg-danger-500',
  },
  warning: {
    label: 'Ogohlantirish',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200',
    dot: 'bg-warn-400',
  },
  info: {
    label: 'Ma‘lumot',
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
    dot: 'bg-brand-400',
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Bosh administrator',
  admin: 'Administrator',
  operator: 'Tuman mas‘uli',
  viewer: 'Kuzatuvchi',
  agency_officer: 'Tashkilot mas‘uli',
  responsible: 'Obyekt javobgari',
};

export const FUEL_LABELS: Record<string, string> = {
  gas: 'Gaz',
  electric: 'Elektr',
  coal: 'Ko‘mir',
  diesel: 'Dizel',
  other: 'Boshqa',
};

/*
 * ⚠️ OBYEKT TURLARI RO'YXATI BU YERDA EMAS va qaytarilmaydi.
 *
 * Ilgari u shu faylda qotirilgan edi va yangi tur qo'shish uchun
 * frontend relizi kerak bo'lardi — holbuki «sport maktabi» qo'shish
 * ma'muriy qaror. Endi turlar `object_types` katalogida va
 * `GET /catalogs/object-types` orqali keladi (Kataloglar → Obyekt
 * turlari). Qotirilgan nusxa qaytarilsa, u katalogdan ASTA-SEKIN
 * ajralib, ikki ekranda ikki xil ro'yxat ko'rinardi.
 */

/**
 * HARORAT → RANG (uzluksiz shkala).
 *
 * ⚠️ Holat rangidan FARQ QILADI va bu ataylab: holat — TOIFA
 * («ishlayapti / ishlamayapti»), harorat esa O'LCHOV. Grafikdagi
 * chiziq toifa rangi bilan chizilsa, u har nuqtada sakrab rang
 * o'zgartirardi va trendni o'qib bo'lmasdi.
 */
export function temperatureHex(value: number | null | undefined): string {
  if (value === null || value === undefined) return BOILER_STATUS.offline.hex;
  if (value >= 50) return BOILER_STATUS.active.hex;
  if (value >= 40) return BOILER_STATUS.medium.hex;
  if (value >= 20) return BOILER_STATUS.inactive.hex;
  return BOILER_STATUS.offline.hex;
}

/**
 * XONA HOLATI — yagona manba (kartalar, xarita, grafik).
 *
 * ⚠️ «Sovuq» rangi KO'K, kotyolning «ishlamayapti» qizilidan FARQLI:
 * xaritada ikkalasi bir nuqtada uchrashadi va bir xil rangda bo'lsa,
 * «qozon to'xtadi» bilan «bitta xona sovuq» ni ajratib bo'lmasdi.
 *
 * ⚠️ `hex` — Leaflet va Recharts uchun (ular CSS o'zgaruvchisini
 * o'qiy olmaydi).
 */
export interface RoomConditionMeta {
  key: RoomCondition;
  label: string;
  hex: string;
  chip: string;
  text: string;
  dot: string;
}

export const ROOM_CONDITION: Record<RoomCondition, RoomConditionMeta> = {
  cold: {
    key: 'cold',
    label: 'Sovuq',
    hex: '#0284c7',
    chip: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/12 dark:text-sky-200 dark:ring-sky-400/30',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-600',
  },
  cool: {
    key: 'cool',
    label: 'Me‘yordan past',
    hex: '#e09e21',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200',
    text: 'text-warn-600',
    dot: 'bg-warn-400',
  },
  normal: {
    key: 'normal',
    label: 'Me‘yorda',
    hex: '#118a56',
    chip: 'bg-ok-50 text-ok-700 ring-1 ring-ok-200',
    text: 'text-ok-600',
    dot: 'bg-ok-500',
  },
};

/** O'lchovi eskirgan xona — holat NOMA'LUM. */
export const ROOM_STALE = {
  label: 'O‘lchov eskirgan',
  hex: '#637386',
  chip: 'bg-idle-100 text-idle-700 ring-1 ring-idle-200',
  text: 'text-faint',
  dot: 'bg-idle-400',
} as const;
