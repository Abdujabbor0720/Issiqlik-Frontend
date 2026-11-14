import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
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
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-[var(--surface-sunken)] text-faint">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      ) : null}
      <h3 className="text-ui font-semibold text-strong">{title}</h3>
      {description ? (
        <p className="max-w-sm text-meta text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function InlineLoader({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-meta text-muted">
      <Loader2 className="size-4 animate-spin" />
      {label}…
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
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
        className,
      )}
    >
      <h3 className="text-ui font-semibold text-danger-600">
        Ma‘lumotni yuklab bo‘lmadi
      </h3>
      <p className="max-w-sm text-meta text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-md px-3 py-1.5 text-meta font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
        >
          Qayta urinish
        </button>
      ) : null}
    </div>
  );
}
