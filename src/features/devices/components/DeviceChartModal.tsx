import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
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
import { Button, ErrorState, Modal, Segmented, Skeleton } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import {
  formatAxisLabel,
  formatDateTimeUz,
  formatTimeUz,
} from '@/shared/utils/date';
import { formatPercent, formatTemperature } from '@/shared/utils/format';

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

const RANGE_OPTIONS = (Object.keys(RANGES) as ChartRange[]).map((key) => ({
  value: key,
  label: RANGES[key].label,
}));

/*
 * ⚠️ Kirish/chiqish — «Muassasalar» shkalalari va kotyol kartasi bilan AYNI
 * juftlik (`--gauge-*`): bitta suv yo'nalishi uch ekranda uch xil rangda
 * bo'lmasin. CSS o'zgaruvchisi SVG atributida ishlaydi va qorong'i rejimga
 * o'zi moslashadi.
 */
const COLORS = {
  outlet: 'var(--gauge-outlet)',
  inlet: 'var(--gauge-inlet)',
  room: 'var(--color-brand-500)',
  humidity: '#0f9d8a',
};

/** O'q yorliqlari — texnik (mono), chiziqsiz. */
const AXIS_TICK = {
  fontSize: 10.5,
  fill: 'var(--ink-faint)',
  fontFamily: 'JetBrains Mono Variable, monospace',
} as const;

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

/** Faol nuqta — halqa (nur) + markaz. */
function haloDot(color: string) {
  return function HaloDot({ cx, cy }: { cx?: number; cy?: number }) {
    if (cx === undefined || cy === undefined) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.18} />
        <circle
          cx={cx}
          cy={cy}
          r={4.2}
          fill="var(--surface)"
          stroke={color}
          strokeWidth={2.25}
        />
      </g>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="xs"
            ariaLabel="Davr"
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS}
          />
          {/* ⚠️ Afsona HTML'da (Recharts `Legend` emas): u bilan shrift va
              chiziq namunasi tizim uslubida bo'ladi, punktir ham ko'rinadi. */}
          {hasData ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
              {isRoom ? (
                <>
                  <LegendSwatch color={COLORS.room} label="Xona harorati" />
                  {hasHumidity ? (
                    <LegendSwatch
                      color={COLORS.humidity}
                      label="Namlik"
                      dashed
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <LegendSwatch color={COLORS.outlet} label="Chiqish" />
                  <LegendSwatch color={COLORS.inlet} label="Kirish" dashed />
                </>
              )}
            </div>
          ) : null}
        </div>

        {query.isLoading ? (
          <Skeleton className="h-[300px]" />
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !hasData ? (
          <div className="grid-bg grid h-[300px] place-items-center rounded-tile text-meta text-muted">
            Bu davr uchun o‘lchov yo‘q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={points}
              margin={{ top: 10, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid
                stroke="var(--border-subtle)"
                strokeDasharray="3 4"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tickFormatter={formatTick}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                yAxisId="temp"
                tick={AXIS_TICK}
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
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                />
              ) : null}
              <Tooltip
                cursor={{
                  stroke: 'var(--border-strong)',
                  strokeDasharray: '3 3',
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as DeviceSeriesPoint;
                  return (
                    <div className="min-w-[188px] rounded-[10px] bg-[var(--surface)] px-3 py-2.5 text-micro shadow-[var(--shadow-pop)]">
                      <p className="font-mono text-[10.5px] font-semibold text-muted">
                        {formatDateTimeUz(point.t)}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {isRoom ? (
                          <>
                            <TipRow
                              color={COLORS.room}
                              label="Xona harorati"
                              value={formatTemperature(point.room)}
                            />
                            {hasHumidity ? (
                              <TipRow
                                color={COLORS.humidity}
                                dashed
                                label="Namlik"
                                value={
                                  point.humidity === null
                                    ? '—'
                                    : formatPercent(point.humidity)
                                }
                              />
                            ) : null}
                          </>
                        ) : (
                          <>
                            <TipRow
                              color={COLORS.outlet}
                              label="Chiqish"
                              value={formatTemperature(point.outlet)}
                            />
                            <TipRow
                              color={COLORS.inlet}
                              dashed
                              label="Kirish"
                              value={formatTemperature(point.inlet)}
                            />
                          </>
                        )}
                      </div>
                      {point.count > 1 ? (
                        <p className="mt-2 border-t border-[var(--border-subtle)] pt-1.5 font-mono text-[10.5px] text-faint tabular-nums">
                          {point.count} o‘lchov
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
              {/*
                ⚠️ Chizilish animatsiyasi (900 ms) — Recharts'ning `auto`
                rejimi: «harakatni kamaytirish» yoqilgan bo'lsa, o'zi o'chadi.
              */}
              {isRoom ? (
                <>
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="room"
                    name="Xona harorati"
                    stroke={COLORS.room}
                    strokeWidth={2.25}
                    dot={isolatedDot('room', points, COLORS.room)}
                    activeDot={haloDot(COLORS.room)}
                    animationDuration={900}
                    animationEasing="ease-out"
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
                      activeDot={haloDot(COLORS.humidity)}
                      animationDuration={900}
                      animationEasing="ease-out"
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
                    activeDot={haloDot(COLORS.inlet)}
                    animationDuration={900}
                    animationEasing="ease-out"
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="outlet"
                    name="Chiqish"
                    stroke={COLORS.outlet}
                    strokeWidth={2.25}
                    dot={isolatedDot('outlet', points, COLORS.outlet)}
                    activeDot={haloDot(COLORS.outlet)}
                    animationDuration={900}
                    animationEasing="ease-out"
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

function LegendSwatch({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line
          x1="1"
          y1="3"
          x2="17"
          y2="3"
          stroke={color}
          strokeWidth={dashed ? 1.6 : 2.4}
          strokeDasharray={dashed ? '4 3' : undefined}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}

function TipRow({
  color,
  dashed,
  label,
  value,
}: {
  color: string;
  dashed?: boolean;
  label: ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        <span
          aria-hidden
          className={cn('h-0 w-3 border-t-2', dashed && 'border-dashed')}
          style={{ borderColor: color }}
        />
        {label}
      </span>
      <strong className="font-mono font-semibold text-strong tabular-nums">
        {value}
      </strong>
    </div>
  );
}
