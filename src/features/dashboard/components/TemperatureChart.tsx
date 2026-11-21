import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { formatAxisLabel, formatDateTimeUz } from '@/shared/utils/date';
import { useUiStore } from '@/store/ui.store';

/** Chiziq rangi — brend-500 (`index.css`). ⚠️ Recharts CSS o'zgaruvchisini
 *  gradient `stop` da ishonchli o'qimaydi, shuning uchun hex. */
const LINE_HEX = '#1673d6';
const LINE_HEX_DARK = '#3b91ef';

/** Afsona qatori balandligi, px — umumiy `height` dan ayiriladi. */
const LEGEND_H = 24;

const TICK = {
  fontSize: 10.5,
  fontFamily: 'JetBrains Mono Variable, monospace',
  fill: 'var(--ink-faint)',
} as const;

/**
 * HARORAT TRENDI.
 *
 * ⚠️ MAYDON (`Area`) min–max oralig'ini ko'rsatadi, chiziq esa
 * o'rtachani. Faqat o'rtacha chizilsa, «hamma 54 °C» degan tinch
 * manzara chiqardi — holbuki o'sha paytda bir qismi 20 °C, bir qismi
 * 75 °C bo'lishi mumkin va aynan shu TARQOQLIK muammoni ko'rsatadi.
 *
 * ⚠️ Me'yor chizig'i (60 °C) FON CHIZIG'I sifatida: u `ReferenceLine`
 * emas, chunki `ReferenceLine` tooltip'da ham paydo bo'lib, uchinchi
 * qiymat bo'lib ko'rinardi. Ma'nosi esa yuqoridagi AFSONADA aytiladi.
 *
 * ⚠️ `height` — afsona BILAN birga umumiy balandlik: sahifadagi skelet
 * aynan shu o'lchamda va grafik yuklangach karta sakramaydi.
 */
export function TemperatureChart({
  data,
  bucket,
  normTemperature,
  height = 280,
}: {
  data: TrendPoint[];
  bucket: 'hour' | 'day';
  normTemperature: number;
  height?: number;
}) {
  const dark = useUiStore((state) => state.theme === 'dark');
  /* ⚠️ Gradient identifikatori NUSXAGA xos: sahifada ikkita grafik bo'lsa,
     bir xil `id` li ikkinchi `<linearGradient>` birinchisini bosib ketardi. */
  const gradientId = `tempBand-${useId().replace(/:/g, '')}`;
  const line = dark ? LINE_HEX_DARK : LINE_HEX;

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: formatAxisLabel(point.t, bucket),
        /* ⚠️ `Area` ikki qiymatli massiv bilan chiziladi
           (`[min, max]`): ikkita alohida `Area` bo'lsa, ular
           bir-birining ustiga chizilib, pastki qismi quyuqroq
           bo'lib ko'rinardi. */
        band:
          point.min !== null && point.max !== null
            ? ([point.min, point.max] as [number, number])
            : null,
      })),
    [data, bucket],
  );

  const normStroke = dark ? 'rgba(255,255,255,.28)' : 'rgba(20,45,80,.28)';

  return (
    <div style={{ height }}>
      {/* AFSONA — chiziq, maydon va me'yor nima ekanini so'z bilan aytadi. */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] font-medium tracking-[0.04em] text-muted"
        style={{ height: LEGEND_H }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[2.5px] w-4 rounded-full"
            style={{ background: line }}
          />
          O‘rtacha
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-4 rounded-[3px]"
            style={{ background: `${line}33` }}
          />
          Eng past – eng yuqori
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-4 border-t-[1.5px] border-dashed"
            style={{ borderColor: normStroke }}
          />
          Me‘yor {normTemperature} °C
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height - LEGEND_H}>
        {/* ⚠️ Chap chekinish monoshrift yorliqlarga moslangan: yuqori
            belgi kasrli bo'ladi («84,9°», `dataMax + 10`) va keng
            monoshriftda u chetdan kesilib qolardi. */}
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={line}
                stopOpacity={dark ? 0.34 : 0.26}
              />
              <stop offset="100%" stopColor={line} stopOpacity={0.03} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--border-subtle)"
            strokeDasharray="3 4"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            dy={4}
            /* ⚠️ Yorliqlar ORALATIB chiziladi: 48 ta soatlik nuqtada
               hamma yorliq ko'rsatilsa, ular bir-biriga tegib,
               o'qilmaydigan qora chiziqqa aylanardi. */
            interval="preserveStartEnd"
            minTickGap={28}
          />

          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={46}
            /*
             * ⚠️⚠️ `allowDataOverflow` SHART. Usiz Recharts berilgan
             * chegarani faqat TAVSIYA deb oladi va ma'lumotni sig'dirish
             * uchun uni KENGAYTIRADI: nosoz datchikning bitta −40 °C
             * qiymati butun o'qni −40…90 ga cho'zib, normal 50–70
             * oralig'ini o'qib bo'lmas holga keltirardi.
             *
             * ⚠️ Nosoz qiymat YO'QOLMAYDI: u telemetriyada saqlanadi,
             * kotyol kartasida va jadvalda ko'rinadi — bu yerda faqat
             * UMUMIY trend chizig'i o'qiladigan bo'lib qoladi.
             */
            allowDataOverflow
            domain={[0, 'dataMax + 10']}
            tickFormatter={(value: number) => `${value}°`}
          />

          <Tooltip
            cursor={{
              stroke: line,
              strokeOpacity: 0.35,
              strokeWidth: 1,
              strokeDasharray: '3 3',
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as TrendPoint & {
                label: string;
              };
              return (
                <div className="relative min-w-[196px] overflow-hidden rounded-[10px] bg-[var(--surface)] px-3 pt-2.5 pb-2 text-micro shadow-[var(--shadow-pop)]">
                  <span
                    aria-hidden
                    className="thermal-line absolute inset-x-0 top-0 h-[2px]"
                  />
                  <p className="font-display text-[13px] font-[720] text-strong [font-stretch:106%]">
                    {label}
                  </p>
                  <p className="font-mono text-[10.5px] text-faint">
                    {formatDateTimeUz(point.t)}
                  </p>
                  <div className="mt-2 flex flex-col gap-0.5">
                    <Row label="O‘rtacha" value={point.avg} strong />
                    <Row label="Eng past" value={point.min} />
                    <Row label="Eng yuqori" value={point.max} />
                  </div>
                  <div className="mt-2 flex gap-3 border-t border-[var(--border-subtle)] pt-1.5">
                    <Dot
                      color={BOILER_STATUS.active.hex}
                      value={point.active}
                    />
                    <Dot
                      color={BOILER_STATUS.medium.hex}
                      value={point.medium}
                    />
                    <Dot
                      color={BOILER_STATUS.inactive.hex}
                      value={point.inactive}
                    />
                    <Dot
                      color={BOILER_STATUS.offline.hex}
                      value={point.offline}
                    />
                  </div>
                </div>
              );
            }}
          />

          {/* Me'yor chizig'i — eng pastda, fon sifatida. */}
          <Line
            type="monotone"
            dataKey={() => normTemperature}
            stroke={normStroke}
            strokeDasharray="4 4"
            strokeWidth={1.2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            legendType="none"
          />

          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill={`url(#${gradientId})`}
            activeDot={false}
            animationDuration={900}
            animationEasing="ease-out"
          />

          {/* ⚠️ «Nur» — o'rtacha chiziq ostidagi keng, xira nusxa. Faqat
              bezak: nuqtasi yo'q va tooltip `payload[0]` dan o'qiydi,
              shuning uchun ikkinchi qiymat bo'lib chiqmaydi. */}
          <Line
            type="monotone"
            dataKey="avg"
            stroke={line}
            strokeOpacity={dark ? 0.22 : 0.14}
            strokeWidth={7}
            strokeLinecap="round"
            dot={false}
            activeDot={false}
            legendType="none"
            connectNulls={false}
            animationDuration={900}
            animationEasing="ease-out"
          />

          <Line
            type="monotone"
            dataKey="avg"
            stroke={line}
            strokeWidth={2.25}
            strokeLinecap="round"
            dot={false}
            activeDot={(props: { cx?: number; cy?: number }) => (
              <HaloDot cx={props.cx} cy={props.cy} color={line} />
            )}
            animationDuration={900}
            animationEasing="ease-out"
            /* ⚠️ `connectNulls` O'CHIQ: ma'lumot yo'q oraliq UZILISH
               bo'lib ko'rinishi kerak. Ulansa, o'lchov kelmagan 6 soat
               «tekis chiziq» bo'lib, hammasi joyida ko'rinardi. */
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Faol nuqta — rangli yadro va uning atrofida yumshoq nur halqasi. */
function HaloDot({
  cx,
  cy,
  color,
}: {
  cx?: number;
  cy?: number;
  color: string;
}) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.14} />
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.22} />
      <circle
        cx={cx}
        cy={cy}
        r={3.75}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </g>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-muted">{label}</span>
      <strong
        className={
          strong
            ? 'font-display text-[13px] font-[740] text-strong [font-stretch:106%]'
            : 'font-semibold text-ink'
        }
        data-numeric
      >
        {value === null ? '—' : `${value.toFixed(1).replace('.', ',')} °C`}
      </strong>
    </div>
  );
}

function Dot({ color, value }: { color: string; value: number }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10.5px] text-muted tabular-nums">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {value}
    </span>
  );
}
