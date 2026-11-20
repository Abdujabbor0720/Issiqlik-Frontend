import { useQuery } from '@tanstack/react-query';
import { Repeat, Building2, MapPinned, FileBarChart } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { formatDateTimeUz, toInputDate } from '@/shared/utils/date';
import { formatNumber, formatTemperature } from '@/shared/utils/format';

const GROUP_LABELS: Record<IncidentReportGroup, string> = {
  district: 'Tumanlar',
  agency: 'Tashkilotlar',
  organization: 'Muassasalar',
  kind: 'XAVF turlari',
};

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

  if (summary.isLoading) return <Skeleton className="h-96" />;
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
      <div className="px-1">
        <h1 className="text-sub font-semibold tracking-tight text-strong">
          XAVF tahlili
        </h1>
        <p className="text-meta text-muted">
          Faol: {formatNumber(s.active)} · kritik: {formatNumber(s.critical)} ·
          eskalatsiya: {formatNumber(s.escalated)} · so‘nggi 24 soatda{' '}
          {formatNumber(s.last24Hours.created)} ta yangi,{' '}
          {formatNumber(s.last24Hours.resolved)} ta bartaraf
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Faol XAVF turlari"
            icon={<FileBarChart className="size-4" />}
          />
          <CardBody className="flex flex-col gap-2">
            {s.byKind.length === 0 ? (
              <p className="text-meta text-muted">Faol XAVF yo‘q.</p>
            ) : (
              s.byKind.map((row) => {
                const Icon = INCIDENT_KIND[row.kind]?.icon;
                const share = s.active > 0 ? (row.count / s.active) * 100 : 0;
                return (
                  <div key={row.kind} className="flex items-center gap-3">
                    {Icon ? <Icon className="size-4 text-muted" /> : null}
                    <span className="w-52 shrink-0 truncate text-meta text-ink">
                      {INCIDENT_KIND[row.kind]?.label ?? row.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div
                        className="h-full rounded-full bg-danger-400"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-meta font-semibold text-strong tabular-nums">
                      {row.count}
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
                    .map((row) => (
                      <Tr key={row.districtId}>
                        <Td className="font-medium text-strong">{row.name}</Td>
                        <Td align="right">{row.active}</Td>
                        <Td align="right" className="text-danger-600">
                          {row.critical}
                        </Td>
                        <Td align="right">{row.escalated}</Td>
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
                    <Tr key={row.agencyId ?? 'none'}>
                      <Td className="font-medium text-strong">
                        {row.agencyName}
                      </Td>
                      <Td align="right">{row.active}</Td>
                      <Td align="right">{row.escalated}</Td>
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
        title="Takrorlanayotgan muammolar"
        subtitle="Bir obyekt/xonada bir xil XAVF (qayta ochilishlar bilan)"
        icon={<Repeat className="size-4" />}
        actions={
          <div className="flex gap-2">
            <Select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {[7, 30, 90, 180].map((value) => (
                <option key={value} value={value}>
                  {value} kun
                </option>
              ))}
            </Select>
            <Select
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
              <Tr key={`${row.boilerId}-${row.roomId ?? ''}-${row.kind}`}>
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
                <Td>{row.district}</Td>
                <Td align="right" className="font-semibold text-danger-600">
                  {row.occurrences}
                  {row.reopens > 0 ? (
                    <span className="font-normal text-faint">
                      {' '}
                      ({row.incidents}+{row.reopens})
                    </span>
                  ) : null}
                </Td>
                <Td align="right">
                  {formatTemperature(row.lowestTemperature)}
                </Td>
                <Td>{formatDateTimeUz(row.lastDetectedAt)}</Td>
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
        title="Davr hisoboti"
        subtitle="Aniqlangan sana bo‘yicha"
        icon={<FileBarChart className="size-4" />}
      />
      {/* ⚠️ Filtrlar alohida qatorda: sarlavha ichida ular torayib ustma-ust tushardi. */}
      <CardBody className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-3">
        <Select
          value={groupBy}
          onChange={(event) =>
            setGroupBy(event.target.value as IncidentReportGroup)
          }
        >
          {Object.entries(GROUP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label} kesimida
            </option>
          ))}
        </Select>
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
              <Tr key={row.key ?? 'none'}>
                <Td className="font-medium text-strong">
                  {groupBy === 'kind' && row.key
                    ? (INCIDENT_KIND[row.key as keyof typeof INCIDENT_KIND]
                        ?.label ?? row.label)
                    : row.label}
                </Td>
                <Td align="right" className="font-semibold">
                  {row.total}
                </Td>
                <Td align="right">{row.active}</Td>
                <Td align="right">{row.autoResolved}</Td>
                <Td align="right">{row.manuallyResolved}</Td>
                <Td align="right">{row.closed}</Td>
                <Td align="right">{row.escalated}</Td>
                <Td align="right">{formatMinutes(row.avgAckMinutes)}</Td>
                <Td align="right">{formatMinutes(row.avgResolveMinutes)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <CardBody className="py-2.5">
        <Link to="/incidents" className="text-meta font-medium text-brand-600">
          Hodisalar ro‘yxatiga o‘tish →
        </Link>
      </CardBody>
    </Card>
  );
}
