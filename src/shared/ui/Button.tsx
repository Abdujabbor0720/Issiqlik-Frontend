import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  /* ⚠️ Asosiy tugma — vertikal gradient + yuqori yorug' chiziq: yassi
     ko'k to'rtburchak «bosiladigan» emas, «chizilgan» bo'lib ko'rinadi.
     Ostidagi soya KO'K (kulrang emas). `btn-sheen` — sichqoncha ostida
     bir marta o'tadigan yorug' chaqnash. */
  primary:
    'btn-sheen bg-linear-to-b from-brand-500 to-brand-600 text-white ' +
    'shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.22)] ' +
    'hover:from-brand-400 hover:to-brand-600 active:from-brand-600 active:to-brand-700 ' +
    'disabled:from-brand-300 disabled:to-brand-400 dark:disabled:from-brand-800 dark:disabled:to-brand-900',
  secondary:
    'bg-[var(--surface)] text-strong shadow-[var(--shadow-card)] ' +
    'hover:shadow-[var(--shadow-raise)] hover:bg-[var(--surface-muted)] active:bg-[var(--surface-sunken)] ' +
    'dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
  subtle:
    'bg-[var(--surface-sunken)] text-ink ring-1 ring-[var(--border-subtle)] ring-inset ' +
    'hover:bg-[var(--surface-muted)] hover:text-strong',
  ghost:
    'text-muted hover:bg-[var(--surface-sunken)] hover:text-strong dark:hover:bg-white/[0.06]',
  danger:
    'btn-sheen bg-linear-to-b from-danger-400 to-danger-500 text-white ' +
    'shadow-[0_1px_2px_rgb(120_20_14/0.3),0_8px_18px_-8px_rgb(200_54_44/0.6),inset_0_1px_0_rgb(255_255_255/0.2)] ' +
    'hover:from-danger-400 hover:to-danger-600 active:from-danger-600 active:to-danger-700 ' +
    'disabled:from-danger-300 disabled:to-danger-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-meta rounded-md',
  md: 'h-9.5 gap-2 px-3.5 text-ui rounded-lg',
  lg: 'h-11 gap-2 px-5 text-body rounded-lg',
  icon: 'size-9 justify-center rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  /** Yumaloq (pill) ko'rinish — yuqori menyu va filtrlar uchun. */
  pill?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  pill,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      /* ⚠️ Yuklanayotganda ham O'CHIRILADI: ikki marta bosilsa, ikkita
         bir xil yozuv yaratilardi va uni faqat qo'lda topib o'chirish
         mumkin bo'lardi. */
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center font-semibold tracking-[-0.005em] select-none',
        /* ⚠️ Bosilganda 3% kichrayadi — barmoq/sichqoncha «tegdim» degan
           javobni ko'radi. Faqat `transform` — tartib siljimaydi. */
        'transition-[background-color,box-shadow,color,transform] duration-200 ease-out-quint active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        pill && 'rounded-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
