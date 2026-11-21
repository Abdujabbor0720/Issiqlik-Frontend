import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CircleCheck,
  FileBarChart,
  MapPinned,
  Repeat,
  ShieldAlert,
  Siren,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  IncidentReport,
  IncidentReportGroup,
  IncidentSummary,
  RecurringIncidentRow,
} from '@/shared/api/types';
import { INCIDENT_KIND, formatMinutes } from '@/shared/constants/incident';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, toInputDate } from '@/shared/utils/date';
import {
  formatNumber,
  formatPercent,
  formatTemperature,
} from '@/shared/utils/format';

const GROUP_LABELS: Record<IncidentReportGroup, string> = {
  district: 'Tumanlar',
  agency: 'Tashkilotlar',
  organization: 'Muassasalar',
  kind: 'XAVF turlari',
};

const RECURRING_DAYS = [7, 30, 90, 180] as const;

/**
 * XAVF TAHLILI — tuman, tashkilot va viloyat paneli (texnik topshiriq §8).
 *
 * ⚠️ Kesimlar VAKOLAT bo'yicha keladi: tuman mas'ulida tumanlar jadvali
 * yo'q (`byDistrict = null`), tashkilot mas'ulida — bor (boshqarma bir
 * nechta tumanni qamraydi), viloyatda esa tashkilotlar kesimi ham bor.
 */
export function IncidentAnalyticsPage() {
  const summary = useQuery({
    queryKey: qk.incidentSummary(null),
    queryFn: () => get<IncidentSummary>(API.incidents.summary),
    refetchInterval: 60_000,
  });

  if (summary.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[76px] w-full max-w-md" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return (
      <Card>
        <ErrorState
          message={errorMessage(summary.error)}
          onRetry={() => void summary.refetch()}
        />
      </Card>
    );
  }
  const s = summary.data;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="XAVF tahlili"
        subtitle="Vakolat doirangiz bo‘yicha kesimlar · har daqiqada yangilanadi"
      />

      {/* ⚠️ Raqamlar ilgari sarlavha ostidagi bitta satrda edi — rahbar
          ularni o'qib emas, KO'RIB olishi kerak. Manba o'sha `summary`. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Faol XAVF"
          value={formatNumber(s.active)}
          icon={ShieldAlert}
          tone={s.active > 0 ? 'danger' : 'ok'}
          hint={`${formatNumber(s.critical)} ta kritik`}
        />
        <StatCard
          index={1}
          label="Eskalatsiya qilingan"
          value={formatNumber(s.escalated)}
          icon={TrendingUp}
          tone={s.escalated > 0 ? 'danger' : 'neutral'}
          hint="Yuqori mas‘ulga ko‘tarilgan"
        />
        <StatCard
          index={2}
          label="24 soatda aniqlangan"
          value={formatNumber(s.last24Hours.created)}
          icon={Siren}
          tone={s.last24Hours.created > 0 ? 'warn' : 'neutral'}
          hint="Yangi XAVF"
        />
        <StatCard
          index={3}
          label="24 soatda bartaraf"
          value={formatNumber(s.last24Hours.resolved)}
          icon={CircleCheck}
          tone="ok"
          hint="So‘nggi sutka"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Taqsimot"
            title="Faol XAVF turlari"
            icon={<FileBarChart className="size-4" />}
          />
          <CardBody className="flex flex-col gap-3">
            {s.byKind.length === 0 ? (
              <p className="text-meta text-muted">Faol XAVF yo‘q.</p>
            ) : (
              s.byKind.map((row, index) => {
                const Icon = INCIDENT_KIND[row.kind]?.icon;
                const share = s.active > 0 ? (row.count / s.active) * 100 : 0;
                const order = { '--i': Math.min(index, 12) } as CSSProperties;
                return (
                  <div
                    key={row.kind}
                    className="reveal flex items-center gap-3"
                    style={order}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-danger-50 text-danger-600 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
                      {Icon ? (
                        <Icon className="size-3.5" strokeWidth={2.2} />
                      ) : null}
                    </span>
                    <span className="w-44 shrink-0 truncate text-meta font-medium text-ink sm:w-52">
                      {INCIDENT_KIND[row.kind]?.label ?? row.label}
                    </span>
                    {/* ⚠️ Chiziq birinchi chizishda chapdan O'SADI
                        (`stat-bar`, faqat `transform`). */}
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div
                        className="stat-bar h-full rounded-full bg-linear-to-r from-danger-400 to-danger-500"
                        style={{ ...order, width: `${share}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-ui font-semibold text-strong tabular-nums">
                      {row.count}
                    </span>
                    <span className="hidden w-11 text-right font-mono text-micro text-faint tabular-nums sm:inline">
                      {formatPercent(share)}
                    </span>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        {s.byDistrict ? (
          <Card className="overflow-hidden">
            <CardHeader
              eyebrow="Kesim"
              title="Tumanlar kesimida"
              icon={<MapPinned className="size-4" />}
            />
            {s.byDistrict.length === 0 ? (
              <EmptyState title="Faol XAVF yo‘q" className="py-8" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Tuman</Th>
                    <Th align="right">Faol</Th>
                    <Th align="right">Kritik</Th>
                    <Th align="right">Eskalatsiya</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.byDistrict]
                    .sort((a, b) => b.active - a.active)
                    .map((row, index) => (
                      <Tr key={row.districtId} className={ROW_HOVER}>
                        <Td className="font-medium text-strong">
                          <span className="mr-2.5 font-mono text-micro text-faint tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          {row.name}
                        </Td>
                        <Td align="right">
                          <Num value={row.active} strong />
                        </Td>
                        <Td align="right">
                          <Num value={row.critical} tone="danger" />
                        </Td>
                        <Td align="right">
                          <Num value={row.escalated} />
                        </Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        ) : null}

        {s.byAgency ? (
          <Card className="overflow-hidden">
            <CardHeader
              eyebrow="Kesim"
              title="Tashkilotlar kesimida"
              icon={<Building2 className="size-4" />}
            />
            {s.byAgency.length === 0 ? (
              <EmptyState title="Faol XAVF yo‘q" className="py-8" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Tashkilot</Th>
                    <Th align="right">Faol</Th>
                    <Th align="right">Eskalatsiya</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.byAgency.map((row) => (
                    <Tr key={row.agencyId ?? 'none'} className={ROW_HOVER}>
                      <Td className="font-medium text-strong">
                        {row.agencyName}
                      </Td>
                      <Td align="right">
                        <Num value={row.active} strong />
                      </Td>
                      <Td align="right">
                        <Num value={row.escalated} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        ) : null}
      </div>

      <RecurringCard />
      <ReportCard />
    </div>
  );
}

/** Bosilmaydigan jadval qatori uchun yengil ta'kid (`Tr` faqat `onClick` da beradi). */
const ROW_HOVER = 'hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]';

/**
 * Jadval raqami. ⚠️ Nol — XIRA: «0 kritik» bilan «7 kritik» bir xil
 * quyuqlikda tursa, ko'z ustun bo'ylab haqiqiy muammoni qidirib yurardi.
 */
function Num({
  value,
  tone,
  strong,
}: {
  value: number;
  tone?: 'danger';
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-mono text-ui tabular-nums',
        value === 0
          ? 'text-faint'
          : tone === 'danger'
            ? 'font-semibold text-danger-600 dark:text-danger-300'
            : strong
              ? 'font-semibold text-strong'
              : 'text-ink',
      )}
    >
      {value}
    </span>
  );
}

/** Takrorlanayotgan muammolar — bir joyda bir xil XAVF necha marta. */
function RecurringCard() {
  const [days, setDays] = useState(30);
  const [minCount, setMinCount] = useState(2);
  const params = { days, minCount };
  const query = useQuery({
    queryKey: qk.incidentRecurring(params),
    queryFn: () =>
      get<RecurringIncidentRow[]>(API.incidents.recurring, { params }),
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        eyebrow="Qayta-qayta"
        title="Takrorlanayotgan muammolar"
        subtitle="Bir obyekt/xonada bir xil XAVF (qayta ochilishlar bilan)"
        icon={<Repeat className="size-4" />}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* ⚠️ Segment (sm) va ro'yxat bir xil balandlikda — 34px. */}
            <Segmented
              size="sm"
              ariaLabel="Davr"
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
              options={RECURRING_DAYS.map((value) => ({
                value: String(value),
                label: `${value} kun`,
              }))}
            />
            <Select
              aria-label="Kamida necha marta"
              className="h-[34px] w-auto text-meta"
              value={minCount}
              onChange={(event) => setMinCount(Number(event.target.value))}
            >
              {[2, 3, 5, 10].map((value) => (
                <option key={value} value={value}>
                  ≥ {value} marta
                </option>
              ))}
            </Select>
          </div>
        }
      />
      {query.isLoading ? (
        <CardBody>
          <Skeleton className="h-40" />
        </CardBody>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Takrorlanayotgan muammo yo‘q"
          description="Tanlangan davrda bir joyda bir xil XAVF qayta-qayta kuzatilmadi."
          className="py-8"
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Obyekt</Th>
              <Th>Tur</Th>
              <Th>Tuman</Th>
              <Th align="right">Marta</Th>
              <Th align="right">Eng past</Th>
              <Th>Oxirgisi</Th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => (
              <Tr
                key={`${row.boilerId}-${row.roomId ?? ''}-${row.kind}`}
                className={ROW_HOVER}
              >
                <Td>
                  <span className="font-medium text-strong">
                    {row.organizationName ?? boilerName(null, row.lotNumber)}
                  </span>
                  {row.roomName || row.deviceLabel ? (
                    <span className="text-muted">
                      {' '}
                      · {row.roomName ?? row.deviceLabel}
                    </span>
                  ) : null}
                </Td>
                <Td>{INCIDENT_KIND[row.kind]?.label ?? row.kindLabel}</Td>
                <Td className="text-muted">{row.district}</Td>
                <Td align="right">
                  <span className="inline-flex items-baseline gap-1 rounded-md bg-danger-50 px-1.5 py-0.5 font-mono text-ui font-semibold text-danger-700 ring-1 ring-danger-200 ring-inset tabular-nums dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
                    {row.occurrences}
                    {row.reopens > 0 ? (
                      <span className="text-micro font-normal opacity-70">
                        ({row.incidents}+{row.reopens})
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td align="right" className="font-mono text-ui tabular-nums">
                  {formatTemperature(row.lowestTemperature)}
                </Td>
                <Td className="font-mono text-[12px] whitespace-nowrap text-muted tabular-nums">
                  {formatDateTimeUz(row.lastDetectedAt)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/** Davr hisoboti: qancha XAVF, qanchasi o'zi tiklandi, qabul/bartaraf vaqti. */
function ReportCard() {
  const today = new Date();
  const [groupBy, setGroupBy] = useState<IncidentReportGroup>('district');
  const [from, setFrom] = useState(
    toInputDate(new Date(today.getTime() - 30 * 24 * 3600_000)),
  );
  const [to, setTo] = useState(toInputDate(today));

  const params = useMemo(
    () => ({
      groupBy,
      ...(from ? { from: `${from}T00:00:00+05:00` } : {}),
      ...(to ? { to: `${to}T23:59:59+05:00` } : {}),
    }),
    [groupBy, from, to],
  );
  const query = useQuery({
    queryKey: qk.incidentReport(params),
    queryFn: () => get<IncidentReport>(API.incidents.report, { params }),
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        eyebrow="Hisobot"
        title="Davr hisoboti"
        subtitle="Aniqlangan sana bo‘yicha"
        icon={<FileBarChart className="size-4" />}
      />
      {/* ⚠️ Filtrlar alohida qatorda: sarlavha ichida ular torayib ustma-ust tushardi.
          Kesim tanlovi — segment (4 band birdan ko'rinadi); tor ekranda u
          gorizontal aylanadi, sanalar esa pastki qatorga tushadi. */}
      <CardBody className="flex flex-wrap items-center gap-2 pt-0">
        <div className="-my-1 max-w-full overflow-x-auto py-1">
          <Segmented
            size="sm"
            ariaLabel="Hisobot kesimi"
            value={groupBy}
            onChange={setGroupBy}
            options={(
              Object.entries(GROUP_LABELS) as Array<
                [IncidentReportGroup, string]
              >
            ).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[160px_160px]">
          <Input
            type="date"
            aria-label="Davr boshi"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            type="date"
            aria-label="Davr oxiri"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </CardBody>
      {query.isLoading ? (
        <CardBody>
          <Skeleton className="h-40" />
        </CardBody>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (query.data?.rows ?? []).length === 0 ? (
        <EmptyState title="Bu davrda XAVF bo‘lmagan" className="py-8" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{GROUP_LABELS[groupBy]}</Th>
              <Th align="right">Jami</Th>
              <Th align="right">Faol</Th>
              <Th align="right">O‘zi tiklandi</Th>
              <Th align="right">Qo‘lda bartaraf</Th>
              <Th align="right">Yopilgan</Th>
              <Th align="right">Eskalatsiya</Th>
              <Th align="right">O‘rt. qabul</Th>
              <Th align="right">O‘rt. bartaraf</Th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => (
              <Tr key={row.key ?? 'none'} className={ROW_HOVER}>
                <Td className="font-medium text-strong">
                  {groupBy === 'kind' && row.key
                    ? (INCIDENT_KIND[row.key as keyof typeof INCIDENT_KIND]
                        ?.label ?? row.label)
                    : row.label}
                </Td>
                <Td align="right">
                  <Num value={row.total} strong />
                </Td>
                <Td align="right">
                  <Num value={row.active} tone="danger" />
                </Td>
                <Td align="right">
                  <Num value={row.autoResolved} />
                </Td>
                <Td align="right">
                  <Num value={row.manuallyResolved} />
                </Td>
                <Td align="right">
                  <Num value={row.closed} />
                </Td>
                <Td align="right">
                  <Num value={row.escalated} />
                </Td>
                <Td
                  align="right"
                  className="text-meta whitespace-nowrap text-muted"
                >
                  {formatMinutes(row.avgAckMinutes)}
                </Td>
                <Td
                  align="right"
                  className="text-meta whitespace-nowrap text-muted"
                >
                  {formatMinutes(row.avgResolveMinutes)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-2.5">
        <Link
          to="/incidents"
          className="group inline-flex items-center gap-1.5 rounded-sm text-meta font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
        >
          Hodisalar ro‘yxatiga o‘tish
          <ArrowRight className="size-3.5 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  );
}
