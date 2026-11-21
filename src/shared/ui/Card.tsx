import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Sichqoncha ostida ko'tariladimi — bosiladigan kartalar uchun. */
  interactive?: boolean;
}

export function Card({ children, className, interactive }: CardProps) {
  return (
    <div className={cn('card', interactive && 'card-hover', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  /** Sarlavha ustidagi kichik yorliq. */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * KARTA SARLAVHASI.
 *
 * ⚠️ Amallar (`actions`) sarlavha QATORIDA, kartaning pastida emas:
 * foydalanuvchi kartani yuqoridan pastga o'qiydi va «bu yerda nima
 * qilish mumkin» degan savolga javob kontent OLDIDAN kelishi kerak.
 * Pastda bo'lsa, uzun ro'yxatli kartada tugma ekrandan chiqib ketardi.
 */
export function CardHeader({
  title,
  eyebrow,
  subtitle,
  icon,
  actions,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 pt-4 pb-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          /* ⚠️ Ikonka plitkasi kartadan KICHIKROQ radiusda (10 vs 16):
             ichma-ich joylashgan ikki burchak bir xil bo'lsa, ichkisi
             «shishgan» bo'lib ko'rinadi. */
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-brand-100 ring-inset dark:bg-brand-400/10 dark:text-brand-200 dark:ring-brand-400/20">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <div className="label-eyebrow mb-0.5">{eyebrow}</div> : null}
          <h2 className="truncate font-display text-[15.5px] leading-snug font-[720] tracking-[-0.012em] text-strong [font-stretch:106%]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-meta text-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
}

/** Karta ichidagi ajratgich — ro'yxat qatorlari orasida. */
export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line', className)} />;
}
