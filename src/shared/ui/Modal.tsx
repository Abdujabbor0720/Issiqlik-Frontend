import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

/**
 * MODAL.
 *
 * ⚠️ Headless UI `Dialog` ishlatiladi, qo'lda yozilgan oyna emas:
 * fokus tutqichi (focus trap), `Escape` bilan yopish, fon
 * aylantirishni to'xtatish va `aria` atributlari — bularning har biri
 * alohida yozilganda bittasi albatta unutilardi.
 *
 * ⚠️ Kirish/chiqish animatsiyasi Headless UI'ning `transition`
 * atributi bilan (`data-closed`): oyna yopilganda DOMdan darhol
 * olib tashlanmaydi, animatsiya tugagach olinadi. Yakuniy holatda
 * `transform` YO'Q — ichidagi `fixed` ro'yxatlar siljimaydi.
 *
 * ⚠️ Tanasi ALOHIDA aylantiriladi (`overflow-y-auto`), sarlavha va
 * tugmalar esa joyida qoladi: uzun formada «Saqlash» tugmasi
 * ekrandan chiqib ketmasligi kerak.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      {/* Fon — to'q va BLURLANGAN: oddiy qora qoplama ostida rangli
          dashboard «ko'rinib» turib, diqqatni tortardi. */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-neutral-950/55 backdrop-blur-[6px] transition-opacity duration-300 ease-out data-closed:opacity-0 data-leave:duration-200 dark:bg-black/65"
      />

      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className={cn(
            'relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-card bg-[var(--surface)] shadow-[var(--shadow-pop)]',
            'transition duration-300 ease-out-expo data-closed:translate-y-4 data-closed:scale-[0.97] data-closed:opacity-0',
            'data-leave:duration-150 data-leave:ease-in',
            SIZES[size],
          )}
        >
          {/* Termal imzo — har oyna tepasida bir xil. */}
          <span
            aria-hidden
            className="thermal-line absolute inset-x-0 top-0 h-[2px] opacity-90"
          />

          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3.5">
            <div className="min-w-0">
              <DialogTitle className="font-display text-[18px] leading-tight font-[760] tracking-[-0.02em] text-strong [font-stretch:110%]">
                {title}
              </DialogTitle>
              {description ? (
                <p className="mt-1 text-meta text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="group grid size-8 shrink-0 place-items-center rounded-md text-muted ring-1 ring-[var(--border-subtle)] transition-colors ring-inset hover:bg-[var(--surface-sunken)] hover:text-strong"
            >
              <X className="size-4 transition-transform duration-300 ease-out-expo group-hover:rotate-90" />
            </button>
          </div>

          <div className="h-px bg-line" />

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <>
              <div className="h-px bg-line" />
              <div className="flex items-center justify-end gap-2 bg-[var(--surface-muted)] px-5 py-3">
                {footer}
              </div>
            </>
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/**
 * TASDIQ OYNASI — orqaga qaytarib bo'lmaydigan amallar uchun.
 *
 * ⚠️ `window.confirm` ISHLATILMAYDI: u brauzer uslubida chiqadi,
 * o'zbek tilini bilmaydi va amalning OQIBATINI tushuntira olmaydi
 * («Bu kotyol arxivga tushadi, telemetriya saqlanib qoladi»).
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Tasdiqlash',
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-3.5 text-ui font-semibold text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'btn-sheen h-9 rounded-lg bg-linear-to-b px-3.5 text-ui font-semibold text-white transition-[transform,box-shadow] duration-200 active:scale-[0.97] disabled:opacity-70',
              tone === 'danger'
                ? 'from-danger-400 to-danger-500 shadow-[0_8px_18px_-8px_rgb(200_54_44/0.6),inset_0_1px_0_rgb(255_255_255/0.2)]'
                : 'from-brand-500 to-brand-600 shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.22)]',
            )}
          >
            {loading ? 'Bajarilmoqda…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-body text-ink">{message}</div>
    </Modal>
  );
}
