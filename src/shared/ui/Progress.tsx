import { cn } from '@/shared/utils/cn';

interface ProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
  /** Balandlik: ro'yxatda ingichka, kartada qalinroq. */
  size?: 'sm' | 'md';
}

export function Progress({
  value,
  className,
  barClassName = 'bg-brand-500',
  size = 'md',
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export interface Segment {
  value: number;
  className: string;
  label: string;
}

/**
 * BO'LAKLI CHIZIQ — bitta qatorda to'rt holatni ko'rsatadi.
 *
 * ⚠️ Nol bo'lgan bo'lak CHIZILMAYDI: `width: 0%` bo'lsa ham brauzer
 * yumaloq burchak tufayli 1–2 px rang ko'rsatib qo'yardi va tumanda
 * «bitta ishlamayotgan bor» degan yolg'on taassurot tug'ilardi.
 */
export function SegmentedBar({
  segments,
  className,
  size = 'md',
}: {
  segments: Segment[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return (
      <div
        className={cn('w-full rounded-full bg-[var(--surface-sunken)]', height, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]',
        height,
        className,
      )}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.value}`}
            className={cn('h-full transition-[width] duration-500', segment.className)}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}
