import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  /* ⚠️ Asosiy tugma ostidagi soya KO'K, kulrang emas: rangli element
     ostidagi neytral soya uni «kesib qo'yilgan» qilib ko'rsatadi. */
  primary:
    'bg-brand-600 text-white shadow-[var(--shadow-brand)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'surface text-strong shadow-[var(--shadow-card)] hover:bg-[var(--surface-muted)] active:bg-[var(--surface-sunken)]',
  subtle:
    'bg-[var(--surface-sunken)] text-ink hover:bg-[var(--surface-muted)] hover:text-strong',
  ghost: 'text-muted hover:bg-[var(--surface-sunken)] hover:text-strong',
  danger:
    'bg-danger-500 text-white shadow-[0_1px_2px_rgb(120_20_14/0.25),0_5px_12px_-5px_rgb(200_54_44/0.45)] hover:bg-danger-600 active:bg-danger-700 disabled:bg-danger-300',
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
        'inline-flex shrink-0 items-center font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        pill && 'rounded-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
