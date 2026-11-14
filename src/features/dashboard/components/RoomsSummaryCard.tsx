import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Snowflake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { RoomsSummary } from '@/shared/api/types';
import { ROOM_CONDITION } from '@/shared/constants/status';
import {
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  SegmentedBar,
  Skeleton,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';

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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-2">
                <Tile label="O‘rtacha" value={formatTemperature(s.avg)} />
                <Tile label="Eng past" value={formatTemperature(s.min)} />
                <Tile
                  label="Sovuq xonalar"
                  value={`${formatNumber(s.cold)} / ${formatNumber(s.measured)}`}
                  cold={s.cold > 0}
                />
                <Tile
                  label="Sovuq xonasi bor bino"
                  value={formatNumber(s.buildingsWithCold)}
                  cold={s.buildingsWithCold > 0}
                />
              </dl>

              <div>
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
                {/* ⚠️ Har bo'lak MATN bilan ham — rang yagona belgi emas. */}
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-micro text-muted">
                  {(['cold', 'cool', 'normal'] as const).map((key) => (
                    <span key={key} className="flex items-center gap-1">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          ROOM_CONDITION[key].dot,
                        )}
                        aria-hidden
                      />
                      {ROOM_CONDITION[key].label}: {formatNumber(s[key])}
                    </span>
                  ))}
                </p>
                {s.stale > 0 ? (
                  <p className="mt-1 text-micro text-faint">
                    {formatNumber(s.stale)} ta xonadan o‘lchov kelmayapti — ular
                    hisobga kirmagan.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-ui font-medium text-strong">
                Eng sovuq xonalar
              </p>
              {s.coldest.length === 0 ? (
                <p className="py-3 text-meta text-muted">
                  Hamma xona me‘yorda ({s.normC} °C va undan yuqori).
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {s.coldest.map((item) => {
                    const cold = item.temperature < s.minC;
                    const meta = cold
                      ? ROOM_CONDITION.cold
                      : ROOM_CONDITION.cool;
                    return (
                      <li key={item.roomId}>
                        <Link
                          to={`/boilers/${item.boilerId}`}
                          className="flex items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-[var(--surface-sunken)]"
                        >
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              meta.dot,
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-ui text-strong">
                              {item.roomName}
                            </span>
                            <span className="block truncate text-micro text-faint">
                              {item.organizationName ?? `Lot ${item.lotNumber}`}{' '}
                              · {item.districtName}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-semibold tabular-nums',
                              meta.text,
                            )}
                            data-numeric
                            title={meta.label}
                          >
                            {cold ? (
                              <Snowflake
                                className="mr-0.5 inline size-3.5 align-[-2px]"
                                aria-hidden
                              />
                            ) : null}
                            {formatTemperature(item.temperature)}
                          </span>
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

function Tile({
  label,
  value,
  cold,
}: {
  label: string;
  value: string;
  cold?: boolean;
}) {
  return (
    <div className="rounded-tile bg-[var(--surface-sunken)] px-3 py-2">
      <dt className="text-micro text-muted">{label}</dt>
      <dd
        className={cn(
          'text-lede font-semibold tabular-nums text-strong',
          cold && ROOM_CONDITION.cold.text,
        )}
        data-numeric
      >
        {value}
      </dd>
    </div>
  );
}
