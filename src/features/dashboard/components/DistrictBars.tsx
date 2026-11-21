import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { DistrictRow } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { SegmentedBar } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';

/**
 * TUMANLAR KESIMI — bo'lakli chiziqlar ro'yxati.
 *
 * ⚠️⚠️ Bitta foiz ko'rsatuvchi chiziq EMAS, TO'RT BO'LAKLI chiziq.
 * «Ishlayapti 78%» degan raqam qolgan 22% nima ekanini aytmaydi:
 * ular sovuqmi, aloqasi yo'qmi — bu ikkisi butunlay boshqa amalni
 * talab qiladi (biri — ta'mirchi, ikkinchisi — internet). Bo'lakli
 * chiziq esa buni bir qarashda ko'rsatadi.
 *
 * ⚠️ Ro'yxat ISHLAYOTGAN ULUSHI bo'yicha saralanadi, alifbo bo'yicha
 * emas: rahbarga «qaysi tuman eng yomon» kerak, «Andijondan
 * boshlanadigan tumanlar» emas. Chapdagi o'rin raqami (01 — eng yomon)
 * shu tartibni so'zsiz aytadi.
 *
 * ⚠️ Chiziqlar birinchi chizishda chapdan «o'sib» chiqadi (`stat-bar`,
 * faqat `transform`) — qatorlar ketma-ket, yuqoridan pastga.
 */
export function DistrictBars({
  rows,
  selectedId,
  onSelect,
  limit,
}: {
  rows: DistrictRow[];
  selectedId: string | null;
  /** ⚠️ `null` — tanlov bekor qilindi (qayta bosilgan tuman). */
  onSelect: (districtId: string | null) => void;
  limit?: number;
}) {
  const sorted = [...rows]
    /* ⚠️ Kotyoli YO'Q tuman pastga tushadi, lekin ro'yxatdan
       CHIQMAYDI: «bu tumanda bitta ham qozonxona yo'q» — bu ham
       xabar va u ko'rinishi kerak. */
    .sort((a, b) => {
      if (a.total === 0 && b.total > 0) return 1;
      if (b.total === 0 && a.total > 0) return -1;
      return a.workingPercent - b.workingPercent;
    })
    .slice(0, limit ?? rows.length);

  return (
    <div className="flex flex-col gap-px">
      {sorted.map((row, index) => {
        const selected = selectedId === row.districtId;
        return (
          <button
            key={row.districtId}
            type="button"
            onClick={() => onSelect(selected ? null : row.districtId)}
            aria-pressed={selected}
            style={{ '--i': Math.min(index, 12) } as CSSProperties}
            className={cn(
              'group grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-tile px-2 py-2 text-left',
              'transition-[background-color,box-shadow] duration-200 ease-out-quint',
              selected
                ? 'bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-500)] dark:bg-brand-400/10'
                : 'hover:bg-[var(--surface-sunken)] hover:shadow-[inset_3px_0_0_var(--border-strong)] dark:hover:bg-white/[0.03]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'font-mono text-[10.5px] font-semibold tabular-nums transition-colors',
                selected
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-faint group-hover:text-muted',
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="flex min-w-0 items-center gap-1">
              <span
                className={cn(
                  'truncate text-ui font-semibold',
                  selected
                    ? 'text-brand-700 dark:text-brand-200'
                    : 'text-strong',
                )}
              >
                {row.shortName}
              </span>
              <ChevronRight className="size-3 shrink-0 -translate-x-1 text-faint opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100" />
            </div>

            <div className="flex shrink-0 items-center gap-2.5 text-meta">
              <span className="text-muted" data-numeric>
                {formatTemperature(row.avgTemperature)}
              </span>
              <span
                className="w-9 text-right font-semibold text-strong"
                data-numeric
              >
                {formatNumber(row.total)}
              </span>
              {/* ⚠️ Foiz CHIP ichida va rangi natijaga qarab:
                  jadvaldagi o'nlab raqam orasida yalang'och «78%»
                  ko'zga tashlanmasdi. */}
              <span
                className={cn(
                  'w-12 rounded-md py-0.5 text-center font-mono text-[11px] font-semibold ring-1 ring-inset',
                  workingChip(row.workingPercent, row.total),
                )}
                data-numeric
              >
                {row.total === 0 ? '—' : `${row.workingPercent}%`}
              </span>
            </div>

            <div className="stat-bar col-span-2 col-start-2">
              <SegmentedBar
                size="sm"
                segments={[
                  {
                    value: row.active,
                    className: 'bg-ok-500',
                    label: BOILER_STATUS.active.label,
                  },
                  {
                    value: row.medium,
                    className: 'bg-warn-400',
                    label: BOILER_STATUS.medium.label,
                  },
                  {
                    value: row.inactive,
                    className: 'bg-danger-500',
                    label: BOILER_STATUS.inactive.label,
                  },
                  {
                    value: row.offline,
                    className: 'bg-idle-400',
                    label: BOILER_STATUS.offline.label,
                  },
                ]}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * «Ishlayapti» foizi chipi — 80% va 55% chegaralari (jadval bilan AYNI).
 * ⚠️ Sinflar to'liq yozilgan: Tailwind yig'ilgan nomni CSS ga chiqarmaydi.
 */
function workingChip(percent: number, total: number): string {
  if (total === 0) {
    return 'bg-[var(--surface-sunken)] text-faint ring-[var(--border-subtle)]';
  }
  if (percent >= 80) {
    return 'bg-ok-50 text-ok-700 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25';
  }
  if (percent >= 55) {
    return 'bg-warn-50 text-warn-700 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25';
  }
  return 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30';
}
