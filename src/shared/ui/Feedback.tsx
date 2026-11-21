import type { LucideIcon } from 'lucide-react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * SKELET.
 *
 * ⚠️ Spinner EMAS. Spinner «qancha kutish kerak» degan savolga javob
 * bermaydi va ma'lumot kelganda tartib SAKRAB ketadi. Skelet esa
 * bo'lajak tartibning o'lchamini oldindan egallaydi va sahifa
 * «o'rniga tushadi», «paydo bo'lmaydi».
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * BO'SH HOLAT.
 *
 * ⚠️ «Ma'lumot yo'q» yetarli emas: foydalanuvchi NIMA QILISHINI
 * bilishi kerak. Shuning uchun tavsif va (iloji bo'lsa) amal tugmasi
 * majburiy — aks holda ekran «buzilgan» bo'lib ko'rinadi.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'reveal flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="relative mb-1 grid size-14 place-items-center">
          {/* Texnik to'r ustidagi plitka — «bo'sh joy» emas, «hali
              ma'lumot tushmagan katak». */}
          <span
            aria-hidden
            className="grid-bg absolute inset-[-14px] rounded-full [mask-image:radial-gradient(closest-side,#000,transparent)]"
          />
          <span className="relative grid size-12 place-items-center rounded-xl bg-[var(--surface)] text-faint shadow-[var(--shadow-card)]">
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
        </span>
      ) : null}
      <h3 className="font-display text-[15px] font-[720] tracking-[-0.01em] text-strong [font-stretch:106%]">
        {title}
      </h3>
      {description ? (
        <p className="max-w-sm text-meta text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * KUTISH — termal «yugurik» chiziq.
 *
 * ⚠️ Faqat sahifa bo'lagi yuklanayotgan qisqa oraliq uchun (lazy
 * marshrut). Ro'yxat va kartalar uchun — `Skeleton`.
 */
export function InlineLoader({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16"
    >
      <span className="relative h-[3px] w-36 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <span className="loader-run thermal-line absolute inset-y-0 left-0 w-1/2 rounded-full" />
      </span>
      <span className="label-eyebrow">{label}…</span>
    </div>
  );
}

/**
 * XATO HOLATI.
 *
 * ⚠️ «Qayta urinish» tugmasi SHART: tarmoq uzilishi vaqtinchalik va
 * foydalanuvchi butun sahifani qayta yuklashga majbur bo'lmasligi
 * kerak — bu uning filtrlarini va joriy holatini yo'qotardi.
 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="mb-1 grid size-11 place-items-center rounded-xl bg-danger-50 text-danger-600 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/12 dark:text-danger-300 dark:ring-danger-400/25">
        <AlertOctagon className="size-5" strokeWidth={2} />
      </span>
      <h3 className="text-ui font-semibold text-strong">
        Ma‘lumotni yuklab bo‘lmadi
      </h3>
      <p className="max-w-sm text-meta text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="group mt-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-meta font-semibold text-brand-600 ring-1 ring-brand-200 transition-colors ring-inset hover:bg-brand-50 dark:text-brand-300 dark:ring-brand-400/30 dark:hover:bg-brand-400/10"
        >
          <RotateCcw className="size-3.5 transition-transform duration-500 ease-out-expo group-hover:-rotate-180" />
          Qayta urinish
        </button>
      ) : null}
    </div>
  );
}
