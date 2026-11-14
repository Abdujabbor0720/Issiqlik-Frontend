import { ChevronRight } from 'lucide-react';
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
 * boshlanadigan tumanlar» emas.
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
    <div className="flex flex-col">
      {sorted.map((row) => {
        const selected = selectedId === row.districtId;
        return (
          <button
            key={row.districtId}
            type="button"
            onClick={() => onSelect(selected ? null : row.districtId)}
            className={cn(
              'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 text-left transition-colors',
              selected
                ? 'bg-brand-50 dark:bg-brand-500/10'
                : 'hover:bg-[var(--surface-sunken)]',
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'truncate text-ui font-medium',
                  selected ? 'text-brand-700 dark:text-brand-300' : 'text-strong',
                )}
              >
                {row.shortName}
              </span>
              <ChevronRight className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div className="flex shrink-0 items-center gap-2.5 text-meta">
              <span className="text-muted" data-numeric>
                {formatTemperature(row.avgTemperature)}
              </span>
              <span className="w-10 text-right font-semibold text-strong" data-numeric>
                {formatNumber(row.total)}
              </span>
              {/* ⚠️ Foiz CHIP ichida va rangi natijaga qarab:
                  jadvaldagi o'nlab raqam orasida yalang'och «78%»
                  ko'zga tashlanmasdi. */}
              <span
                className={cn(
                  'w-12 rounded-full px-1.5 py-0.5 text-center text-micro font-semibold',
                  row.total === 0
                    ? 'bg-[var(--surface-sunken)] text-faint'
                    : row.workingPercent >= 80
                      ? 'bg-ok-50 text-ok-700 dark:bg-ok-500/12 dark:text-ok-300'
                      : row.workingPercent >= 55
                        ? 'bg-warn-50 text-warn-700 dark:bg-warn-400/14 dark:text-warn-300'
                        : 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
                )}
                data-numeric
              >
                {row.total === 0 ? '—' : `${row.workingPercent}%`}
              </span>
            </div>

            <div className="col-span-2">
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
