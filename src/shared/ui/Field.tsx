import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { cn } from '@/shared/utils/cn';

/*
 * ⚠️ Chegara `ring` bilan, `border` bilan EMAS. `border` elementning
 * o'lchamiga qo'shiladi va fokusda qalinlashganda maydon 1px ga
 * «sakrab» ketardi — forma bo'ylab yurganda butun tartib qimirlardi.
 */
const CONTROL =
  'w-full rounded-lg bg-[var(--surface)] px-3 text-ui text-strong ' +
  'ring-1 ring-[var(--border-strong)] transition-[box-shadow,background-color] duration-200 ease-out-quint ' +
  'placeholder:text-faint hover:ring-[color-mix(in_srgb,var(--color-brand-400)_45%,var(--border-strong))] ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:shadow-[0_0_0_5px_rgb(22_115_214/0.14)] ' +
  'dark:bg-[var(--surface-sunken)] dark:focus:shadow-[0_0_0_5px_rgb(59_145_239/0.18)] ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-muted';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

/**
 * MAYDON O'RAMI — yorliq, izoh va xato uchun.
 *
 * ⚠️ `id` `useId()` dan va `<label htmlFor>` ga bog'lanadi: yorliqqa
 * bosilganda maydon fokus olishi kerak, ekran o'quvchisi esa qaysi
 * yorliq qaysi maydonga tegishli ekanini bilishi kerak.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-meta font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
        </label>
      ) : null}

      {children(id)}

      {/* ⚠️ Xato IZOHNING O'RNIGA chiqadi, ostiga emas: ikkalasi birga
          ko'rinsa, maydon balandligi o'zgarib forma sakrardi. */}
      {error ? (
        <p className="text-micro font-medium text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-micro text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Chap tomondagi ikonka (qidiruv uchun). */
  leading?: ReactNode;
}

export function Input({ className, invalid, leading, ...rest }: InputProps) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">
          {leading}
        </span>
        <input
          className={cn(CONTROL, 'h-9.5 pl-9', invalid && 'ring-danger-400', className)}
          {...rest}
        />
      </div>
    );
  }
  return (
    <input
      className={cn(CONTROL, 'h-9.5', invalid && 'ring-danger-400', className)}
      {...rest}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(
        CONTROL,
        'h-9.5 cursor-pointer appearance-none pr-9',
        // ⚠️ O'qcha SVG sifatida fon rasmida: brauzerning o'z o'qchasi
        // har platformada boshqacha ko'rinadi va forma «yamoq» bo'lib
        // qolardi.
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2397a5b7%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%2397a5b7%22 stroke-width=%221.6%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[length:18px] bg-[right_0.6rem_center] bg-no-repeat",
        invalid && 'ring-danger-400',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        CONTROL,
        'resize-y py-2 leading-relaxed',
        invalid && 'ring-danger-400',
        className,
      )}
      {...rest}
    />
  );
}

/** Kalit (switch) — sozlamalar uchun. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-[background-color,box-shadow] duration-300',
        checked
          ? 'bg-linear-to-b from-brand-500 to-brand-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_14px_-2px_rgb(22_115_214/0.6)]'
          : 'bg-neutral-300 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] dark:bg-white/15',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-300 ease-out-expo',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
