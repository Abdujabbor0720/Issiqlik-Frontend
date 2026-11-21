import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, DoorOpen, Snowflake } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { RoomsSummary } from '@/shared/api/types';
import { ROOM_CONDITION } from '@/shared/constants/status';
import {
  AnimatedNumber,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  SegmentedBar,
  Skeleton,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { boilerName } from '@/shared/utils/boiler';

/**
 * DASHBOARD: XONALAR HARORATI — viloyat (yoki tanlangan tuman) bo'yicha.
 *
 * ⚠️ Raqamlar FAQAT nazoratdagi va dolzarb o'lchovli xonalardan
 * (server qoidasi). O'lchovi eskirganlar yashirilmaydi — alohida
 * aytiladi: «N ta xonadan o'lchov kelmayapti».
 */
export function RoomsSummaryCard({
  districtId,
}: {
  districtId: string | null;
}) {
  const query = useQuery({
    queryKey: qk.roomsSummary(districtId),
    queryFn: () =>
      get<RoomsSummary>(API.rooms.summary, {
        params: districtId ? { districtId } : {},
      }),
    refetchInterval: 60_000,
  });

  const s = query.data;

  return (
    <Card>
      <CardHeader
        icon={<DoorOpen className="size-4" />}
        eyebrow="Bino ichi"
        title="Xonalar harorati"
        subtitle={
          s
            ? `Me‘yor ${s.normC} °C · eng past ruxsat ${s.minC} °C — «Sozlamalar» da o‘zgartiriladi`
            : undefined
        }
      />
      <CardBody>
        {query.isLoading ? (
          <Skeleton className="h-40" />
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !s || (s.measured === 0 && s.stale === 0) ? (
          <p className="py-6 text-center text-meta text-muted">
            Hali birorta xona harorati kelmagan. ESP32 havo datchiklarini yubora
            boshlaganda bu yerda viloyat bo‘yicha o‘rtacha va eng sovuq xonalar
            ko‘rinadi.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3.5">
              <dl className="grid grid-cols-2 gap-2">
                <Tile
                  index={0}
                  label="O‘rtacha"
                  value={formatTemperature(s.avg)}
                />
                <Tile
                  index={1}
                  label="Eng past"
                  value={formatTemperature(s.min)}
                />
                <Tile
                  index={2}
                  label="Sovuq xonalar"
                  value={`${formatNumber(s.cold)} / ${formatNumber(s.measured)}`}
                  cold={s.cold > 0}
                />
                <Tile
                  index={3}
                  label="Sovuq xonasi bor bino"
                  value={formatNumber(s.buildingsWithCold)}
                  cold={s.buildingsWithCold > 0}
                />
              </dl>

              <div>
                {/* ⚠️ Chiziq chapdan «o'sib» chiqadi (`stat-bar`, faqat
                    `transform`) — plitkalardan keyin, ko'z raqamdan
                    taqsimotga o'tgan paytda. */}
                <div className="stat-bar" style={{ '--i': 4 } as CSSProperties}>
                  <SegmentedBar
                    segments={[
                      {
                        value: s.cold,
                        className: ROOM_CONDITION.cold.dot,
                        label: `${ROOM_CONDITION.cold.label}: ${s.cold}`,
                      },
                      {
                        value: s.cool,
                        className: ROOM_CONDITION.cool.dot,
                        label: `${ROOM_CONDITION.cool.label}: ${s.cool}`,
                      },
                      {
                        value: s.normal,
                        className: ROOM_CONDITION.normal.dot,
                        label: `${ROOM_CONDITION.normal.label}: ${s.normal}`,
                      },
                    ]}
                  />
                </div>
                {/* ⚠️ Har bo'lak MATN bilan ham — rang yagona belgi emas. */}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-micro text-muted">
                  {(['cold', 'cool', 'normal'] as const).map((key) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'size-2 rounded-[3px]',
                          ROOM_CONDITION[key].dot,
                        )}
                        aria-hidden
                      />
                      {ROOM_CONDITION[key].label}
                      <span className="font-mono text-[11px] font-semibold text-strong tabular-nums">
                        {formatNumber(s[key])}
                      </span>
                    </span>
                  ))}
                </p>
                {s.stale > 0 ? (
                  <p className="mt-1.5 text-micro text-faint">
                    {formatNumber(s.stale)} ta xonadan o‘lchov kelmayapti — ular
                    hisobga kirmagan.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="label-eyebrow mb-1.5 flex items-center gap-2">
                <Snowflake className="size-3" aria-hidden />
                Eng sovuq xonalar
              </p>
              {s.coldest.length === 0 ? (
                <p className="py-3 text-meta text-muted">
                  Hamma xona me‘yorda ({s.normC} °C va undan yuqori).
                </p>
              ) : (
                <ul className="flex flex-col">
                  {s.coldest.map((item, index) => {
                    const cold = item.temperature < s.minC;
                    const meta = cold
                      ? ROOM_CONDITION.cold
                      : ROOM_CONDITION.cool;
                    return (
                      <li
                        key={item.roomId}
                        className="reveal"
                        style={
                          { '--i': Math.min(index + 2, 12) } as CSSProperties
                        }
                      >
                        {index > 0 ? (
                          <div className="mx-1.5 h-px bg-line" />
                        ) : null}
                        <Link
                          to={`/boilers/${item.boilerId}`}
                          className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-[background-color,box-shadow] duration-200 ease-out-quint hover:bg-[var(--surface-sunken)] hover:shadow-[inset_2px_0_0_var(--border-strong)] dark:hover:bg-white/[0.03]"
                        >
                          <span
                            aria-hidden
                            className="w-5 shrink-0 font-mono text-[10.5px] font-semibold text-faint tabular-nums"
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              meta.dot,
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">
                            <span className="block truncate text-ui font-semibold text-strong">
                              {item.roomName}
                            </span>
                            <span className="block truncate text-micro text-faint">
                              {boilerName(
                                item.organizationName,
                                item.lotNumber,
                              )}{' '}
                              · {item.districtName}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-display text-[15px] font-[740] tracking-[-0.02em] tabular-nums [font-stretch:108%]',
                              meta.text,
                              !cold && 'dark:text-warn-300',
                            )}
                            data-numeric
                            title={meta.label}
                          >
                            {cold ? (
                              <Snowflake
                                className="mr-0.5 inline size-3.5 align-[-1px]"
                                aria-hidden
                              />
                            ) : null}
                            {formatTemperature(item.temperature)}
                          </span>
                          <ArrowUpRight className="size-3.5 shrink-0 -translate-x-1 text-faint opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * RAQAM PLITKASI.
 *
 * ⚠️ Sovuq qiymat plitkaning O'ZINI ham ko'k tusga bo'yaydi (faqat raqamni
 * emas): to'rtta plitka ichida «muammo shu yerda» degan joy bir qarashda
 * ajralib turishi kerak.
 */
function Tile({
  label,
  value,
  cold,
  index,
}: {
  label: string;
  value: string;
  cold?: boolean;
  index: number;
}) {
  return (
    <div
      className={cn(
        'reveal relative overflow-hidden rounded-tile px-3 pt-2 pb-2.5 ring-1 ring-inset',
        cold
          ? 'bg-sky-50 ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-400/25'
          : 'bg-[var(--surface-sunken)] ring-[var(--border-subtle)]',
      )}
      style={{ '--i': index } as CSSProperties}
    >
      <dt className="label-eyebrow truncate">{label}</dt>
      <dd
        className={cn(
          'figure-display mt-1 flex items-center gap-1.5 text-[22px]',
          cold && ROOM_CONDITION.cold.text,
        )}
      >
        {cold ? <Snowflake className="size-4 shrink-0" aria-hidden /> : null}
        <AnimatedNumber value={value} />
      </dd>
    </div>
  );
}
