import {
  CircuitBoard,
  PlugZap,
  Snowflake,
  ThermometerSnowflake,
  ThermometerSun,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type {
  IncidentEventType,
  IncidentKind,
  IncidentStatus,
  NotifyAudience,
  ResponsibilityType,
  ScheduleScope,
} from '@/shared/api/types';

/**
 * XAVF — ko'rinish konstantalari.
 *
 * ⚠️ `Record<…>` — yangi tur/holat qo'shilsa kompilyatsiya to'xtaydi:
 * yorlig'i yoki rangi yo'q holat jimgina «—» bo'lib ko'rinmasligi kerak.
 */

export const INCIDENT_KIND: Record<
  IncidentKind,
  { label: string; icon: LucideIcon }
> = {
  room_low_temperature: { label: 'Harorat me‘yordan past', icon: Snowflake },
  boiler_low_temperature: {
    label: 'Kotyol harorati past',
    icon: ThermometerSnowflake,
  },
  device_offline: { label: 'Qurilma aloqasi yo‘q', icon: PlugZap },
  sensor_fault: { label: 'Datchik nosoz', icon: CircuitBoard },
  overheat: { label: 'Ortiqcha qizish', icon: ThermometerSun },
  no_circulation: { label: 'Suv aylanmayapti', icon: Waves },
};

/**
 * HOLAT RANGLARI.
 * ⚠️ «Yangi» — eng ko'zga tashlanadigan (qizil): hali hech kim qabul
 * qilmagan XAVF — eng xavflisi. Bartaraf etilgan — yashil, lekin
 * «yopildi» dan farqli (hali tekshirilmagan).
 */
export const INCIDENT_STATUS: Record<
  IncidentStatus,
  { label: string; chip: string; dot: string }
> = {
  new: {
    label: 'Yangi xavf',
    chip: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200 dark:bg-danger-500/12 dark:text-danger-300',
    dot: 'bg-danger-500',
  },
  acknowledged: {
    label: 'Qabul qilindi',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/14 dark:text-warn-300',
    dot: 'bg-warn-400',
  },
  in_progress: {
    label: 'Chora ko‘rilmoqda',
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300',
    dot: 'bg-brand-500',
  },
  resolved: {
    label: 'Bartaraf etildi',
    chip: 'bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300',
    dot: 'bg-ok-500',
  },
  closed: {
    label: 'Yopildi',
    chip: 'bg-idle-100 text-idle-700 ring-1 ring-idle-200 dark:bg-white/6 dark:text-idle-300',
    dot: 'bg-idle-400',
  },
};

export const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  'new',
  'acknowledged',
  'in_progress',
];

export const RESPONSIBILITY_LABELS: Record<ResponsibilityType, string> = {
  director: 'Muassasa rahbari',
  facilities: 'Xo‘jalik ishlari bo‘yicha mas‘ul',
  heating_technician: 'Isitish tizimi texnik mas‘uli',
  other: 'Boshqa',
};

export const AUDIENCE_LABELS: Record<NotifyAudience, string> = {
  responsible: 'Obyekt javobgari',
  district: 'Tuman mas‘ullari',
  agency: 'Tashkilot mas‘ullari',
  region: 'Viloyat mas‘ullari',
};

export const SCHEDULE_SCOPE_LABELS: Record<ScheduleScope, string> = {
  global: 'Umumiy',
  object_type: 'Obyekt turi',
  organization: 'Muassasa',
  boiler: 'Obyekt (qozonxona)',
};

export const EVENT_LABELS: Record<IncidentEventType, string> = {
  created: 'XAVF aniqlandi',
  notified: 'Ogohlantirish yuborildi',
  status_changed: 'Holat o‘zgardi',
  comment: 'Izoh',
  action: 'Bajarilgan ish',
  severity_raised: 'Og‘irlik oshdi',
  auto_resolved: 'Avtomatik bartaraf etildi',
  reopened: 'Qayta ochildi',
  escalated: 'Eskalatsiya',
};

/** ISO hafta kunlari: 1 — dushanba … 7 — yakshanba. */
export const WEEKDAYS: Array<{ value: number; short: string; label: string }> =
  [
    { value: 1, short: 'Du', label: 'Dushanba' },
    { value: 2, short: 'Se', label: 'Seshanba' },
    { value: 3, short: 'Ch', label: 'Chorshanba' },
    { value: 4, short: 'Pa', label: 'Payshanba' },
    { value: 5, short: 'Ju', label: 'Juma' },
    { value: 6, short: 'Sh', label: 'Shanba' },
    { value: 7, short: 'Ya', label: 'Yakshanba' },
  ];

/** `[1,2,3,4,5,6]` → `Du–Sh`, `[1,3,5]` → `Du, Ch, Ju`. */
export function formatWeekdays(days: number[]): string {
  if (days.length === 7) return 'har kuni';
  if (days.length === 0) return '—';
  const sorted = [...days].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (day, index) => index === 0 || day === sorted[index - 1] + 1,
  );
  const short = (day: number) =>
    WEEKDAYS.find((item) => item.value === day)?.short ?? String(day);
  return contiguous && sorted.length > 2
    ? `${short(sorted[0])}–${short(sorted[sorted.length - 1])}`
    : sorted.map(short).join(', ');
}

/** Daqiqalar → `2 soat 15 daq`, `3 kun 4 soat`. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return '—';
  }
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} daq`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return hours > 0 ? `${days} kun ${hours} soat` : `${days} kun`;
  return mins > 0 ? `${hours} soat ${mins} daq` : `${hours} soat`;
}
