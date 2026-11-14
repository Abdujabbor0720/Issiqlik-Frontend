import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellOff,
  CheckCircle2,
  Flame,
  PlugZap,
  Search,
  Snowflake,
  ThermometerSnowflake,
  ThermometerSun,
  TriangleAlert,
  Waves,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { errorMessage, getPaged, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { Alert, AlertState, AlertType } from '@/shared/api/types';
import { ALERT_SEVERITY, ALERT_TYPE_LABELS } from '@/shared/constants/status';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Textarea,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { districtParams, useFiltersStore } from '@/store/filters.store';

/**
 * ⚠️ Ro'yxat TO'LIQ bo'lishi shart: `Record<AlertType, …>` tipi
 * yangi tur qo'shilganda kompilyatsiyani to'xtatadi. Ilgari bu
 * `as const` edi va yangi tur qo'shilganda ikonka jimgina
 * `undefined` bo'lib, zaxira belgisi (`Flame`) ko'rinardi — ya'ni
 * «suv aylanmayapti» va «ortiqcha qizish» bir xil ko'rinardi.
 */
const TYPE_ICONS: Record<AlertType, typeof PlugZap> = {
  offline: PlugZap,
  critical_temperature: ThermometerSnowflake,
  low_temperature: ThermometerSnowflake,
  overheat: ThermometerSun,
  /* Datchik nosoz — tarmoq emas, USKUNA muammosi. */
  sensor_fault: TriangleAlert,
  /* Suv aylanmayapti — oqim muammosi. */
  no_circulation: Waves,
  /*
   * ⚠️ Qor parchasi — kotyolning «sovuq» belgisidan (termometr) FARQLI:
   * biri «qozon sovuq», ikkinchisi «xona sovuq» va ular boshqa ishni
   * talab qiladi (qozonxona yoki bino/radiator).
   */
  room_cold: Snowflake,
};

const TABS: Array<{
  key: 'active' | 'resolved';
  label: string;
  states: AlertState[];
}> = [
  { key: 'active', label: 'Ochiq', states: ['open', 'acknowledged'] },
  { key: 'resolved', label: 'Yopilgan', states: ['resolved'] },
];

/**
 * OGOHLANTIRISHLAR.
 *
 * ⚠️ Sukut bo'yicha FAQAT ochiqlar ko'rsatiladi. Yopilganlar bilan
 * birga chiqsa, ro'yxat tarixga aylanib, «hozir nima bo'lyapti»
 * degan savolga javob bermay qo'yardi — holbuki bu ekran aynan shu
 * uchun ochiladi.
 *
 * ⚠️ Qatorlar OG'IRLIK bo'yicha saralangan holda keladi (serverda):
 * vaqt bo'yicha bo'lsa, yangi «harorat past» xabari bir soat oldingi
 * «butun qozonxona sovuq» xabarini pastga surib yuborardi.
 */
export function AlertsPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const districtId = useFiltersStore((state) => state.districtId);

  const [tab, setTab] = useState<'active' | 'resolved'>('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [acking, setAcking] = useState<Alert | null>(null);
  const [note, setNote] = useState('');

  const debouncedSearch = useDebounce(search);
  const states = TABS.find((item) => item.key === tab)?.states ?? [];

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      states: states.join(','),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...districtParams(districtId),
    }),
    [page, states, debouncedSearch, districtId],
  );

  const query = useQuery({
    queryKey: qk.alerts(params),
    queryFn: () => getPaged<Alert>(API.alerts.list, { params }),
    placeholderData: (previous) => previous,
    /* ⚠️ Har daqiqada qayta so'raladi: WebSocket hodisasi ham bor,
       lekin u uzilib qolishi mumkin va bu ekranda eskirgan ma'lumot
       eng qimmatga tushadi. */
    refetchInterval: 60_000,
  });

  const ackMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      post(API.alerts.acknowledge(id), { note: text }),
    onSuccess: () => {
      toast.success('Ko‘rib chiqildi deb belgilandi');
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setAcking(null);
      setNote('');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Ogohlantirishlar
          </h1>
          <p className="text-meta text-muted">
            {query.data
              ? `${formatNumber(query.data.meta.total)} ta yozuv`
              : 'Yuklanmoqda…'}
            {districtId ? ' · tanlangan tuman bo‘yicha' : ''}
          </p>
        </div>

        <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                setPage(1);
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
      </div>

      <Card>
        <CardBody className="py-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Lot raqami, tashkilot yoki xabar matni…"
            leading={<Search className="size-4" />}
          />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-80" />
          </CardBody>
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? CheckCircle2 : BellOff}
            title={
              tab === 'active'
                ? 'Ochiq ogohlantirish yo‘q'
                : 'Yopilgan yozuv yo‘q'
            }
            description={
              tab === 'active'
                ? 'Barcha qozonxonalar me‘yorda ishlamoqda.'
                : 'Holat tiklanganda ogohlantirish avtomatik yopiladi va shu yerga tushadi.'
            }
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {items.map((alert, index) => {
                const severity = ALERT_SEVERITY[alert.severity];
                const Icon = TYPE_ICONS[alert.type] ?? Flame;
                const acknowledged = alert.state === 'acknowledged';

                return (
                  <li key={alert.id}>
                    {index > 0 ? <div className="h-px bg-line" /> : null}
                    <div className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                      <span
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-tile',
                          alert.severity === 'critical'
                            ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-danger-300'
                            : 'bg-warn-50 text-warn-600 dark:bg-warn-400/14 dark:text-warn-300',
                        )}
                      >
                        <Icon className="size-4" strokeWidth={2} />
                      </span>

                      <div className="min-w-[220px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={severity.chip} dot={severity.dot}>
                            {severity.label}
                          </Badge>
                          <span className="text-micro font-medium text-muted">
                            {ALERT_TYPE_LABELS[alert.type]}
                          </span>
                          {acknowledged ? (
                            <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300">
                              Ko‘rib chiqilgan
                            </Badge>
                          ) : null}
                          {alert.state === 'resolved' ? (
                            <Badge className="bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300">
                              Yopilgan
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-1 text-ui font-medium text-strong">
                          {alert.boiler?.organization?.name ??
                            `Lot ${alert.boiler?.lotNumber ?? '—'}`}
                          {/*
                            ⚠️ Xona nomi JORIY nomdan olinadi: xabar matni
                            ochilgan paytdagi nomni saqlaydi («Xona 2»),
                            admin keyin uni «1-sinf» deb nomlagan bo'lishi
                            mumkin.
                          */}
                          {alert.room ? (
                            <span className="font-normal text-muted">
                              {' '}
                              · {alert.room.name}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-meta text-muted">{alert.message}</p>

                        <p className="mt-1 text-micro text-faint">
                          {alert.boiler?.district?.shortName ?? '—'} ·
                          Boshlandi: {formatDateTimeUz(alert.createdAt)} ·
                          Oxirgi tasdiq: {formatRelativeUz(alert.lastSeenAt)}
                          {alert.resolvedAt
                            ? ` · Yopildi: ${formatDateTimeUz(alert.resolvedAt)}`
                            : ''}
                        </p>

                        {alert.ackNote ? (
                          <p className="mt-1.5 rounded-md bg-[var(--surface-sunken)] px-2.5 py-1.5 text-micro text-muted">
                            <span className="font-medium text-ink">
                              {alert.acknowledgedBy?.fullName ?? 'Operator'}:
                            </span>{' '}
                            {alert.ackNote}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p
                            className="text-head font-semibold text-strong"
                            data-numeric
                          >
                            {formatTemperature(alert.temperature)}
                          </p>
                          <p className="text-nano text-faint">
                            muammo boshlanganda
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Link
                            to={`/boilers/${alert.boilerId}`}
                            className="rounded-md px-2.5 py-1 text-center text-micro font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
                          >
                            Kartaga o‘tish
                          </Link>

                          {can('alerts.ack') && alert.state === 'open' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setAcking(alert);
                                setNote('');
                              }}
                            >
                              Ko‘rib chiqdim
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {query.data ? (
              <Pagination meta={query.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        open={Boolean(acking)}
        onClose={() => setAcking(null)}
        title="Ko‘rib chiqildi deb belgilash"
        description={acking?.message}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAcking(null)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              loading={ackMutation.isPending}
              onClick={() =>
                acking && ackMutation.mutate({ id: acking.id, text: note })
              }
            >
              Belgilash
            </Button>
          </>
        }
      >
        <Field
          label="Nima qilinmoqda"
          hint="Ogohlantirish YOPILMAYDI — holat tiklanganda tizim uni o‘zi yopadi"
        >
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ta‘mirchi yuborildi, ertaga ertalab tekshiriladi"
            />
          )}
        </Field>
      </Modal>
    </div>
  );
}
