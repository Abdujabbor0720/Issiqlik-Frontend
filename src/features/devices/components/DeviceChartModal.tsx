import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DeviceRow,
  DeviceSeries,
  DeviceSeriesPoint,
} from '@/shared/api/types';
import { DEVICE_TYPE_META } from '@/shared/constants/device-type';
import { Button, ErrorState, Modal, Skeleton } from '@/shared/ui';
import {
  formatAxisLabel,
  formatDateTimeUz,
  formatTimeUz,
} from '@/shared/utils/date';
import { formatPercent, formatTemperature } from '@/shared/utils/format';
import { useUiStore } from '@/store/ui.store';

type ChartRange = '24h' | '7d' | '30d';

/*
 * ⚠️ 24 soat — XOM o'lchovlar (`raw`): yakka datchik o'lchovi aynan
 * o'z chizig'ida ko'rinishi uchun. Soatlik o'rtacha bu farqni yashirardi.
 * `limit` — server chegarasi (5000): qurilma daqiqada bir yuboradi,
 * 24 soat ≈ 1440 nuqta.
 */
const RANGES: Record<
  ChartRange,
  { label: string; bucket: 'raw' | 'hour' | 'day'; hours: number }
> = {
  '24h': { label: '24 soat', bucket: 'raw', hours: 24 },
  '7d': { label: '7 kun', bucket: 'hour', hours: 24 * 7 },
  '30d': { label: '30 kun', bucket: 'day', hours: 24 * 30 },
};

const COLORS = {
  outlet: '#d9480f',
  inlet: '#1d72bb',
  room: '#1d72bb',
  humidity: '#0f9d8a',
};

type SeriesKey = 'inlet' | 'outlet' | 'room' | 'humidity';

/**
 * YAKKA NUQTA BELGISI.
 *
 * ⚠️ `connectNulls` o'chiq: `null` — UZILISH. Ikki tomoni ham `null`
 * bo'lgan nuqta esa chiziq hosil qilmaydi va nuqtasiz butunlay
 * ko'rinmay qolardi (masalan kirish datchigi bitta o'lchov bergan).
 * Shuning uchun faqat shunday YOLG'IZ nuqtalar doira bilan chiziladi —
 * hamma nuqtaga doira qo'yilsa, 1440 ta nuqta chiziqni ko'mib yuborardi.
 */
function isolatedDot(
  key: SeriesKey,
  points: readonly DeviceSeriesPoint[],
  color: string,
) {
  return function IsolatedDot(props: DotItemDotProps) {
    const { cx, cy, index } = props;
    const current = points[index]?.[key];
    const prev = points[index - 1]?.[key];
    const next = points[index + 1]?.[key];
    const isolated =
      current !== null &&
      current !== undefined &&
      (prev === null || prev === undefined) &&
      (next === null || next === undefined);
    if (!isolated || cx === undefined || cy === undefined) {
      return <g key={`${key}-${index}`} />;
    }
    return (
      <circle
        key={`${key}-${index}`}
        cx={cx}
        cy={cy}
        r={2.5}
        fill={color}
        stroke="none"
      />
    );
  };
}

/**
 * QURILMA GRAFIGI.
 *
 * ⚠️⚠️ Kotyol moduli — IKKI chiziq: «Kirish» (obratka) va «Chiqish».
 * Yakka datchik o'lchovida ikkinchi qiymat `null` keladi va u NOL EMAS:
 * grafik uni uzilish sifatida ko'rsatadi. Nol bilan to'ldirilsa, «suv
 * 0 °C» degan yolg'on keskin tushish paydo bo'lardi.
 */
export function DeviceChartModal({
  device,
  onClose,
}: {
  device: DeviceRow | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<ChartRange>('24h');
  const dark = useUiStore((state) => state.theme === 'dark');
  const config = RANGES[range];

  const query = useQuery({
    queryKey: qk.deviceSeries(device?.id ?? '', range),
    queryFn: () =>
      get<DeviceSeries>(API.telemetry.deviceSeries(device?.id ?? ''), {
        params: {
          bucket: config.bucket,
          from: new Date(
            Date.now() - config.hours * 60 * 60 * 1000,
          ).toISOString(),
          to: new Date().toISOString(),
          limit: 5000,
        },
      }),
    enabled: device !== null,
  });

  const points = useMemo(() => query.data?.points ?? [], [query.data]);
  const deviceType = query.data?.deviceType ?? device?.deviceType ?? 'kotyol';
  const isRoom = deviceType === 'xona';
  const hasHumidity = points.some((point) => point.humidity !== null);
  const hasData = points.some((point) =>
    isRoom
      ? point.room !== null || point.humidity !== null
      : point.inlet !== null || point.outlet !== null,
  );

  const tickColor = dark ? '#8da0b5' : '#97a5b7';
  const formatTick = (value: string): string =>
    config.bucket === 'raw'
      ? formatTimeUz(value)
      : formatAxisLabel(value, 'day');

  return (
    <Modal
      open={device !== null}
      onClose={onClose}
      size="lg"
      title={device ? `${device.deviceId} — grafik` : 'Grafik'}
      description={
        device
          ? `${DEVICE_TYPE_META[deviceType].label}${
              device.location.institution
                ? ` · ${device.location.institution.name}`
                : ''
            }`
          : undefined
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Davr"
          className="flex w-fit rounded-full bg-[var(--surface-sunken)] p-0.5"
        >
          {(Object.keys(RANGES) as ChartRange[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => setRange(key)}
              className={
                range === key
                  ? 'rounded-full bg-[var(--surface)] px-2.5 py-1 text-micro font-semibold text-strong shadow-[var(--shadow-hair)]'
                  : 'rounded-full px-2.5 py-1 text-micro font-medium text-muted transition-colors hover:text-strong'
              }
            >
              {RANGES[key].label}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <Skeleton className="h-[300px]" />
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !hasData ? (
          <div className="grid h-[300px] place-items-center text-meta text-muted">
            Bu davr uchun o‘lchov yo‘q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid
                stroke={dark ? 'rgba(255,255,255,.07)' : 'rgba(20,45,80,.08)'}
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tickFormatter={formatTick}
                tick={{ fontSize: 11, fill: tickColor }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                yAxisId="temp"
                tick={{ fontSize: 11, fill: tickColor }}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={['auto', 'auto']}
                tickFormatter={(value: number) => `${value}°`}
              />
              {isRoom && hasHumidity ? (
                <YAxis
                  yAxisId="humidity"
                  orientation="right"
                  tick={{ fontSize: 11, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                />
              ) : null}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as DeviceSeriesPoint;
                  return (
                    <div className="rounded-lg bg-neutral-900 px-3 py-2 text-micro text-white shadow-[var(--shadow-pop)]">
                      <p className="font-semibold">
                        {formatDateTimeUz(point.t)}
                      </p>
                      {isRoom ? (
                        <>
                          <p className="mt-1">
                            Xona harorati:{' '}
                            <strong>{formatTemperature(point.room)}</strong>
                          </p>
                          {hasHumidity ? (
                            <p className="mt-0.5">
                              Namlik:{' '}
                              <strong>
                                {point.humidity === null
                                  ? '—'
                                  : formatPercent(point.humidity)}
                              </strong>
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="mt-1">
                            Chiqish:{' '}
                            <strong>{formatTemperature(point.outlet)}</strong>
                          </p>
                          <p className="mt-0.5">
                            Kirish:{' '}
                            <strong>{formatTemperature(point.inlet)}</strong>
                          </p>
                        </>
                      )}
                      {point.count > 1 ? (
                        <p className="text-white/65">{point.count} o‘lchov</p>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="plainline"
                wrapperStyle={{ fontSize: 12 }}
              />
              {isRoom ? (
                <>
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="room"
                    name="Xona harorati"
                    stroke={COLORS.room}
                    strokeWidth={2}
                    dot={isolatedDot('room', points, COLORS.room)}
                    activeDot={{ r: 3.5 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  {hasHumidity ? (
                    <Line
                      yAxisId="humidity"
                      type="monotone"
                      dataKey="humidity"
                      name="Namlik"
                      stroke={COLORS.humidity}
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                      dot={isolatedDot('humidity', points, COLORS.humidity)}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  {/*
                    ⚠️ Kirish chizig'i OLDIN (ostida) va punktir: chiqish —
                    asosiy qiymat va u tepada turadi; punktir esa rangni
                    ajrata olmaydigan foydalanuvchi uchun ham farq beradi.
                  */}
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="inlet"
                    name="Kirish"
                    stroke={COLORS.inlet}
                    strokeWidth={1.6}
                    strokeDasharray="4 3"
                    dot={isolatedDot('inlet', points, COLORS.inlet)}
                    activeDot={{ r: 3 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="outlet"
                    name="Chiqish"
                    stroke={COLORS.outlet}
                    strokeWidth={2.2}
                    dot={isolatedDot('outlet', points, COLORS.outlet)}
                    activeDot={{ r: 3.5 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {!isRoom && hasData ? (
          <p className="text-micro text-faint">
            Chiziqdagi uzilish — o‘sha paytda datchik qiymat bermagan (nol
            emas). Yakka nuqta — faqat bitta datchik o‘lchagan payt.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
