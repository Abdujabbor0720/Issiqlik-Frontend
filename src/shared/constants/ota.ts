import type { OtaEventStatus } from '@/shared/api/types';

/**
 * OTA HOLATLARI — «Qurilmalar» jadvali va tarqatish jarayoni BITTA nomdan
 * foydalanadi: ikki ekranda bir holat ikki xil atalsa («O'rnatildi» /
 * «Yuklandi»), operator ularni ikki xil hodisa deb o'qirdi.
 *
 * ⚠️ `pending` — faqat tarqatish jarayonida: «hali tegmagan».
 */
export const OTA_STATUS_META: Record<
  OtaEventStatus | 'pending',
  { label: string; chip: string }
> = {
  pending: {
    label: 'Kutilmoqda',
    chip: 'bg-[var(--surface-sunken)] text-muted',
  },
  offered: {
    label: 'Taklif qilindi',
    chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300',
  },
  installed: {
    label: 'O‘rnatildi',
    chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300',
  },
  ok: {
    label: 'Tasdiqlandi',
    chip: 'bg-ok-50 text-ok-700 dark:bg-ok-500/12 dark:text-ok-300',
  },
  failed: {
    label: 'Xato',
    chip: 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
  },
  rolled_back: {
    label: 'Qaytarildi',
    chip: 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
  },
};

/** Noma'lum holat kelsa ham sahifa yiqilmaydi — xom qiymat ko'rinadi. */
export function otaStatusMeta(status: string): { label: string; chip: string } {
  return (
    OTA_STATUS_META[status as OtaEventStatus | 'pending'] ?? {
      label: status,
      chip: 'bg-[var(--surface-sunken)] text-muted',
    }
  );
}
