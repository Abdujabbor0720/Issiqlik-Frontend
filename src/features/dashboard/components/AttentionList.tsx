import { ArrowUpRight, PlugZap, ThermometerSnowflake, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AttentionRow } from '@/shared/api/types';
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
          <li key={row.id}>
            {index > 0 ? <div className="h-px bg-line" /> : null}
            <Link
              to={`/boilers/${row.id}`}
              className="group flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-tile',
                  row.status === 'offline'
                    ? 'bg-idle-100 text-idle-600 dark:bg-white/6 dark:text-idle-300'
                    : row.status === 'inactive'
                      ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-danger-300'
                      : 'bg-warn-50 text-warn-600 dark:bg-warn-400/14 dark:text-warn-300',
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-ui font-medium text-strong">
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

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-right">
                  <span
                    className={cn('block text-ui font-semibold', meta.text)}
                    data-numeric
                  >
                    {formatTemperature(row.temperature)}
                  </span>
                  <span className="block text-nano text-faint">{meta.short}</span>
                </span>
                <ArrowUpRight className="size-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
