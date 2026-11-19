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
              className={cn(selected && 'bg-brand-50 dark:bg-brand-500/10')}
            >
              <Td
                className={cn(
                  'font-medium whitespace-nowrap',
                  selected
                    ? 'text-brand-700 dark:text-brand-300'
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
                    'rounded-full px-1.5 py-0.5 text-micro font-semibold',
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
                <span className="text-faint"> / </span>
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
          <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-muted)]">
            <Td className="font-semibold text-strong">Jami</Td>
            <Td align="right" className="font-semibold text-strong">
              <span data-numeric>{formatNumber(totals.total)}</span>
            </Td>
            <Td />
            <Td />
            <Td
              align="right"
              className="font-semibold whitespace-nowrap text-strong"
            >
              <span data-numeric>
                {formatNumber(totals.devicesOnline)} /{' '}
                {formatNumber(totals.devicesOffline)}
              </span>
            </Td>
            <Td align="right" className="font-semibold text-strong">
              <span data-numeric>{formatNumber(totals.belowNorm)}</span>
            </Td>
            <Td align="right" className="font-semibold text-strong">
              <span data-numeric>{formatNumber(totals.openAlerts)}</span>
            </Td>
          </tr>
        ) : null}
      </tbody>
    </Table>
  );
}

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
        'rounded-full px-2 py-0.5 text-micro font-semibold',
        tone === 'warn'
          ? 'bg-warn-50 text-warn-700 dark:bg-warn-400/14 dark:text-warn-300'
          : 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
      )}
      data-numeric
    >
      {formatNumber(value)}
    </span>
  );
}
