import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
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
 * alohida yozilganda bittasi albatta unutilardi va oyna klaviatura
 * bilan ishlatib bo'lmaydigan holatga kelardi.
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
      <div
        className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[2px]"
        aria-hidden
      />

      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          className={cn(
            'flex max-h-[88vh] w-full flex-col overflow-hidden rounded-card bg-[var(--surface)] shadow-[var(--shadow-pop)]',
            SIZES[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <DialogTitle className="text-head font-semibold text-strong">
                {title}
              </DialogTitle>
              {description ? (
                <p className="mt-0.5 text-meta text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
            >
              <X className="size-4" />
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
            className="h-9 rounded-lg px-3.5 text-ui font-medium text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'h-9 rounded-lg px-3.5 text-ui font-medium text-white transition-colors disabled:opacity-70',
              tone === 'danger'
                ? 'bg-danger-500 hover:bg-danger-600'
                : 'bg-brand-600 hover:bg-brand-700',
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
