import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BellRing,
  CheckCheck,
  CircleCheck,
  ClipboardCheck,
  Hammer,
  MessageSquarePlus,
  Phone,
  RotateCcw,
  ShieldAlert,
  Star,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { errorMessage, get, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  IncidentDetail,
  IncidentResponsible,
  IncidentStatus,
  IncidentTimelineItem,
} from '@/shared/api/types';
import {
  AUDIENCE_LABELS,
  EVENT_LABELS,
  INCIDENT_KIND,
  INCIDENT_STATUS,
  formatMinutes,
  formatWeekdays,
} from '@/shared/constants/incident';
import { ALERT_SEVERITY } from '@/shared/constants/status';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Skeleton,
  Textarea,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';

type Action = 'acknowledge' | 'start' | 'resolve' | 'close' | 'reopen';
type Dialog = Action | 'comment' | 'action-log';

/**
 * AMALLAR — server holat mashinasi bilan AYNI (`incident-rules.helper.ts`).
 * ⚠️ Tugma faqat ruxsat VA holat mos bo'lsa ko'rinadi; server baribir
 * o'zi tekshiradi (409/403) — bu faqat bosilmaydigan tugmani yashirish.
 */
const ACTIONS: Record<
  Action,
  {
    label: string;
    icon: LucideIcon;
    from: IncidentStatus[];
    permission: string;
    noteRequired: boolean;
    noteLabel: string;
    placeholder: string;
    variant: 'primary' | 'secondary';
  }
> = {
  acknowledge: {
    label: 'Qabul qildim',
    icon: BellRing,
    from: ['new'],
    permission: 'incidents.act',
    noteRequired: false,
    noteLabel: 'Izoh (ixtiyoriy)',
    placeholder: 'Ko‘rdim, joyiga boryapman',
    variant: 'primary',
  },
  start: {
    label: 'Chora ko‘rilmoqda',
    icon: Wrench,
    from: ['new', 'acknowledged'],
    permission: 'incidents.act',
    noteRequired: true,
    noteLabel: 'Nima qilinmoqda',
    placeholder: 'Isitish texnigi yuborildi, radiatorlar tekshirilmoqda',
    variant: 'secondary',
  },
  resolve: {
    label: 'Bartaraf etildi',
    icon: CircleCheck,
    from: ['new', 'acknowledged', 'in_progress'],
    permission: 'incidents.act',
    noteRequired: true,
    noteLabel: 'Bajarilgan ishlar',
    placeholder: 'Nasos almashtirildi, xona harorati 19 °C ga yetdi',
    variant: 'primary',
  },
  close: {
    label: 'Tekshirib yopish',
    icon: ClipboardCheck,
    from: ['resolved'],
    permission: 'incidents.close',
    noteRequired: false,
    noteLabel: 'Tekshiruv natijasi (ixtiyoriy)',
    placeholder: 'Joyida tekshirildi, harorat me‘yorda',
    variant: 'primary',
  },
  reopen: {
    label: 'Qayta ochish',
    icon: RotateCcw,
    from: ['resolved'],
    permission: 'incidents.close',
    noteRequired: true,
    noteLabel: 'Nima uchun qayta ochilmoqda',
    placeholder: 'Xona hali sovuq — 16 °C',
    variant: 'secondary',
  },
};

const EVENT_ICONS: Record<IncidentTimelineItem['type'], LucideIcon> = {
  created: ShieldAlert,
  notified: BellRing,
  status_changed: CheckCheck,
  comment: MessageSquarePlus,
  action: Hammer,
  severity_raised: TrendingUp,
  auto_resolved: CircleCheck,
  reopened: RotateCcw,
  escalated: TrendingUp,
};

/**
 * OGOHLANTIRISH KARTASI — XAVF ning to'liq ko'rinishi.
 *
 * ⚠️ Hodisani O'CHIRISH tugmasi YO'Q va bo'lmaydi: tarix — mas'uliyat
 * izi (texnik topshiriq §6).
 */
export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [note, setNote] = useState('');

  const query = useQuery({
    queryKey: qk.incident(id),
    queryFn: () => get<IncidentDetail>(API.incidents.one(id)),
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ kind, text }: { kind: Dialog; text: string }) => {
      const body = text.trim() ? { note: text.trim() } : {};
      if (kind === 'comment' || kind === 'action-log') {
        return post<IncidentDetail>(API.incidents.comments(id), {
          note: text.trim(),
          kind: kind === 'action-log' ? 'action' : 'comment',
        });
      }
      return post<IncidentDetail>(API.incidents.action(id, kind), body);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(qk.incident(id), data);
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Saqlandi');
      setDialog(null);
      setNote('');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isLoading) {
    return <Skeleton className="h-[480px]" />;
  }
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState
          message={errorMessage(query.error, 'Hodisa topilmadi')}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  const incident = query.data;
  const kind = INCIDENT_KIND[incident.kind];
  const status = INCIDENT_STATUS[incident.status];
  const severity = ALERT_SEVERITY[incident.severity];
  const KindIcon = kind.icon;
  const closed = incident.status === 'closed';
  const actions = (Object.keys(ACTIONS) as Action[]).filter(
    (action) =>
      ACTIONS[action].from.includes(incident.status) &&
      can(ACTIONS[action].permission),
  );
  const dialogMeta =
    dialog && dialog !== 'comment' && dialog !== 'action-log'
      ? ACTIONS[dialog]
      : null;
  const noteRequired = dialogMeta ? dialogMeta.noteRequired : true;
  const lowKind =
    incident.kind === 'room_low_temperature' ||
    incident.kind === 'boiler_low_temperature';

  /*
   * ⚠️ Hozirgi javobgarlar muhrlangandan FARQ qilsa (keyin biriktirilgan
   * yoki almashgan) — alohida ko'rsatiladi: muhrlangan ro'yxat «kimga
   * yuborilgan edi», hozirgisi «kimga qo'ng'iroq qilish kerak».
   */
  const snapshotIds = new Set(
    incident.responsibles.map((item) => item.responsibleId),
  );
  const currentDiffers =
    incident.currentResponsibles.length !== incident.responsibles.length ||
    incident.currentResponsibles.some(
      (item) => !snapshotIds.has(item.responsibleId),
    );

  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/incidents"
        className="inline-flex w-fit items-center gap-1.5 px-1 text-meta font-medium text-muted transition-colors hover:text-strong"
      >
        <ArrowLeft className="size-4" />
        XAVF ro‘yxati
      </Link>

      {/* ───── Ogohlantirish kartasi (§5) ───── */}
      <Card className="overflow-hidden">
        <div
          className={cn(
            'flex flex-wrap items-start gap-4 px-5 py-4',
            incident.severity === 'critical'
              ? 'bg-danger-50/70 dark:bg-danger-500/8'
              : 'bg-warn-50/70 dark:bg-warn-400/8',
          )}
        >
          <span
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-tile',
              incident.severity === 'critical'
                ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-200'
                : 'bg-warn-100 text-warn-700 dark:bg-warn-400/20 dark:text-warn-200',
            )}
          >
            <KindIcon className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-semibold text-faint tabular-nums">
              XAVF №{incident.number}
            </p>
            <h1 className="text-sub font-bold tracking-tight text-danger-700 uppercase dark:text-danger-300">
              XAVF: {kind.label}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge className={status.chip} dot={status.dot}>
                {status.label}
              </Badge>
              <Badge className={severity.chip} dot={severity.dot}>
                {severity.label}
              </Badge>
              {incident.escalationLevel > 0 ? (
                <Badge className="bg-danger-600 text-white">
                  <TrendingUp className="size-3" />
                  Eskalatsiya: {incident.escalationLevel}-daraja
                </Badge>
              ) : null}
              {incident.resolution === 'auto' ? (
                <Badge className="bg-ok-50 text-ok-700 ring-1 ring-ok-200">
                  Tizim avtomatik qayd etdi
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-display font-bold text-strong" data-numeric>
              {formatTemperature(incident.currentTemperature)}
            </p>
            <p className="text-micro text-muted">joriy harorat</p>
          </div>
        </div>

        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-ui md:grid-cols-2">
            <Fact label="Tuman" value={incident.district.name} />
            <Fact
              label="Muassasa"
              value={
                incident.organization?.name ??
                boilerName(null, incident.boiler.lotNumber)
              }
            />
            <Fact
              label="Qurilma / xona"
              value={
                [incident.device?.label, incident.room?.name]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }
            />
            <Fact
              label="Tashkilot"
              value={incident.agency?.name ?? 'biriktirilmagan'}
              muted={!incident.agency}
            />
            <Fact
              label="Harorat"
              value={
                <>
                  {formatTemperature(incident.currentTemperature)}
                  <span className="text-muted">
                    {' '}
                    · aniqlanganda {formatTemperature(incident.temperature)}
                    {lowKind
                      ? ` · eng past ${formatTemperature(incident.extremeTemperature)}`
                      : ''}
                  </span>
                </>
              }
            />
            <Fact
              label={
                incident.kind === 'room_low_temperature'
                  ? 'Belgilangan minimal harorat'
                  : 'Belgilangan me‘yor'
              }
              value={
                incident.threshold === null
                  ? '—'
                  : incident.kind === 'no_circulation'
                    ? `ayirma ≥ ${formatTemperature(incident.threshold)}`
                    : formatTemperature(incident.threshold)
              }
            />
            <Fact
              label="Aniqlangan vaqt"
              value={`${formatDateTimeUz(incident.detectedAt)} · ${formatMinutes(incident.durationMinutes)} ${
                incident.status === 'resolved' || incident.status === 'closed'
                  ? 'davom etdi'
                  : 'davom etmoqda'
              }`}
            />
            <Fact
              label="Oxirgi tasdiq"
              value={formatRelativeUz(incident.lastSeenAt)}
            />
            <Fact
              label="Monitoring jadvali"
              value={
                incident.schedule
                  ? incident.schedule.mode === 'always'
                    ? '24/7 (uzluksiz)'
                    : `${formatWeekdays(incident.schedule.activeDays)}, monitoring ${incident.schedule.monitor}, isitish ${incident.schedule.heating}`
                  : '—'
              }
            />
            <Fact
              label="Obyekt"
              value={
                <>
                  {boilerName(null, incident.boiler.lotNumber)}
                  {incident.boiler.address ? (
                    <span className="text-muted">
                      {' '}
                      · {incident.boiler.address}
                    </span>
                  ) : null}
                  {can('boilers.view') ? (
                    <Link
                      to={`/boilers/${incident.boiler.id}`}
                      className="ml-2 text-meta font-medium text-brand-600"
                    >
                      kartasi →
                    </Link>
                  ) : null}
                </>
              }
            />
          </dl>

          {incident.resolutionNote || incident.closeNote ? (
            <div className="mt-4 flex flex-col gap-2">
              {incident.resolutionNote ? (
                <Note
                  title={
                    incident.resolution === 'auto'
                      ? 'Avtomatik bartaraf'
                      : 'Bajarilgan ishlar'
                  }
                  text={incident.resolutionNote}
                />
              ) : null}
              {incident.closeNote ? (
                <Note title="Tekshiruv natijasi" text={incident.closeNote} />
              ) : null}
            </div>
          ) : null}
        </CardBody>

        {!closed && (actions.length > 0 || can('incidents.act')) ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
            {actions.map((action) => {
              const meta = ACTIONS[action];
              const Icon = meta.icon;
              return (
                <Button
                  key={action}
                  variant={meta.variant}
                  icon={<Icon className="size-4" />}
                  onClick={() => {
                    setNote('');
                    setDialog(action);
                  }}
                >
                  {meta.label}
                </Button>
              );
            })}
            {can('incidents.act') ? (
              <>
                <Button
                  variant="ghost"
                  icon={<Hammer className="size-4" />}
                  onClick={() => {
                    setNote('');
                    setDialog('action-log');
                  }}
                >
                  Bajarilgan ish
                </Button>
                <Button
                  variant="ghost"
                  icon={<MessageSquarePlus className="size-4" />}
                  onClick={() => {
                    setNote('');
                    setDialog('comment');
                  }}
                >
                  Izoh
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
        {/* ───── Tarix ───── */}
        <Card>
          <CardHeader
            title="Hodisa tarixi"
            subtitle="Har bir amal kim va qachon qilgani bilan saqlanadi"
          />
          <CardBody>
            <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
              {incident.timeline.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </ol>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          {/* ───── Javobgarlar ───── */}
          <Card>
            <CardHeader
              title="Javobgar shaxslar"
              subtitle="Hodisa paytida obyektga biriktirilganlar"
            />
            <CardBody className="flex flex-col gap-2.5">
              {incident.responsibles.length === 0 ? (
                <EmptyState
                  title="Javobgar biriktirilmagan"
                  description="«Javobgar shaxslar» bo‘limida muassasaga asosiy javobgar biriktiring."
                  className="py-6"
                />
              ) : (
                incident.responsibles.map((person) => (
                  <ResponsibleRow key={person.responsibleId} person={person} />
                ))
              )}
              {currentDiffers && incident.currentResponsibles.length > 0 ? (
                <>
                  <p className="mt-1 text-micro font-semibold tracking-wide text-faint uppercase">
                    Hozirgi javobgarlar
                  </p>
                  {incident.currentResponsibles.map((person) => (
                    <ResponsibleRow
                      key={`current-${person.responsibleId}`}
                      person={person}
                    />
                  ))}
                </>
              ) : null}
            </CardBody>
          </Card>

          {/* ───── Kimga yuborilgan ───── */}
          <Card>
            <CardHeader
              title="Ogohlantirish yuborilganlar"
              subtitle="0 — dastlabki, 1+ — eskalatsiya darajasi"
            />
            <CardBody className="flex flex-col gap-1.5">
              {incident.notifications.length === 0 ? (
                <p className="text-meta text-muted">
                  Hali hech kimga yuborilmagan.
                </p>
              ) : (
                incident.notifications.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface-sunken)] px-3 py-2 text-meta"
                  >
                    <span className="min-w-0 truncate text-ink">
                      {row.recipient ?? AUDIENCE_LABELS[row.audience]}
                      <span className="text-faint">
                        {/* ⚠️ Ism yashirin bo'lsa auditoriya takrorlanmaydi. */}
                        {row.recipient
                          ? ` · ${AUDIENCE_LABELS[row.audience]}`
                          : ''}
                        {row.level > 0 ? ` · ${row.level}-daraja` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'text-micro',
                        row.readAt ? 'text-ok-600' : 'text-faint',
                      )}
                    >
                      {row.readAt
                        ? `o‘qildi ${formatRelativeUz(row.readAt)}`
                        : `yuborildi ${formatRelativeUz(row.sentAt)}`}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        size="sm"
        title={
          dialogMeta?.label ??
          (dialog === 'action-log' ? 'Bajarilgan ish' : 'Izoh qo‘shish')
        }
        description={`XAVF №${incident.number}: ${kind.label}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Bekor qilish
            </Button>
            <Button
              variant="primary"
              loading={mutation.isPending}
              disabled={noteRequired && note.trim().length < 3}
              onClick={() =>
                dialog && mutation.mutate({ kind: dialog, text: note })
              }
            >
              Saqlash
            </Button>
          </>
        }
      >
        <Field
          label={
            dialogMeta?.noteLabel ??
            (dialog === 'action-log' ? 'Nima qilindi' : 'Izoh')
          }
          required={noteRequired}
          hint={
            dialog === 'resolve'
              ? 'Harorat hali past bo‘lsa, 30 daqiqadan keyin tizim hodisani qayta ochadi'
              : dialog === 'close'
                ? 'Yopilgan hodisa yakuniy — muammo qaytsa yangi XAVF ochiladi'
                : undefined
          }
        >
          {(fieldId) => (
            <Textarea
              id={fieldId}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={dialogMeta?.placeholder ?? 'Matn…'}
            />
          )}
        </Field>
      </Modal>
    </div>
  );
}

function Fact({
  label,
  value,
  muted,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-meta text-faint sm:w-48">{label}</dt>
      <dd
        className={cn(
          'min-w-0 font-medium',
          muted ? 'text-warn-700 dark:text-warn-300' : 'text-strong',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-sunken)] px-3.5 py-2.5">
      <p className="text-micro font-semibold tracking-wide text-faint uppercase">
        {title}
      </p>
      <p className="mt-0.5 text-ui whitespace-pre-line text-ink">{text}</p>
    </div>
  );
}

function ResponsibleRow({ person }: { person: IncidentResponsible }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-ui font-semibold text-strong">
          {person.isPrimary ? (
            <Star className="size-3.5 fill-warn-400 text-warn-400" />
          ) : null}
          {person.fullName}
        </p>
        <p className="text-meta text-muted">
          {person.position}
          {person.employer ? ` · ${person.employer}` : ''}
        </p>
        <p className="text-micro text-faint">
          {person.responsibilityLabel}
          {person.isPrimary ? ' · asosiy javobgar' : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-meta">
        {person.contactsMasked ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Phone className="size-3.5" />
            {person.phone}
          </span>
        ) : (
          <a
            href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
            className="inline-flex items-center gap-1 font-medium text-brand-600"
          >
            <Phone className="size-3.5" />
            {person.phone}
          </a>
        )}
        {person.email ? (
          <span className="text-micro text-faint">{person.email}</span>
        ) : null}
      </div>
    </div>
  );
}

function TimelineEvent({ event }: { event: IncidentTimelineItem }) {
  const Icon = EVENT_ICONS[event.type] ?? CheckCheck;
  const payload = event.payload ?? {};
  const gaps = Array.isArray(payload.gaps) ? (payload.gaps as string[]) : [];
  const detail =
    event.type === 'notified'
      ? `${String(payload.sent ?? 0)} ta qabul qiluvchi${payload.reason ? ` · ${String(payload.reason)}` : ''}`
      : event.type === 'status_changed' && event.fromStatus && event.toStatus
        ? `${INCIDENT_STATUS[event.fromStatus].label} → ${INCIDENT_STATUS[event.toStatus].label}`
        : null;

  return (
    <li className="relative">
      <span
        className={cn(
          'absolute top-0.5 -left-[31px] grid size-5 place-items-center rounded-full ring-4 ring-[var(--surface)]',
          event.type === 'escalated' || event.type === 'created'
            ? 'bg-danger-500 text-white'
            : event.type === 'auto_resolved'
              ? 'bg-ok-500 text-white'
              : 'bg-[var(--surface-sunken)] text-muted',
        )}
      >
        <Icon className="size-3" strokeWidth={2.4} />
      </span>
      <p className="text-ui font-semibold text-strong">
        {EVENT_LABELS[event.type]}
        {detail ? (
          <span className="font-normal text-muted"> · {detail}</span>
        ) : null}
      </p>
      <p className="text-micro text-faint">
        {formatDateTimeUz(event.at)} · {event.actor}
      </p>
      {event.note ? (
        <p className="mt-1 rounded-md bg-[var(--surface-sunken)] px-2.5 py-1.5 text-meta whitespace-pre-line text-ink">
          {event.note}
        </p>
      ) : null}
      {gaps.length > 0 ? (
        <p className="mt-1 rounded-md bg-warn-50 px-2.5 py-1.5 text-micro font-medium text-warn-700 dark:bg-warn-400/10 dark:text-warn-300">
          ⚠ Bo‘shliq: {gaps.join('; ')}
        </p>
      ) : null}
    </li>
  );
}
