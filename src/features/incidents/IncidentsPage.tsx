import { useQuery } from '@tanstack/react-query';
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, get, getPaged } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  AlertSeverity,
  IncidentKind,
  IncidentListItem,
  IncidentStatus,
  IncidentSummary,
} from '@/shared/api/types';
import {
  ACTIVE_INCIDENT_STATUSES,
  INCIDENT_KIND,
  formatMinutes,
} from '@/shared/constants/incident';
import { ALERT_SEVERITY } from '@/shared/constants/status';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  Switch,
} from '@/shared/ui';
import { formatNumber } from '@/shared/utils/format';
import { districtParams, useFiltersStore } from '@/store/filters.store';
import { IncidentCard } from './components/IncidentCard';

type Tab = 'active' | 'unacknowledged' | 'resolved' | 'closed';

const TABS: Array<{ key: Tab; label: string; statuses: IncidentStatus[] }> = [
  { key: 'active', label: 'Faol', statuses: ACTIVE_INCIDENT_STATUSES },
  { key: 'unacknowledged', label: 'Qabul qilinmagan', statuses: ['new'] },
  { key: 'resolved', label: 'Tekshiruvda', statuses: ['resolved'] },
  { key: 'closed', label: 'Yopilgan', statuses: ['closed'] },
];

/**
 * XAVF — mas'ul paneli.
 *
 * ⚠️ Ro'yxat VAKOLAT doirasida keladi (server cheklaydi): tuman mas'uli —
 * o'z tumani, tashkilot mas'uli — o'z idorasi, javobgar — o'z obyektlari.
 * Bu yerdagi filtrlar faqat qulaylik uchun.
 *
 * ⚠️ Sukut — FAOL hodisalar: yopilganlar bilan aralashsa, ekran tarixga
 * aylanib, «hozir qayerda muammo bor» degan savolga javob bermasdi.
 */
export function IncidentsPage() {
  const districtId = useFiltersStore((state) => state.districtId);
  const [tab, setTab] = useState<Tab>('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<IncidentKind | ''>('');
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [escalated, setEscalated] = useState(false);
  const debouncedSearch = useDebounce(search);

  const statuses = TABS.find((item) => item.key === tab)?.statuses ?? [];
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      statuses: statuses.join(','),
      ...(kind ? { kinds: kind } : {}),
      ...(severity ? { severity } : {}),
      ...(escalated ? { escalated: true } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...districtParams(districtId),
    }),
    [page, statuses, kind, severity, escalated, debouncedSearch, districtId],
  );

  const list = useQuery({
    queryKey: qk.incidents(params),
    queryFn: () => getPaged<IncidentListItem>(API.incidents.list, { params }),
    placeholderData: (previous) => previous,
    // ⚠️ Realtime bor, lekin uzilishi mumkin — bu ekranda eskirgan ma'lumot eng qimmat.
    refetchInterval: 60_000,
  });

  const summary = useQuery({
    queryKey: qk.incidentSummary(null),
    queryFn: () => get<IncidentSummary>(API.incidents.summary),
    refetchInterval: 60_000,
  });

  const items = list.data?.items ?? [];
  const s = summary.data;
  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            XAVF — nazorat hodisalari
          </h1>
          <p className="text-meta text-muted">
            {list.data
              ? `${formatNumber(list.data.meta.total)} ta hodisa`
              : 'Yuklanmoqda…'}
            {districtId ? ' · tanlangan tuman bo‘yicha' : ''}
          </p>
        </div>
        <Link
          to="/incident-analytics"
          className="rounded-md px-2.5 py-1.5 text-meta font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
        >
          Tahlil va hisobotlar →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Faol XAVF"
          value={formatNumber(s?.active ?? null)}
          icon={ShieldAlert}
          tone={s && s.active > 0 ? 'danger' : 'ok'}
          hint={s ? `${formatNumber(s.critical)} ta kritik` : undefined}
          active={tab === 'active' && !escalated}
          onClick={() => {
            setTab('active');
            setEscalated(false);
            resetPage();
          }}
        />
        <StatCard
          label="Qabul qilinmagan"
          value={formatNumber(s?.unacknowledged ?? null)}
          icon={BellRing}
          tone={s && s.unacknowledged > 0 ? 'warn' : 'neutral'}
          active={tab === 'unacknowledged'}
          onClick={() => {
            setTab('unacknowledged');
            resetPage();
          }}
        />
        <StatCard
          label="Eskalatsiya qilingan"
          value={formatNumber(s?.escalated ?? null)}
          icon={TrendingUp}
          tone={s && s.escalated > 0 ? 'danger' : 'neutral'}
          active={escalated}
          onClick={() => {
            setTab('active');
            setEscalated(true);
            resetPage();
          }}
        />
        <StatCard
          label="Tekshiruvni kutmoqda"
          value={formatNumber(s?.awaitingClose ?? null)}
          icon={ClipboardCheck}
          tone="brand"
          hint="Bartaraf etilgan, hali yopilmagan"
          active={tab === 'resolved'}
          onClick={() => {
            setTab('resolved');
            resetPage();
          }}
        />
        <StatCard
          label="O‘rtacha qabul vaqti"
          value={formatMinutes(s?.last30Days.avgAckMinutes)}
          icon={Hourglass}
          tone="neutral"
          hint={`Bartaraf: ${formatMinutes(s?.last30Days.avgResolveMinutes)} · 30 kun`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    resetPage();
                  }}
                  className={
                    tab === item.key
                      ? 'rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-meta font-semibold text-strong shadow-[var(--shadow-hair)]'
                      : 'rounded-full px-3.5 py-1.5 text-meta font-medium text-muted transition-colors hover:text-strong'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-ink">
              <Switch
                checked={escalated}
                onChange={(value) => {
                  setEscalated(value);
                  resetPage();
                }}
                label="Faqat eskalatsiya qilinganlar"
              />
              <span>Faqat eskalatsiya qilinganlar</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_180px]">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="№, muassasa, xona yoki qurilma…"
              leading={<Search className="size-4" />}
            />
            <Select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as IncidentKind | '');
                resetPage();
              }}
            >
              <option value="">Barcha turlar</option>
              {Object.entries(INCIDENT_KIND).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
            <Select
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as AlertSeverity | '');
                resetPage();
              }}
            >
              <option value="">Barcha og‘irlik</option>
              {(['critical', 'warning'] as const).map((value) => (
                <option key={value} value={value}>
                  {ALERT_SEVERITY[value].label}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {list.isLoading ? (
          <CardBody>
            <Skeleton className="h-80" />
          </CardBody>
        ) : list.isError ? (
          <ErrorState
            message={errorMessage(list.error)}
            onRetry={() => void list.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={
              tab === 'active' || tab === 'unacknowledged'
                ? 'Faol XAVF yo‘q'
                : 'Hodisa topilmadi'
            }
            description={
              tab === 'active' || tab === 'unacknowledged'
                ? 'Monitoring jadvali bo‘yicha barcha obyektlar me‘yorda.'
                : 'Filtrni o‘zgartirib ko‘ring.'
            }
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {items.map((incident, index) => (
                <li key={incident.id}>
                  {index > 0 ? <div className="h-px bg-line" /> : null}
                  <IncidentCard incident={incident} />
                </li>
              ))}
            </ul>
            {list.data ? (
              <Pagination meta={list.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
