import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Cpu,
  Flame,
  Gauge,
  MapPin,
  Phone,
  Thermometer,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { Boiler, SeriesPoint } from '@/shared/api/types';
import { BOILER_STATUS, FUEL_LABELS } from '@/shared/constants/status';
import {
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Skeleton,
  StatusBadge,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import {
  formatAxisLabel,
  formatDateTimeUz,
  formatRelativeUz,
} from '@/shared/utils/date';
import { formatNumber, formatTemperature, orDash } from '@/shared/utils/format';
import { useUiStore } from '@/store/ui.store';
import { RoomsPanel } from '@/features/rooms/RoomsPanel';
import { boilerName } from '@/shared/utils/boiler';

type Range = '24h' | '7d' | '30d';

const RANGE_CONFIG: Record<
  Range,
  { label: string; bucket: 'hour' | 'day'; hours: number }
> = {
  '24h': { label: '24 soat', bucket: 'hour', hours: 24 },
  '7d': { label: '7 kun', bucket: 'hour', hours: 24 * 7 },
  '30d': { label: '30 kun', bucket: 'day', hours: 24 * 30 },
};

/**
 * KOTYOL KARTASI.
 *
 * ⚠️ Yuqorida — JORIY holat (harorat, holat, oxirgi signal), pastda —
 * hujjat ma'lumotlari. Operator bu sahifaga «hozir nima bo'lyapti»
 * degan savol bilan keladi, lot raqamini bilish uchun emas.
 */
export function BoilerDetailPage() {
  const { id = '' } = useParams();
  const [range, setRange] = useState<Range>('24h');
  const dark = useUiStore((state) => state.theme === 'dark');

  const boilerQuery = useQuery({
    queryKey: qk.boiler(id),
    queryFn: () => get<Boiler>(API.boilers.one(id)),
    enabled: Boolean(id),
  });

  const config = RANGE_CONFIG[range];

  const seriesQuery = useQuery({
    queryKey: qk.boilerSeries(id, range),
    queryFn: () =>
      get<SeriesPoint[]>(API.telemetry.series, {
        params: {
          boilerId: id,
          bucket: config.bucket,
          from: new Date(
            Date.now() - config.hours * 60 * 60 * 1000,
          ).toISOString(),
        },
      }),
    enabled: Boolean(id),
  });

  if (boilerQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }

  if (boilerQuery.isError || !boilerQuery.data) {
    return (
      <Card>
        <ErrorState
          message={errorMessage(boilerQuery.error, 'Kotyol topilmadi')}
          onRetry={() => void boilerQuery.refetch()}
        />
      </Card>
    );
  }

  const boiler = boilerQuery.data;
  const meta = BOILER_STATUS[boiler.currentStatus];
  /*
   * ⚠️ QOZONXONA moduli — kotyol harorati faqat undan keladi. Bitta binoda
   * xona modullari ham bo'lishi mumkin (ular xona haroratini beradi va
   * «Xonalar» bo'limida ko'rinadi); `devices[0]` olinsa, kotyol kartasida
   * xona moduli «ESP32 moduli» bo'lib turib qolardi.
   */
  const device = boiler.devices?.find((item) => item.deviceType === 'kotyol');
  const roomModules =
    boiler.devices?.filter((item) => item.deviceType === 'xona').length ?? 0;

  const chartData = (seriesQuery.data ?? []).map((point) => ({
    ...point,
    label: formatAxisLabel(point.t, config.bucket),
  }));

  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/boilers"
        className="inline-flex w-fit items-center gap-1.5 px-1 text-meta font-medium text-muted transition-colors hover:text-strong"
      >
        <ArrowLeft className="size-3.5" />
        Kotyollar ro‘yxatiga
      </Link>

      {/* ───── Joriy holat ───── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sub font-semibold tracking-tight text-strong">
                {boilerName(boiler.organization?.name, boiler.lotNumber)}
              </h1>
              <StatusBadge status={boiler.currentStatus} />
              {boiler.isArchived ? (
                <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-micro text-faint">
                  Arxivlangan
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-meta text-muted">
              {boiler.district?.name}
              {boiler.lotNumber ? ` · Lot ${boiler.lotNumber}` : ''}
              {boiler.address ? ` · ${boiler.address}` : ''}
            </p>
          </div>

          {/* ⚠️ Harorat — eng katta raqam: sahifaning butun mohiyati
              shu. Qolgan hamma narsa uni tushuntiradi. */}
          <div className="text-right">
            <div
              className="text-mega font-semibold tracking-tight"
              style={{ color: meta.hex }}
              data-numeric
            >
              {formatTemperature(boiler.lastTemperature)}
            </div>
            <p className="text-meta text-muted">
              {boiler.lastReadingAt
                ? `Oxirgi signal: ${formatRelativeUz(boiler.lastReadingAt)}`
                : 'Hali signal kelmagan'}
            </p>
          </div>
        </div>

        <div className="h-px bg-line" />

        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] sm:grid-cols-4">
          <Metric
            icon={Flame}
            label="Kotyol soni"
            value={formatNumber(boiler.boilerCount)}
          />
          <Metric
            icon={Gauge}
            label="60° norma"
            value={
              boiler.normAt60 === null ? '—' : formatNumber(boiler.normAt60)
            }
          />
          <Metric
            icon={Thermometer}
            label="Bugungi o‘rtacha"
            value={formatTemperature(boiler.todayAvgTemperature)}
          />
          <Metric
            icon={Cpu}
            label="ESP32 moduli"
            value={device ? device.deviceId : 'ulanmagan'}
            tone={device ? 'default' : 'muted'}
          />
        </div>
      </Card>

      {/* ───── Grafik ───── */}
      <Card>
        <CardHeader
          icon={<Thermometer className="size-4" />}
          eyebrow="Telemetriya"
          title="Harorat: chiqish va kirish"
          subtitle="To‘q chiziq — chiqish (podacha), punktir — kirish (obratka). Ayirma kichik bo‘lsa, suv aylanmayapti."
          actions={
            <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
              {(Object.keys(RANGE_CONFIG) as Range[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={
                    range === key
                      ? 'rounded-full bg-[var(--surface)] px-2.5 py-1 text-micro font-semibold text-strong shadow-[var(--shadow-hair)]'
                      : 'rounded-full px-2.5 py-1 text-micro font-medium text-muted transition-colors hover:text-strong'
                  }
                >
                  {RANGE_CONFIG[key].label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          {seriesQuery.isLoading ? (
            <Skeleton className="h-[280px]" />
          ) : chartData.length === 0 ? (
            <div className="grid h-[280px] place-items-center text-meta text-muted">
              Bu davr uchun o‘lchov yo‘q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
              >
                <defs>
                  <linearGradient id="boilerTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.hex} stopOpacity={0.26} />
                    <stop
                      offset="100%"
                      stopColor={meta.hex}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={dark ? 'rgba(255,255,255,.07)' : 'rgba(20,45,80,.08)'}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: dark ? '#8da0b5' : '#97a5b7' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: dark ? '#8da0b5' : '#97a5b7' }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  /*
                   * ⚠️ Bu yerda `allowDataOverflow` ATAYLAB YO'Q —
                   * dashboard grafigidan farqli o'laroq.
                   *
                   * Dashboard O'NLAB kotyolning o'rtachasini
                   * ko'rsatadi va bitta nosoz datchik (−40 °C) butun
                   * o'qni cho'zib, qolganlarini o'qilmas qilardi.
                   * Bu yerda esa grafik AYNAN shu kotyolniki: nosoz
                   * qiymat — muammoning O'ZI va u ko'rinishi kerak.
                   */
                  domain={[0, 'dataMax + 10']}
                  tickFormatter={(value: number) => `${value}°`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as SeriesPoint & {
                      label: string;
                    };
                    return (
                      <div className="rounded-lg bg-neutral-900 px-3 py-2 text-micro text-white shadow-[var(--shadow-pop)]">
                        <p className="font-semibold">
                          {formatDateTimeUz(point.t)}
                        </p>
                        <p className="mt-1">
                          O‘rtacha:{' '}
                          <strong>{formatTemperature(point.avg)}</strong>
                        </p>
                        {/*
                          WARN: AYIRMA ko'rsatiladi, chunki aynan u
                          "issiqlik binoga boryaptimi" degan savolga
                          javob beradi. Ikki sonni foydalanuvchi o'zi
                          ayirib yurishi kerak bo'lmasligi kerak.
                        */}
                        {point.inletAvg !== null ? (
                          <p className="mt-0.5">
                            Kirish:{' '}
                            <strong>{formatTemperature(point.inletAvg)}</strong>
                            {point.avg !== null ? (
                              <span className="text-white/65">
                                {' '}
                                · ayirma{' '}
                                {formatTemperature(
                                  Math.round(
                                    (point.avg - point.inletAvg) * 100,
                                  ) / 100,
                                )}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        <p className="text-white/65">
                          {formatTemperature(point.min)} —{' '}
                          {formatTemperature(point.max)} · {point.count} o‘lchov
                        </p>
                      </div>
                    );
                  }}
                />
                {/*
                  WARN WARN: KIRISH CHIZIG'I CHIQISHDAN OLDIN chiziladi.
                  Recharts elementlarni e'lon TARTIBIDA ustma-ust
                  qo'yadi va chiqish (asosiy qiymat) TEPADA turishi
                  kerak. Teskari bo'lsa, ingichka obratka chizig'i
                  asosiy chiziqni kesib o'tib, o'qish qiyinlashardi.

                  WARN: To'ldirish YO'Q (fill="none"): ikkita
                  to'ldirilgan maydon ustma-ust tushib, ikkalasining
                  rangi ham buzilardi va qaysi biri qaysi quvur ekani
                  bilinmasdi. Punktir chiziq esa ranglardan
                  QAT'I NAZAR ajralib turadi - shu jumladan
                  rang ko'rmaydigan foydalanuvchi uchun ham.
                */}
                <Area
                  type="monotone"
                  dataKey="inletAvg"
                  name="Kirish"
                  stroke={dark ? '#7c93ab' : '#94a3b8'}
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                  fill="none"
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="avg"
                  name="Chiqish"
                  stroke={meta.hex}
                  strokeWidth={2.2}
                  fill="url(#boilerTemp)"
                  isAnimationActive={false}
                  /* ⚠️ `connectNulls` O'CHIQ: ma'lumot kelmagan oraliq
                     UZILISH bo'lib ko'rinishi kerak. Ulansa, signal
                     bo'lmagan 6 soat «tekis chiziq» bo'lib, hammasi
                     joyida ko'rinardi. */
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* ───── Xonalar (havo harorati) ─────
          ⚠️ Kotyol grafigidan KEYIN: avval «qozon ishlayaptimi», keyin
          «issiqlik xonalarga yetib boryaptimi» — sabab-oqibat tartibi. */}
      <RoomsPanel boilerId={id} />

      {/* ───── Hujjat ma'lumotlari ───── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Building2 className="size-4" />}
            eyebrow="Hujjat"
            title="Qozonxona ma‘lumotlari"
          />
          <CardBody className="flex flex-col gap-0">
            <Row label="Tuman / shahar" value={boiler.district?.name} />
            <Row label="Lot raqami" value={boiler.lotNumber ?? '—'} />
            <Row label="DXSH firma nomi" value={boiler.firm?.name} />
            <Row label="Tashkilot nomi" value={boiler.organization?.name} />
            <Row label="Kotyol markasi" value={boiler.brand?.name} />
            <Row label="Kotyol soni" value={String(boiler.boilerCount)} />
            <Row
              label="60 gradusda norma"
              value={
                boiler.normAt60 === null ? null : formatNumber(boiler.normAt60)
              }
            />
            <Row label="Yoqilg‘i" value={FUEL_LABELS[boiler.fuelType]} />
            <Row
              label="Quvvat"
              value={
                boiler.capacityKw === null
                  ? null
                  : `${formatNumber(boiler.capacityKw)} kVt`
              }
            />
            <Row
              label="O‘rnatilgan yil"
              value={
                boiler.installedYear === null
                  ? null
                  : String(boiler.installedYear)
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<MapPin className="size-4" />}
            eyebrow="Joylashuv va mas‘ul"
            title="Qo‘shimcha ma‘lumot"
          />
          <CardBody className="flex flex-col gap-0">
            <Row label="Manzil" value={boiler.address} />
            <Row
              label="Koordinata"
              value={
                boiler.lat !== null && boiler.lng !== null
                  ? `${boiler.lat}, ${boiler.lng}`
                  : null
              }
              hint={
                boiler.lat === null
                  ? 'Koordinatasiz kotyol xaritada nuqta bo‘lib chizilmaydi'
                  : undefined
              }
            />
            <Row
              label="Mas‘ul shaxs"
              value={boiler.responsibleName}
              icon={User}
            />
            <Row label="Telefon" value={boiler.responsiblePhone} icon={Phone} />
            <Row
              label="ESP32 moduli"
              value={
                device ? `${device.deviceId} (${device.name ?? '—'})` : null
              }
              hint={
                (device
                  ? device.lastSeenAt
                    ? `Oxirgi aloqa: ${formatRelativeUz(device.lastSeenAt)}`
                    : 'Hali signal kelmagan'
                  : 'Modul ulanmagan — telemetriya kelmaydi') +
                (roomModules > 0 ? ` · Xona modullari: ${roomModules} ta` : '')
              }
            />
            <Row label="Izoh" value={boiler.note} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone?: 'default' | 'muted';
}) {
  return (
    <div className="flex items-center gap-2.5 bg-[var(--surface)] px-5 py-3.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-tile bg-[var(--surface-sunken)] text-muted">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-micro text-muted">{label}</p>
        <p
          className={cn(
            'truncate text-ui font-semibold',
            tone === 'muted' ? 'text-faint' : 'text-strong',
          )}
          data-numeric
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
  icon?: typeof Flame;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-cell)] py-2.5 last:border-0">
      <span className="flex shrink-0 items-center gap-1.5 text-meta text-muted">
        {Icon ? <Icon className="size-3.5 opacity-70" /> : null}
        {label}
      </span>
      <span className="min-w-0 text-right">
        <span className="block truncate text-ui font-medium text-strong">
          {orDash(value)}
        </span>
        {hint ? (
          <span className="block text-micro text-faint">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}
