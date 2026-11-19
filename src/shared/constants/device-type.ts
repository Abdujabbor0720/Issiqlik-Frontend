import type { DeviceType, TokenKind } from '@/shared/api/types';

/**
 * QURILMA TURLARI — ekrandagi nomlar BITTA joyda.
 *
 * ⚠️ Qiymatlar backend bilan AYNI (`kotyol` / `xona`). OTA shu bo'yicha
 * ajratiladi: kotyol proshivkasi xona moduliga hech qachon berilmaydi.
 */
export const DEVICE_TYPE_META: Record<
  DeviceType,
  { label: string; short: string; plural: string; chip: string }
> = {
  kotyol: {
    label: 'Kotyol moduli',
    short: 'Kotyol',
    plural: 'Kotyol modullari',
    chip: 'bg-[var(--surface-sunken)] text-muted ring-1 ring-[var(--border-subtle)]',
  },
  xona: {
    label: 'Xona moduli',
    short: 'Xona',
    plural: 'Xona modullari',
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300',
  },
};

export const DEVICE_TYPES: readonly DeviceType[] = ['kotyol', 'xona'];

/** Token turi — «Shaxsiy» / «Umumiy»; hali so'rov bo'lmasa `—`. */
export const TOKEN_KIND_LABEL: Record<TokenKind, string> = {
  personal: 'Shaxsiy',
  shared: 'Umumiy',
};
