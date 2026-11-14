import { useMemo } from 'react';
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
 * qiymat bo'lib ko'rinardi.
 */
export function TemperatureChart({
  data,
  bucket,
  normTemperature,
  height = 260,
}: {
  data: TrendPoint[];
  bucket: 'hour' | 'day';
  normTemperature: number;
  height?: number;
}) {
  const dark = useUiStore((state) => state.theme === 'dark');

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

  const grid = dark ? 'rgba(255,255,255,.07)' : 'rgba(20,45,80,.08)';
  const axis = dark ? '#8da0b5' : '#97a5b7';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="tempBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d72bb" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#1d72bb" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={grid} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: axis }}
          tickLine={false}
          axisLine={false}
          /* ⚠️ Yorliqlar ORALATIB chiziladi: 48 ta soatlik nuqtada
             hamma yorliq ko'rsatilsa, ular bir-biriga tegib,
             o'qilmaydigan qora chiziqqa aylanardi. */
          interval="preserveStartEnd"
          minTickGap={28}
        />

        <YAxis
          tick={{ fontSize: 11, fill: axis }}
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
          cursor={{ stroke: grid, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as TrendPoint & { label: string };
            return (
              <div className="rounded-lg bg-neutral-900 px-3 py-2 text-micro text-white shadow-[var(--shadow-pop)]">
                <p className="mb-1 font-semibold">{label}</p>
                <p className="text-white/60">{formatDateTimeUz(point.t)}</p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  <Row label="O‘rtacha" value={point.avg} />
                  <Row label="Eng past" value={point.min} />
                  <Row label="Eng yuqori" value={point.max} />
                </div>
                <div className="mt-1.5 flex gap-2 border-t border-white/12 pt-1.5">
                  <Dot color={BOILER_STATUS.active.hex} value={point.active} />
                  <Dot color={BOILER_STATUS.medium.hex} value={point.medium} />
                  <Dot color={BOILER_STATUS.inactive.hex} value={point.inactive} />
                  <Dot color={BOILER_STATUS.offline.hex} value={point.offline} />
                </div>
              </div>
            );
          }}
        />

        {/* Me'yor chizig'i — eng pastda, fon sifatida. */}
        <Line
          type="monotone"
          dataKey={() => normTemperature}
          stroke={dark ? 'rgba(255,255,255,.22)' : 'rgba(20,45,80,.2)'}
          strokeDasharray="4 4"
          strokeWidth={1.2}
          dot={false}
          isAnimationActive={false}
          legendType="none"
        />

        <Area
          type="monotone"
          dataKey="band"
          stroke="none"
          fill="url(#tempBand)"
          isAnimationActive={false}
        />

        <Line
          type="monotone"
          dataKey="avg"
          stroke="#1d72bb"
          strokeWidth={2.2}
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
          isAnimationActive={false}
          /* ⚠️ `connectNulls` O'CHIQ: ma'lumot yo'q oraliq UZILISH
             bo'lib ko'rinishi kerak. Ulansa, o'lchov kelmagan 6 soat
             «tekis chiziq» bo'lib, hammasi joyida ko'rinardi. */
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-white/60">{label}</span>
      <strong className="font-semibold" data-numeric>
        {value === null ? '—' : `${value.toFixed(1).replace('.', ',')} °C`}
      </strong>
    </div>
  );
}

function Dot({ color, value }: { color: string; value: number }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-white/75">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {value}
    </span>
  );
}
