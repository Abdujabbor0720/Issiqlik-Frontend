import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Yorliq yonidagi son (masalan ochiq yozuvlar). */
  count?: ReactNode;
  title?: string;
  disabled?: boolean;
}

/**
 * SEGMENT BOSHQARUVI — davr, holat, ko'rinish tanlovi.
 *
 * ⚠️ Tanlangan «plitka» bitta element va bo'laklar orasida SURILADI
 * (`layoutId`) — ko'z «qayerdan qayerga o'tdim» ni ko'radi. Har bandda
 * alohida fon bo'lsa, tanlov «sakrab» o'zgarardi.
 *
 * ⚠️ `role="group"` + `aria-pressed`: bu radiogruppa EMAS — strelka
 * tugmalari bilan yurish kutilmaydi, har tugma mustaqil Tab nuqtasi.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  ariaLabel,
  className,
  fullWidth,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  size?: 'xs' | 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
  /** Konteynerni to'liq egallaydi (mobil filtrlar). */
  fullWidth?: boolean;
}) {
  const id = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--surface-sunken)] p-[3px] ring-1 ring-[var(--border-subtle)] ring-inset',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md font-semibold whitespace-nowrap outline-none transition-colors duration-200',
              'focus-visible:ring-2 focus-visible:ring-brand-400',
              'disabled:cursor-not-allowed disabled:opacity-50',
              size === 'xs' && 'h-6 px-2 text-nano',
              size === 'sm' && 'h-7 px-2.5 text-micro',
              size === 'md' && 'h-8 px-3.5 text-meta',
              fullWidth && 'flex-1',
              selected ? 'text-strong' : 'text-muted hover:text-strong',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`segmented-${id}`}
                aria-hidden
                transition={{
                  type: 'spring',
                  stiffness: 520,
                  damping: 40,
                  mass: 0.8,
                }}
                className="absolute inset-0 rounded-md bg-[var(--surface)] shadow-[var(--shadow-card)] dark:bg-white/[0.09]"
              />
            ) : null}
            {option.icon ? (
              <span className="relative inline-flex [&_svg]:size-3.5">
                {option.icon}
              </span>
            ) : null}
            <span className="relative">{option.label}</span>
            {option.count !== undefined && option.count !== null ? (
              <span
                className={cn(
                  'relative rounded-[4px] px-1 font-mono text-[10px] leading-4 tabular-nums',
                  selected
                    ? 'bg-brand-500/12 text-brand-700 dark:text-brand-200'
                    : 'bg-[var(--surface)] text-faint dark:bg-white/[0.05]',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
