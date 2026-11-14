import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export type StatTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'idle' | 'brand';

/*
 * ⚠️ Ohang sinflari TO'LIQ yozilgan, shablon bilan yig'ilmagan
 * (`bg-${tone}-50` EMAS). Tailwind manba kodini STATIK o'qiydi va
 * yig'ilgan sinf nomi CSS ga umuman tushmaydi — ekranda rangsiz
 * plitka qolardi.
 */
const TONE: Record<StatTone, { tile: string; accent: string; bar: string }> = {
  neutral: {
    tile: 'bg-neutral-100 text-neutral-600 dark:bg-white/6 dark:text-neutral-300',
    accent: 'text-muted',
    bar: 'bg-neutral-300',
  },
  brand: {
    tile: 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300',
    accent: 'text-brand-600',
    bar: 'bg-brand-500',
  },
  ok: {
    tile: 'bg-ok-50 text-ok-600 dark:bg-ok-500/12 dark:text-ok-300',
    accent: 'text-ok-600',
    bar: 'bg-ok-500',
  },
  warn: {
    tile: 'bg-warn-50 text-warn-600 dark:bg-warn-400/14 dark:text-warn-300',
    accent: 'text-warn-600',
    bar: 'bg-warn-400',
  },
  danger: {
    tile: 'bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-danger-300',
    accent: 'text-danger-600',
    bar: 'bg-danger-500',
  },
  idle: {
    tile: 'bg-idle-100 text-idle-600 dark:bg-white/6 dark:text-idle-300',
    accent: 'text-idle-600',
    bar: 'bg-idle-400',
  },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatTone;
  /** Raqam ostidagi izoh: «17.3% — jami kotyollardan». */
  hint?: string;
  /** 0–100: kartaning pastidagi nozik ulush chizig'i. */
  share?: number | null;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/**
 * KO'RSATKICH KARTASI.
 *
 * ⚠️ Raqam TO'LIQ ko'rsatiladi, qisqartirilmaydi («1 245», «1,2 ming»
 * emas): rahbar kartadagi raqamlarni QO'SHIB ko'radi (17 + 145 + 34)
 * va qisqartirilgan son bu tekshiruvni imkonsiz qilardi.
 *
 * ⚠️ Karta BOSILADIGAN bo'lsa `<button>` bo'ladi, `onClick` li `<div>`
 * emas: klaviatura bilan yurganlar uchun `<div>` umuman mavjud emas.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  share,
  onClick,
  active,
  className,
}: StatCardProps) {
  const palette = TONE[tone];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'card relative overflow-hidden px-4 pt-3.5 pb-4 text-left',
        onClick && 'card-hover cursor-pointer',
        active && 'ring-2 ring-brand-400 ring-offset-2 ring-offset-[var(--canvas)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-md',
            palette.tile,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.2} />
        </span>
        <span className="truncate text-meta font-medium text-muted">
          {label}
        </span>
      </div>

      <div
        className="mt-2 text-figure font-semibold tracking-tight text-strong"
        data-numeric
      >
        {value}
      </div>

      {hint ? (
        <div className={cn('mt-1 text-micro font-medium', palette.accent)}>
          {hint}
        </div>
      ) : null}

      {/* ⚠️ Ulush chizig'i kartaning PASTKI chekkasida, ichida emas:
          u raqamga raqobat qilmasligi kerak — ko'z avval sonni, keyin
          nisbatni o'qiydi. */}
      {share !== null && share !== undefined ? (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--surface-sunken)]">
          <div
            className={cn('h-full rounded-r-full transition-[width] duration-500', palette.bar)}
            style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
          />
        </div>
      ) : null}
    </Component>
  );
}
