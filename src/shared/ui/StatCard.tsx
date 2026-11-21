import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/shared/utils/cn';
import { AnimatedNumber } from './AnimatedNumber';

export type StatTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'idle' | 'brand';

/*
 * ⚠️ Ohang sinflari TO'LIQ yozilgan, shablon bilan yig'ilmagan
 * (`bg-${tone}-50` EMAS). Tailwind manba kodini STATIK o'qiydi va
 * yig'ilgan sinf nomi CSS ga umuman tushmaydi — ekranda rangsiz
 * plitka qolardi.
 *
 * `glow` — burchakdagi nur va pastki chiziq rangi (CSS o'zgaruvchisi).
 */
const TONE: Record<StatTone, { tile: string; accent: string; glow: string }> = {
  neutral: {
    tile: 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-white/6 dark:text-neutral-300 dark:ring-white/10',
    accent: 'text-muted',
    glow: 'var(--color-neutral-400)',
  },
  brand: {
    tile: 'bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/20',
    accent: 'text-brand-600 dark:text-brand-300',
    glow: 'var(--color-brand-500)',
  },
  ok: {
    tile: 'bg-ok-50 text-ok-600 ring-ok-100 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/20',
    accent: 'text-ok-600 dark:text-ok-300',
    glow: 'var(--color-ok-500)',
  },
  warn: {
    tile: 'bg-warn-50 text-warn-600 ring-warn-100 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/20',
    accent: 'text-warn-600 dark:text-warn-300',
    glow: 'var(--color-warn-400)',
  },
  danger: {
    tile: 'bg-danger-50 text-danger-600 ring-danger-100 dark:bg-danger-500/12 dark:text-danger-300 dark:ring-danger-400/20',
    accent: 'text-danger-600 dark:text-danger-300',
    glow: 'var(--color-danger-500)',
  },
  idle: {
    tile: 'bg-idle-100 text-idle-600 ring-idle-200 dark:bg-white/6 dark:text-idle-300 dark:ring-white/10',
    accent: 'text-idle-600 dark:text-idle-300',
    glow: 'var(--color-idle-400)',
  },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatTone;
  /** Raqam ostidagi izoh: «17.3% — jami kotyollardan». */
  hint?: string;
  /** 0–100: kartaning pastidagi ulush chizig'i. */
  share?: number | null;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  /** Paydo bo'lish tartibi (ketma-ket chiqish uchun). */
  index?: number;
}

/**
 * KO'RSATKICH KARTASI — nazorat markazining «raqam plitkasi».
 *
 * ⚠️ Raqam TO'LIQ ko'rsatiladi, qisqartirilmaydi («1 245», «1,2 ming»
 * emas): rahbar kartadagi raqamlarni QO'SHIB ko'radi (17 + 145 + 34).
 * Raqam sanab chiqadi (`AnimatedNumber`), lekin yakuniy matn aynan
 * formatlangan satr.
 *
 * ⚠️ Karta BOSILADIGAN bo'lsa `<button>` bo'ladi, `onClick` li `<div>`
 * emas: klaviatura bilan yurganlar uchun `<div>` umuman mavjud emas.
 *
 * ⚠️ Holat rangi uch joyda: ikonka plitkasi, burchakdagi nur va pastki
 * ulush chizig'i. Raqamning o'zi har doim neytral — oltita rangli katta
 * raqam yonma-yon tursa ko'z charchaydi.
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
  index,
}: StatCardProps) {
  const palette = TONE[tone];
  const Component = onClick ? 'button' : 'div';
  const hasShare = share !== null && share !== undefined;

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      style={{ '--tone': palette.glow, '--i': index } as CSSProperties}
      className={cn(
        'card group relative isolate overflow-hidden px-4 pt-3.5 pb-4.5 text-left',
        index !== undefined && 'reveal',
        onClick && 'card-hover cursor-pointer outline-none',
        active &&
          'ring-2 ring-[color:var(--tone)] ring-offset-2 ring-offset-[var(--canvas)]',
        className,
      )}
    >
      {/* Burchakdagi holat nuri — sichqoncha ostida kuchayadi. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 -z-10 size-44 rounded-full opacity-[0.13] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.26] dark:opacity-[0.2] dark:group-hover:opacity-[0.34]"
        style={{ background: 'var(--tone)' }}
      />

      <div className="flex items-start justify-between gap-2">
        {/* ⚠️ Yorliq KESILMAYDI («JAMI QOZONXONA…» o'qilmaydi): harf
            oralig'i torroq va kerak bo'lsa ikkinchi qatorga o'tadi. Tor
            ustunda (6 ta karta) monoshrift katta harflar sig'mas edi. */}
        <span className="label-eyebrow line-clamp-2 min-w-0 pt-1 !text-[10px] !leading-[1.35] !tracking-[0.07em]">
          {label}
        </span>
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover:scale-110 group-hover:-rotate-6',
            palette.tile,
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.3} />
        </span>
      </div>

      <AnimatedNumber
        value={value}
        className="figure-display mt-3 block text-figure"
      />

      {hint ? (
        <div
          className={cn('mt-2 truncate text-micro font-medium', palette.accent)}
        >
          {hint}
        </div>
      ) : null}

      {/* ⚠️ Ulush chizig'i kartaning PASTKI chekkasida: u raqamga raqobat
          qilmasligi kerak. Chap chetdan «o'sib» chiqadi (`transform`). */}
      {hasShare ? (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--surface-sunken)]">
          <div
            className="stat-bar h-full transition-[width] duration-700 ease-out-expo"
            style={{
              width: `${Math.max(0, Math.min(100, share))}%`,
              background: 'var(--tone)',
              boxShadow: '0 0 12px var(--tone)',
            }}
          />
        </div>
      ) : null}
    </Component>
  );
}
