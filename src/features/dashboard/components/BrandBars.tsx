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

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-ui font-medium text-strong">
              {row.name}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-meta">
              <span className="text-muted" data-numeric>
                {formatTemperature(row.avgTemperature)}
              </span>
              <span className="text-muted" data-numeric>
                {formatNumber(row.working)}/{formatNumber(row.total)}
              </span>
              <span
                className={cn(
                  'w-11 text-right font-semibold',
                  row.workingPercent >= 80
                    ? 'text-ok-600'
                    : row.workingPercent >= 55
                      ? 'text-warn-600'
                      : 'text-danger-600',
                )}
                data-numeric
              >
                {row.workingPercent}%
              </span>
            </span>
          </div>
          <Progress
            size="sm"
            value={row.workingPercent}
            barClassName={
              row.workingPercent >= 80
                ? 'bg-ok-500'
                : row.workingPercent >= 55
                  ? 'bg-warn-400'
                  : 'bg-danger-500'
            }
          />
        </div>
      ))}
    </div>
  );
}
