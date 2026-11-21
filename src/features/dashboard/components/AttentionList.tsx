import {
  ArrowUpRight,
  PlugZap,
  ThermometerSnowflake,
  Gauge,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { AttentionRow, BoilerStatus } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { EmptyState } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';
import { boilerName } from '@/shared/utils/boiler';

const ICONS = {
  offline: PlugZap,
  inactive: ThermometerSnowflake,
  medium: Gauge,
  active: Gauge,
} as const;

/*
 * ⚠️ Ikonka plitkasi va harorat rangi TO'LIQ sinf nomlari bilan (yorug' +
 * qorong'i). `BOILER_STATUS.text` faqat yorug' rejim qadamini beradi va
 * to'q fonda `text-danger-600` o'qilmay qolardi.
 */
const TILE: Record<BoilerStatus, string> = {
  offline:
    'bg-idle-100 text-idle-600 ring-idle-200 dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10',
  inactive:
    'bg-danger-50 text-danger-600 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30',
  medium:
    'bg-warn-50 text-warn-600 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
  active:
    'bg-ok-50 text-ok-600 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25',
};

const TEMP_DARK: Record<BoilerStatus, string> = {
  offline: 'dark:text-idle-300',
  inactive: 'dark:text-danger-300',
  medium: 'dark:text-warn-300',
  active: 'dark:text-ok-300',
};

/**
 * DIQQAT TALAB QILADIGANLAR.
 *
 * ⚠️⚠️ Eng SOVUQLAR emas, muammoda eng UZOQ turganlar. Harorat
 * bo'yicha saralansa, ro'yxat tepasida har doim bitta nosoz datchik
 * (−127 °C) turib qolardi; «6 soatdan beri sovuq maktab» esa pastga
 * tushib ketardi va hech kim uni ko'rmasdi.
 *
 * ⚠️ Har qatorda «qancha vaqtdan beri» yoziladi — bu ro'yxatning
 * butun mohiyati. Faqat holat ko'rsatilsa, «hozirgina o'chgan» bilan
 * «kecha tushdan beri o'chiq» bir xil ko'rinardi.
 *
 * ⚠️ Chapdagi tartib raqami (01, 02…) — navbat: birinchi qator eng uzoq
 * kutgan. Chap chetdagi holat chizig'i esa ko'z ro'yxatni rang bo'yicha
 * «skanerlashi» uchun.
 */
export function AttentionList({ rows }: { rows: AttentionRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Gauge}
        title="Hammasi me‘yorda"
        description="Hozircha diqqat talab qiladigan qozonxona yo‘q."
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => {
        const meta = BOILER_STATUS[row.status];
        const Icon = ICONS[row.status];

        return (
          <li
            key={row.id}
            className="reveal"
            style={{ '--i': Math.min(index, 12) } as CSSProperties}
          >
            {index > 0 ? <div className="mx-2 h-px bg-line" /> : null}
            <Link
              to={`/boilers/${row.id}`}
              className="group relative flex items-center gap-3 rounded-tile px-2 py-2.5 transition-[background-color,box-shadow,transform] duration-200 ease-out-quint hover:bg-[var(--surface-sunken)] dark:hover:bg-white/[0.03]"
            >
              {/* Holat chizig'i — sichqoncha ostida bo'yiga cho'ziladi. */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 scale-y-50 rounded-full opacity-60 transition-[scale,opacity] duration-300 ease-out-expo group-hover:scale-y-150 group-hover:opacity-100',
                  meta.dot,
                )}
              />

              <span
                aria-hidden
                className="w-5 shrink-0 pl-1 font-mono text-[10.5px] font-semibold text-faint tabular-nums transition-colors group-hover:text-muted"
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-md ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover:scale-105',
                  TILE[row.status],
                )}
              >
                <Icon className="size-4" strokeWidth={2.1} />
              </span>

              <div className="min-w-0 flex-1 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">
                <p className="truncate text-ui font-semibold text-strong">
                  {boilerName(row.organizationName, row.lotNumber)}
                </p>
                <p className="truncate text-micro text-muted">
                  {row.districtName} ·{' '}
                  {/* ⚠️ «Qachondan beri» holat O'ZGARGAN paytdan
                      hisoblanadi, oxirgi signaldan emas: aloqasi
                      uzilgan kotyolda oxirgi signal eski, lekin
                      muammo o'sha paytdan boshlangan. */}
                  {row.statusChangedAt
                    ? formatRelativeUz(row.statusChangedAt)
                    : 'vaqt noma‘lum'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-right">
                  <span
                    className={cn(
                      'block font-display text-[15px] leading-tight font-[740] tracking-[-0.02em] [font-stretch:108%]',
                      meta.text,
                      TEMP_DARK[row.status],
                    )}
                    data-numeric
                  >
                    {formatTemperature(row.temperature)}
                  </span>
                  <span className="block font-mono text-[9.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                    {meta.short}
                  </span>
                </span>
                <ArrowUpRight className="size-3.5 -translate-x-1 text-faint opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
