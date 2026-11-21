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
import { useMemo, useState, type CSSProperties } from 'react';
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
  PageHeader,
  Pagination,
  Segmented,
  Skeleton,
  Textarea,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { districtParams, useFiltersStore } from '@/store/filters.store';
import { boilerName } from '@/shared/utils/boiler';

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
      <PageHeader
        title="Ogohlantirishlar"
        subtitle={
          <>
            {query.data ? (
              <>
                <span className="font-mono font-semibold text-strong tabular-nums">
                  {formatNumber(query.data.meta.total)}
                </span>{' '}
                ta yozuv
              </>
            ) : (
              'Yuklanmoqda…'
            )}
            {districtId ? ' · tanlangan tuman bo‘yicha' : ''}
          </>
        }
        actions={
          <Segmented
            size="md"
            ariaLabel="Ogohlantirish holati"
            value={tab}
            onChange={(value) => {
              setTab(value);
              setPage(1);
            }}
            options={TABS.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
          />
        }
      />

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
                const resolved = alert.state === 'resolved';
                const critical = alert.severity === 'critical';

                return (
                  <li
                    key={alert.id}
                    className="reveal"
                    style={{ '--i': Math.min(index, 12) } as CSSProperties}
                  >
                    {index > 0 ? <div className="h-px bg-line" /> : null}
                    {/*
                      ⚠️ Chap chetdagi og'irlik chizig'i faqat OCHIQ yozuvda
                      rangli, jonli to'lqin — faqat ko'rib chiqilmagan
                      KRITIK yozuvda: «Yopilgan» tabi «yonib» turmasligi va
                      operator kimga hali hech kim qaramaganini darhol
                      ajratishi uchun.
                    */}
                    <div className="group relative flex flex-wrap items-start gap-3.5 px-5 py-3.5 transition-[background-color] duration-200 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.02]">
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-3 left-0 w-[3px] origin-left rounded-r-full transition-transform duration-300 ease-out-expo group-hover:scale-x-[1.6]',
                          resolved
                            ? 'bg-[var(--border-strong)]'
                            : critical
                              ? 'bg-danger-500'
                              : alert.severity === 'warning'
                                ? 'bg-warn-400'
                                : 'bg-brand-400',
                        )}
                      />
                      <span
                        className={cn(
                          'relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-tile ring-1 ring-inset',
                          critical
                            ? 'bg-danger-50 text-danger-600 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30'
                            : 'bg-warn-50 text-warn-600 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
                        )}
                      >
                        <Icon className="size-4" strokeWidth={2} />
                        {critical && alert.state === 'open' ? (
                          <span
                            aria-hidden
                            className="absolute -top-1 -right-1 flex size-2.5"
                          >
                            <span className="live-ping absolute inset-0 rounded-full bg-danger-500" />
                            <span className="relative size-2.5 rounded-full bg-danger-500 ring-2 ring-[var(--surface)]" />
                          </span>
                        ) : null}
                      </span>

                      <div className="min-w-[220px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={severity.chip} dot={severity.dot}>
                            {severity.label}
                          </Badge>
                          <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
                            {ALERT_TYPE_LABELS[alert.type]}
                          </span>
                          {acknowledged ? (
                            <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25">
                              Ko‘rib chiqilgan
                            </Badge>
                          ) : null}
                          {resolved ? (
                            <Badge className="bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25">
                              Yopilgan
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-1.5 font-display text-[15px] leading-snug font-[700] tracking-[-0.01em] text-strong [font-stretch:104%]">
                          {boilerName(
                            alert.boiler?.organization?.name,
                            alert.boiler?.lotNumber,
                          )}
                          {/*
                            ⚠️ Xona nomi JORIY nomdan olinadi: xabar matni
                            ochilgan paytdagi nomni saqlaydi («Xona 2»),
                            admin keyin uni «1-sinf» deb nomlagan bo'lishi
                            mumkin.
                          */}
                          {alert.room ? (
                            <span className="font-sans text-ui font-normal tracking-normal text-muted">
                              {' '}
                              · {alert.room.name}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-meta text-muted">{alert.message}</p>

                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-faint">
                          <span className="font-medium text-muted">
                            {alert.boiler?.district?.shortName ?? '—'}
                          </span>
                          <span aria-hidden>·</span>
                          <span>
                            Boshlandi:{' '}
                            <span className="font-mono text-[11px] text-muted tabular-nums">
                              {formatDateTimeUz(alert.createdAt)}
                            </span>
                          </span>
                          <span aria-hidden>·</span>
                          <span>
                            Oxirgi tasdiq: {formatRelativeUz(alert.lastSeenAt)}
                          </span>
                          {alert.resolvedAt ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>
                                Yopildi:{' '}
                                <span className="font-mono text-[11px] text-muted tabular-nums">
                                  {formatDateTimeUz(alert.resolvedAt)}
                                </span>
                              </span>
                            </>
                          ) : null}
                        </p>

                        {alert.ackNote ? (
                          <p className="mt-2 rounded-md bg-[var(--surface-sunken)] py-1.5 pr-2.5 pl-3 text-micro text-muted shadow-[inset_2px_0_0_var(--color-brand-400)] ring-1 ring-[var(--border-subtle)] ring-inset">
                            <span className="font-medium text-ink">
                              {alert.acknowledgedBy?.fullName ?? 'Operator'}:
                            </span>{' '}
                            {alert.ackNote}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-4 self-center">
                        <div className="text-right">
                          <p
                            className="figure-display text-[24px]"
                            data-numeric
                          >
                            {formatTemperature(alert.temperature)}
                          </p>
                          <p className="label-eyebrow mt-1.5">
                            muammo boshlanganda
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Link
                            to={`/boilers/${alert.boilerId}`}
                            className="rounded-md px-2.5 py-1 text-center text-micro font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-400/10"
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
