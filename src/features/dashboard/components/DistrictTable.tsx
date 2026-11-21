import type { DistrictRow } from '@/shared/api/types';
import { Table, Td, Th, Tr } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';

/**
 * TUMANLAR JADVALI — qurilmalar, me'yor va ogohlantirishlar kesimi.
 *
 * ⚠️ Bo'lakli chiziqlar (`DistrictBars`) «qozonxonalar qanday ishlayapti»
 * degan savolga javob beradi; bu jadval esa «qayerda aralashish kerak»:
 * oflayn qurilmalar (internet / elektr), me'yordan past kotyollar
 * (ta'mirchi) va ochiq ogohlantirishlar — har biri boshqa amal.
 *
 * ⚠️ Nol qiymat XIRA, noldan katta muammo esa RANGLI: 14 qatorli jadvalda
 * ko'z faqat rangli kataklarni qidiradi.
 */
export function DistrictTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: DistrictRow[];
  selectedId: string | null;
  onSelect: (districtId: string | null) => void;
}) {
  const sorted = [...rows].sort((a, b) =>
    a.shortName.localeCompare(b.shortName, 'uz'),
  );
  const totals = rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      devicesOnline: acc.devicesOnline + row.devicesOnline,
      devicesOffline: acc.devicesOffline + row.devicesOffline,
      belowNorm: acc.belowNorm + row.belowNorm,
      openAlerts: acc.openAlerts + row.openAlerts,
    }),
    {
      total: 0,
      devicesOnline: 0,
      devicesOffline: 0,
      belowNorm: 0,
      openAlerts: 0,
    },
  );

  return (
    <Table>
      <thead>
        <tr>
          <Th>Tuman</Th>
          <Th align="right">Qozonxonalar</Th>
          <Th align="right">Ishlayapti</Th>
          <Th align="right">O‘rtacha harorat</Th>
          <Th align="right">Qurilmalar onlayn / oflayn</Th>
          <Th align="right">Me‘yordan past</Th>
          <Th align="right">Ogohlantirishlar</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => {
          const selected = selectedId === row.districtId;
          return (
            <Tr
              key={row.districtId}
              onClick={() => onSelect(selected ? null : row.districtId)}
              className={cn(
                selected &&
                  'bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-500)] dark:bg-brand-400/10',
              )}
            >
              <Td
                className={cn(
                  'font-semibold whitespace-nowrap',
                  selected
                    ? 'text-brand-700 dark:text-brand-200'
                    : 'text-strong',
                )}
              >
                {row.name}
              </Td>
              <Td align="right" className="text-ink">
                <span data-numeric>{formatNumber(row.total)}</span>
                {row.boilerUnits !== row.total ? (
                  <span className="ml-1 text-micro text-faint" data-numeric>
                    ({formatNumber(row.boilerUnits)} kotyol)
                  </span>
                ) : null}
              </Td>
              <Td align="right">
                <span
                  className={cn(
                    'inline-block min-w-11 rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold ring-1 ring-inset',
                    row.total === 0
                      ? 'bg-[var(--surface-sunken)] text-faint ring-[var(--border-subtle)]'
                      : row.workingPercent >= 80
                        ? 'bg-ok-50 text-ok-700 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25'
                        : row.workingPercent >= 55
                          ? 'bg-warn-50 text-warn-700 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25'
                          : 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30',
                  )}
                  data-numeric
                >
                  {row.total === 0 ? '—' : `${row.workingPercent}%`}
                </span>
              </Td>
              <Td align="right" className="text-muted">
                <span data-numeric>
                  {formatTemperature(row.avgTemperature)}
                </span>
              </Td>
              <Td align="right" className="whitespace-nowrap">
                <span className="text-ok-700 dark:text-ok-300" data-numeric>
                  {formatNumber(row.devicesOnline)}
                </span>
                <span className="px-1 text-faint">/</span>
                <span
                  className={
                    row.devicesOffline > 0
                      ? 'font-semibold text-danger-600 dark:text-danger-300'
                      : 'text-faint'
                  }
                  data-numeric
                >
                  {formatNumber(row.devicesOffline)}
                </span>
              </Td>
              <Td align="right">
                <Count value={row.belowNorm} tone="warn" />
              </Td>
              <Td align="right">
                <Count value={row.openAlerts} tone="danger" />
              </Td>
            </Tr>
          );
        })}
        {sorted.length > 1 ? (
          /* ⚠️ Jami qatori — DISPLEY raqamlari va qalin ustki chiziq:
             ko'z jadval oxirida «natija» ni darhol topishi kerak. */
          <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]">
            <Td>
              <span className="label-eyebrow text-muted">Jami</span>
            </Td>
            <Td align="right" className={TOTAL}>
              <span data-numeric>{formatNumber(totals.total)}</span>
            </Td>
            <Td />
            <Td />
            <Td align="right" className={cn(TOTAL, 'whitespace-nowrap')}>
              <span data-numeric>
                {formatNumber(totals.devicesOnline)}
                <span className="px-1 font-sans font-normal text-faint">/</span>
                {formatNumber(totals.devicesOffline)}
              </span>
            </Td>
            <Td align="right" className={TOTAL}>
              <span data-numeric>{formatNumber(totals.belowNorm)}</span>
            </Td>
            <Td align="right" className={TOTAL}>
              <span data-numeric>{formatNumber(totals.openAlerts)}</span>
            </Td>
          </tr>
        ) : null}
      </tbody>
    </Table>
  );
}

const TOTAL =
  'font-display text-[15px] font-[740] tracking-[-0.015em] text-strong [font-stretch:106%]';

function Count({ value, tone }: { value: number; tone: 'warn' | 'danger' }) {
  if (value === 0) {
    return (
      <span className="text-faint" data-numeric>
        0
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-block min-w-7 rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold ring-1 ring-inset',
        tone === 'warn'
          ? 'bg-warn-50 text-warn-700 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25'
          : 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30',
      )}
      data-numeric
    >
      {formatNumber(value)}
    </span>
  );
}
