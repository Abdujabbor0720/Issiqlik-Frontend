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
import { useState, type ReactNode } from 'react';
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
import {
  BOILER_STATUS,
  FUEL_LABELS,
  temperatureHex,
} from '@/shared/constants/status';
import {
  AnimatedNumber,
  Badge,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PageHeader,
  Segmented,
  Skeleton,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import {
  formatAxisLabel,
  formatDateTimeUz,
  formatRelativeUz,
} from '@/shared/utils/date';
import { formatNumber, formatTemperature, orDash } from '@/shared/utils/format';
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

const RANGE_OPTIONS = (Object.keys(RANGE_CONFIG) as Range[]).map((key) => ({
  value: key,
  label: RANGE_CONFIG[key].label,
}));

/*
 * ⚠️ Grafik ranglari — suv YO'NALISHI (kirish ko'k, chiqish issiq), holat
 * rangi EMAS: «Muassasalar» shkalalari bilan AYNI juftlik (`--gauge-*`,
 * dataviz validatori bilan tekshirilgan). Chiziq holat rangida bo'lsa,
 * holat o'zgarganda butun tarix boshqa rangga bo'yalib qolardi, sariq
 * chiziq esa «o'rta ishlayapti» deb o'qilardi. Holat — yuqoridagi panelda.
 */
const OUTLET = 'var(--gauge-outlet)';
const INLET = 'var(--gauge-inlet)';

/** O'q yorliqlari — texnik (mono), chiziqsiz. */
const AXIS_TICK = {
  fontSize: 10.5,
  fill: 'var(--ink-faint)',
  fontFamily: 'JetBrains Mono Variable, monospace',
} as const;

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
        <div className="flex items-start gap-3 px-1 pt-1">
          <Skeleton className="mt-5 size-9" />
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-8 w-72 max-w-[70vw]" />
          </div>
        </div>
        <Skeleton className="h-[300px] rounded-card" />
        <Skeleton className="h-80 rounded-card" />
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
  const live = boiler.currentStatus !== 'offline';
  const current = splitTemperature(boiler.lastTemperature);
  const today = splitTemperature(boiler.todayAvgTemperature);
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
      <PageHeader
        leading={
          <Link
            to="/boilers"
            aria-label="Kotyollar ro‘yxatiga"
            title="Kotyollar ro‘yxatiga"
            className="group grid size-9 place-items-center rounded-lg bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] transition-[box-shadow,color,transform] duration-200 ease-out-quint hover:text-strong hover:shadow-[var(--shadow-raise)] active:scale-95 dark:bg-white/[0.04]"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 ease-out-expo group-hover:-translate-x-0.5" />
          </Link>
        }
        eyebrow={`Kotyol kartasi${
          boiler.district ? ` · ${boiler.district.shortName}` : ''
        }`}
        title={boilerName(boiler.organization?.name, boiler.lotNumber)}
        subtitle={
          <>
            {boiler.district?.name}
            {boiler.lotNumber ? ` · Lot ${boiler.lotNumber}` : ''}
            {boiler.address ? ` · ${boiler.address}` : ''}
          </>
        }
        actions={
          boiler.isArchived ? (
            <Badge className="bg-[var(--surface-sunken)] text-faint ring-1 ring-[var(--border-subtle)] ring-inset">
              Arxivlangan
            </Badge>
          ) : null
        }
      />

      {/* ───── Joriy holat ─────
          ⚠️ Harorat — eng katta raqam: sahifaning butun mohiyati shu.
          Qolgan hamma narsa uni tushuntiradi. Raqamning o'zi NEYTRAL
          rangda (sariq yoki kulrang katta raqam oq fonda o'qilmaydi) —
          holat rangi chiroq, chekka chiziq, nur va shkalada. */}
      <Card className="isolate overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: meta.hex,
            boxShadow: `0 0 18px ${meta.hex}`,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-28 -z-10 size-96 rounded-full opacity-[0.11] blur-3xl dark:opacity-[0.2]"
          style={{ background: meta.hex }}
        />
        <span
          aria-hidden
          className="grid-bg pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(110%_100%_at_0%_0%,#000,transparent_62%)]"
        />

        <div className="flex flex-col gap-7 p-5 sm:p-6 lg:flex-row lg:gap-0">
          {/* Raqamlar */}
          <div className="min-w-0 flex-1 lg:pr-8">
            <p className="label-eyebrow flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-1 rounded-full"
                style={{ backgroundColor: OUTLET }}
              />
              Chiqish harorati · joriy
            </p>
            <div className="mt-3 flex items-start gap-1.5">
              {/* ⚠️ O'lchov yo'q bo'lsa «—» XIRA: 96 px displey shriftida u
                  qora to'rtburchak bo'lib, «qiymat» deb o'qilardi. */}
              <AnimatedNumber
                value={current.figure}
                className={cn(
                  'figure-display text-[68px] leading-[0.84] sm:text-[96px]',
                  !current.unit && '!text-[var(--border-strong)]',
                )}
              />
              {current.unit ? (
                <span className="mt-1 font-mono text-[15px] font-semibold text-muted sm:mt-2.5 sm:text-[18px]">
                  {current.unit}
                </span>
              ) : null}
            </div>

            <dl className="mt-6 grid max-w-md grid-cols-2 gap-4 border-t border-dashed border-[var(--border-subtle)] pt-4">
              <div className="min-w-0">
                <dt className="label-eyebrow">Bugungi o‘rtacha</dt>
                <dd className="mt-1.5 flex items-baseline gap-1">
                  <AnimatedNumber
                    value={today.figure}
                    className="figure-display text-[26px]"
                  />
                  {today.unit ? (
                    <span className="font-mono text-micro font-semibold text-muted">
                      {today.unit}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="label-eyebrow">Oxirgi signal</dt>
                <dd
                  className="mt-2 truncate text-lede font-semibold text-strong"
                  title={
                    boiler.lastReadingAt
                      ? formatDateTimeUz(boiler.lastReadingAt)
                      : undefined
                  }
                >
                  {boiler.lastReadingAt
                    ? formatRelativeUz(boiler.lastReadingAt)
                    : 'Hali signal kelmagan'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Holat */}
          <div className="border-t border-[var(--border-subtle)] pt-5 lg:w-[380px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <p className="label-eyebrow">Holat</p>
            <div className="mt-3 flex items-center gap-3">
              <StatusLamp hex={meta.hex} live={live} />
              <span className="font-display text-[22px] leading-tight font-[760] tracking-[-0.02em] text-strong [font-stretch:110%]">
                {meta.label}
              </span>
            </div>
            <p className="mt-1 text-meta text-muted">{meta.description}</p>
            <HeatScale
              value={boiler.lastTemperature}
              live={live}
              className="mt-5"
            />
          </div>
        </div>

        <div className="h-px bg-line" />

        <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
            icon={Cpu}
            label="ESP32 moduli"
            value={device ? device.deviceId : 'ulanmagan'}
            tone={device ? 'default' : 'muted'}
            mono={Boolean(device)}
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
            <Segmented
              size="xs"
              ariaLabel="Davr"
              value={range}
              onChange={setRange}
              options={RANGE_OPTIONS}
            />
          }
        />
        <CardBody>
          <div className="mb-2 flex items-center gap-4 font-mono text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            <LegendSwatch color={OUTLET} label="Chiqish" />
            <LegendSwatch color={INLET} label="Kirish" dashed />
          </div>
          {seriesQuery.isLoading ? (
            <Skeleton className="h-[280px]" />
          ) : chartData.length === 0 ? (
            <div className="grid-bg grid h-[280px] place-items-center rounded-tile text-meta text-muted">
              Bu davr uchun o‘lchov yo‘q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 8, bottom: 0, left: -14 }}
              >
                <defs>
                  <linearGradient id="boilerTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUTLET} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={OUTLET} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={AXIS_TICK}
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
                  cursor={{
                    stroke: 'var(--border-strong)',
                    strokeDasharray: '3 3',
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as SeriesPoint & {
                      label: string;
                    };
                    return (
                      <ChartTip time={formatDateTimeUz(point.t)}>
                        <TipRow
                          color={OUTLET}
                          label="Chiqish"
                          value={formatTemperature(point.avg)}
                        />
                        {/*
                          WARN: AYIRMA ko'rsatiladi, chunki aynan u
                          "issiqlik binoga boryaptimi" degan savolga
                          javob beradi. Ikki sonni foydalanuvchi o'zi
                          ayirib yurishi kerak bo'lmasligi kerak.
                        */}
                        {point.inletAvg !== null ? (
                          <>
                            <TipRow
                              color={INLET}
                              dashed
                              label="Kirish"
                              value={formatTemperature(point.inletAvg)}
                            />
                            {point.avg !== null ? (
                              <TipRow
                                label="Ayirma"
                                value={formatTemperature(
                                  Math.round(
                                    (point.avg - point.inletAvg) * 100,
                                  ) / 100,
                                )}
                              />
                            ) : null}
                          </>
                        ) : null}
                        <p className="mt-2 border-t border-[var(--border-subtle)] pt-1.5 font-mono text-[10.5px] text-faint tabular-nums">
                          {formatTemperature(point.min)} —{' '}
                          {formatTemperature(point.max)} · {point.count} o‘lchov
                        </p>
                      </ChartTip>
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

                  ⚠️ Chizilish animatsiyasi (900 ms) — Recharts'ning
                  `auto` rejimi: «harakatni kamaytirish» yoqilgan
                  bo'lsa, o'zi o'chadi.
                */}
                <Area
                  type="monotone"
                  dataKey="inletAvg"
                  name="Kirish"
                  stroke={INLET}
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                  fill="none"
                  activeDot={haloDot(INLET)}
                  animationDuration={900}
                  animationEasing="ease-out"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="avg"
                  name="Chiqish"
                  stroke={OUTLET}
                  strokeWidth={2.25}
                  fill="url(#boilerTemp)"
                  activeDot={haloDot(OUTLET)}
                  animationDuration={900}
                  animationEasing="ease-out"
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
            <Row label="Lot raqami" value={boiler.lotNumber ?? '—'} mono />
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
              mono
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

/**
 * «54,5 °C» → «54,5» + «°C».
 *
 * ⚠️ Raqam formati `formatTemperature` niki (vergul, bitta kasr) — bu yerda
 * faqat BIRLIK ajratiladi: katta raqam yonida «°C» kichik yoziladi. Raqamni
 * qaytadan formatlash ikkinchi qoidaga aylanib, sahifalar orasida «54.5» va
 * «54,5» aralashib ketardi.
 */
function splitTemperature(value: number | null): {
  figure: string;
  unit: string | null;
} {
  const text = formatTemperature(value);
  const match = /^(.*?)\s*(°C)$/u.exec(text);
  return match
    ? { figure: match[1], unit: match[2] }
    : { figure: text, unit: null };
}

/** Holat chirog'i — jonli bo'lsa sekin to'lqin tarqatadi. */
function StatusLamp({ hex, live }: { hex: string; live: boolean }) {
  return (
    <span className="relative flex size-3.5 shrink-0" aria-hidden>
      {live ? (
        <span
          className="live-ping absolute inset-0 rounded-full"
          style={{ backgroundColor: hex }}
        />
      ) : null}
      <span
        className="relative size-3.5 rounded-full"
        style={{
          backgroundColor: hex,
          boxShadow: `0 0 0 3px ${hex}2e, 0 0 16px ${hex}`,
        }}
      />
    </span>
  );
}

/** 0–100 °C, har bo'lak 2 °C. */
const SCALE_SEGMENTS = 50;
const SCALE_STEP = 100 / SCALE_SEGMENTS;

/**
 * HARORAT LENTASI — 50 bo'lakli indikator (nazorat pulti uslubida).
 *
 * ⚠️ Bo'lak rangi `temperatureHex()` dan: holat chegaralari BITTA joyda
 * (`status.ts`). Chegara o'zgarsa, lenta o'zi moslashadi — bu yerda
 * «50 °C dan yashil» degan ikkinchi nusxa yo'q. Yoqilmagan bo'laklar ham
 * o'z rangida, faqat xira: operator «yashil zona qayerdan boshlanadi» ni
 * raqamsiz ko'radi.
 *
 * ⚠️ Faqat `opacity`: jonli kotyolda yoqilgan bo'laklar chapdan o'ngga
 * ketma-ket «yonadi» (`gauge-flash`; harakat kamaytirilsa — o'chadi).
 * Aloqa yo'q bo'lsa — oxirgi qiymat xira va harakatsiz (eskirgan raqam
 * jonli bilan bir xil ko'rinmasin).
 */
function HeatScale({
  value,
  live,
  className,
}: {
  value: number | null;
  live: boolean;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden>
      <div className="flex h-7 gap-[2px]">
        {Array.from({ length: SCALE_SEGMENTS }, (_, index) => {
          const from = index * SCALE_STEP;
          const lit = value !== null && from < value;
          return (
            <span
              key={index}
              className={cn(
                'h-full flex-1 rounded-[2px] transition-opacity duration-500',
                lit && live && 'gauge-flash',
              )}
              style={{
                backgroundColor: temperatureHex(from + SCALE_STEP / 2),
                opacity: lit ? (live ? 1 : 0.42) : 0.13,
                ...(lit && live
                  ? {
                      animationDelay: `${index * 16}ms`,
                      animationFillMode: 'both',
                    }
                  : null),
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-1.5 h-3.5 font-mono text-[10px] leading-3.5 text-faint">
        <span className="absolute left-0">0°</span>
        <span className="absolute left-1/2 -translate-x-1/2">50°</span>
        <span className="absolute right-0">100°</span>
      </div>
    </div>
  );
}

/** Grafikdagi faol nuqta — halqa (nur) + markaz. */
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

/** Grafik maslahat oynasi — karta uslubida (qora «qutiga» emas). */
function ChartTip({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div className="min-w-[188px] rounded-[10px] bg-[var(--surface)] px-3 py-2.5 text-micro shadow-[var(--shadow-pop)]">
      <p className="font-mono text-[10.5px] font-semibold text-muted">{time}</p>
      <div className="mt-1.5 flex flex-col gap-1">{children}</div>
    </div>
  );
}

function TipRow({
  color,
  dashed,
  label,
  value,
}: {
  color?: string;
  dashed?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {color ? (
          <span
            aria-hidden
            className={cn('h-0 w-3 border-t-2', dashed && 'border-dashed')}
            style={{ borderColor: color }}
          />
        ) : (
          <span aria-hidden className="w-3 text-center text-faint">
            Δ
          </span>
        )}
        {label}
      </span>
      <strong className="font-mono font-semibold text-strong tabular-nums">
        {value}
      </strong>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'default',
  mono,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone?: 'default' | 'muted';
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-[var(--surface-sunken)] text-muted ring-1 ring-[var(--border-subtle)] ring-inset">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="label-eyebrow">{label}</p>
        <p
          className={cn(
            'mt-0.5 truncate font-semibold',
            mono ? 'font-mono text-ui' : 'text-lede',
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
  mono,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
  icon?: typeof Flame;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-cell)] py-2.5 last:border-0">
      <span className="flex shrink-0 items-center gap-1.5 text-meta text-muted">
        {Icon ? <Icon className="size-3.5 opacity-70" /> : null}
        {label}
      </span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            'block truncate font-medium text-strong',
            mono ? 'font-mono text-meta' : 'text-ui',
          )}
        >
          {orDash(value)}
        </span>
        {hint ? (
          <span className="block text-micro text-faint">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}
