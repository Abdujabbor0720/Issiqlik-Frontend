import type { DeviceBrief, ModuleType } from '@/shared/api/types';

/**
 * ESP32 MODULI TURLARI — ekrandagi nomlar BITTA joyda.
 *
 * ⚠️ Tur plata signalidan aniqlanadi va kabinetda o'zgartirilmaydi: OTA shu
 * bo'yicha ajratiladi (qozonxona proshivkasi xona moduliga berilmaydi).
 */
export const MODULE_TYPE_META: Record<
  ModuleType,
  { label: string; short: string; plural: string }
> = {
  boiler: {
    label: 'Qozonxona moduli',
    short: 'Qozonxona',
    plural: 'Qozonxona modullari',
  },
  room: { label: 'Xona moduli', short: 'Xona', plural: 'Xona modullari' },
};

/** ⚠️ Eski javobda maydon bo'lmasa — qozonxona moduli (eski proshivka). */
export function moduleTypeOf(
  device: Pick<DeviceBrief, 'moduleType'>,
): ModuleType {
  return device.moduleType ?? 'boiler';
}
