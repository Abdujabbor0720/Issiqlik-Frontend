import type { CSSProperties } from 'react';
import type { BrandRow } from '@/shared/api/types';
import { EmptyState, Progress } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { Library } from 'lucide-react';

/**
 * MARKA KESIMI.
 *
 * ⚠️ Bu bo'lim «qaysi marka ko'p o'rnatilgan» degan savolga emas,
 * «qaysi marka ishonchliroq» degan savolga javob beradi — shuning
 * uchun asosiy raqam ISHLAYOTGANLAR ULUSHI. Shu tufayli keyingi
 * xaridda qaysi markani tanlash haqida dalil paydo bo'ladi.
 *
 * ⚠️ Keng ekranda IKKI USTUN, lekin tartib USTUN BO'YLAB (avval chap
 * ustun yuqoridan pastga, keyin o'ng): server tartibi o'qilishi
 * buzilmasin — qator bo'ylab to'ldirilsa, 1 va 2 yonma-yon, 3 esa
 * pastda turib, ro'yxat «zig-zag» bo'lib o'qilardi.
 */
export function BrandBars({ rows }: { rows: BrandRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="Marka ma‘lumoti yo‘q"
        description="Kotyollarga marka biriktirilgandan so‘ng bu yerda kesim paydo bo‘ladi."
      />
    );
  }

  const perColumn = Math.ceil(rows.length / 2);

  return (
    <div
      className="grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-flow-col lg:grid-cols-2"
      style={{ gridTemplateRows: `repeat(${perColumn}, auto)` }}
    >
      {rows.map((row, index) => {
        const tone =
          row.workingPercent >= 80
            ? 'ok'
            : row.workingPercent >= 55
              ? 'warn'
              : 'danger';
        return (
          <div
            key={row.name}
            className="group grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5"
            style={{ '--i': Math.min(index, 12) } as CSSProperties}
          >
            <span
              aria-hidden
              className="font-mono text-[10.5px] font-semibold text-faint tabular-nums"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="truncate text-ui font-semibold text-strong">
                {row.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-2.5 text-meta">
                <span className="text-muted" data-numeric>
                  {formatTemperature(row.avgTemperature)}
                </span>
                <span className="font-mono text-[11px] text-faint" data-numeric>
                  {formatNumber(row.working)}
                  <span className="mx-px opacity-60">/</span>
                  {formatNumber(row.total)}
                </span>
                <span
                  className={cn(
                    'w-12 text-right font-display text-[15px] leading-none font-[760] tracking-[-0.02em] [font-stretch:108%]',
                    tone === 'ok'
                      ? 'text-ok-600 dark:text-ok-300'
                      : tone === 'warn'
                        ? 'text-warn-600 dark:text-warn-300'
                        : 'text-danger-600 dark:text-danger-300',
                  )}
                  data-numeric
                >
                  {row.workingPercent}%
                </span>
              </span>
            </div>
            {/* ⚠️ Faqat TO'LDIRMA o'sadi (`stat-bar` → `barClassName`), iz
                (track) joyida qoladi: ko'z «qancha bo'sh joy qolgani» ni
                ham birinchi kadrdanoq ko'radi. */}
            <Progress
              size="sm"
              value={row.workingPercent}
              className="col-start-2"
              barClassName={cn(
                'stat-bar',
                tone === 'ok'
                  ? 'bg-ok-500'
                  : tone === 'warn'
                    ? 'bg-warn-400'
                    : 'bg-danger-500',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
