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
import { useState, type CSSProperties, type ReactNode } from 'react';
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
  ACTIVE_INCIDENT_STATUSES,
  AUDIENCE_LABELS,
  EVENT_LABELS,
  INCIDENT_KIND,
  INCIDENT_STATUS,
  formatMinutes,
  formatWeekdays,
} from '@/shared/constants/incident';
import { ALERT_SEVERITY } from '@/shared/constants/status';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
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
 * Tarix tugunining rangi. ⚠️ Faqat XAVF ning BURILISH nuqtalari rangli
 * (aniqlandi, og'irlashdi, qaytdi, o'zi tiklandi); izoh va bildirishnoma —
 * betaraf. Har tugun rangli bo'lsa, uzun tarixda muhim nuqta yo'qolardi.
 */
const EVENT_TONE: Partial<Record<IncidentTimelineItem['type'], string>> = {
  created: 'bg-danger-500 text-white',
  escalated: 'bg-danger-500 text-white',
  severity_raised: 'bg-warn-400 text-white',
  reopened: 'bg-warn-400 text-white',
  auto_resolved: 'bg-ok-500 text-white',
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
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[76px] w-full max-w-lg" />
        <Skeleton className="h-[420px]" />
      </div>
    );
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
  const critical = incident.severity === 'critical';
  const active = ACTIVE_INCIDENT_STATUSES.includes(incident.status);
  const ended = incident.status === 'resolved' || incident.status === 'closed';
  const thresholdLabel =
    incident.kind === 'room_low_temperature'
      ? 'Belgilangan minimal harorat'
      : 'Belgilangan me‘yor';
  const thresholdText =
    incident.threshold === null
      ? '—'
      : incident.kind === 'no_circulation'
        ? `ayirma ≥ ${formatTemperature(incident.threshold)}`
        : formatTemperature(incident.threshold);

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
      <PageHeader
        leading={
          <Link
            to="/incidents"
            aria-label="XAVF ro‘yxatiga qaytish"
            title="XAVF ro‘yxati"
            className="group grid size-9 place-items-center rounded-lg bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] transition-[color,box-shadow,transform] duration-200 ease-out-quint hover:text-strong hover:shadow-[var(--shadow-raise)] active:scale-95 dark:bg-white/[0.04]"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 ease-out-expo group-hover:-translate-x-0.5" />
          </Link>
        }
        eyebrow={`XAVF №${incident.number} · ${incident.district.name}`}
        title={
          <>
            <span className="text-danger-600 dark:text-danger-300">XAVF:</span>{' '}
            {kind.label}
          </>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge className={status.chip} dot={status.dot}>
              {status.label}
            </Badge>
            <Badge className={severity.chip} dot={severity.dot}>
              {severity.label}
            </Badge>
            {incident.escalationLevel > 0 ? (
              <Badge className="bg-danger-600 text-white shadow-[0_4px_12px_-4px_rgb(200_54_44/0.6)]">
                <TrendingUp className="size-3" />
                Eskalatsiya: {incident.escalationLevel}-daraja
              </Badge>
            ) : null}
            {incident.resolution === 'auto' ? (
              <Badge className="bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25">
                Tizim avtomatik qayd etdi
              </Badge>
            ) : null}
          </div>
        }
      />

      {/* ───── Ogohlantirish kartasi (§5) ───── */}
      <Card className="overflow-hidden">
        {/*
          ⚠️ Og'irlik rangi (chiziq + fon) faqat FAOL hodisada: bartaraf
          etilgan yoki yopilgan XAVF qizil «yonib» tursa, ochiq hodisa
          bilan adashtirilardi. Og'irlikning o'zi baribir yorliqda turadi.
        */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-x-0 top-0 h-[3px]',
            !active
              ? 'bg-[var(--border-strong)]'
              : critical
                ? 'bg-danger-500'
                : 'bg-warn-400',
          )}
        />
        <div
          className={cn(
            'flex flex-wrap items-stretch gap-x-7 gap-y-4 px-5 pt-5 pb-4',
            !active
              ? 'bg-[var(--surface-muted)]'
              : critical
                ? 'bg-danger-50/60 dark:bg-danger-500/[0.07]'
                : 'bg-warn-50/60 dark:bg-warn-400/[0.06]',
          )}
        >
          <span
            className={cn(
              'relative grid size-14 shrink-0 place-items-center self-center rounded-tile ring-1 ring-inset',
              critical
                ? 'bg-danger-100 text-danger-700 ring-danger-200 dark:bg-danger-500/20 dark:text-danger-200 dark:ring-danger-400/30'
                : 'bg-warn-100 text-warn-700 ring-warn-200 dark:bg-warn-400/20 dark:text-warn-200 dark:ring-warn-400/30',
            )}
          >
            <KindIcon className="size-6" strokeWidth={2} />
            {critical && active ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex size-3"
              >
                <span className="live-ping absolute inset-0 rounded-full bg-danger-500" />
                <span className="relative size-3 rounded-full bg-danger-500 ring-2 ring-[var(--surface)]" />
              </span>
            ) : null}
          </span>

          <Readout label="Joriy harorat">
            <AnimatedNumber
              value={formatTemperature(incident.currentTemperature)}
              className="figure-display block text-figure"
            />
            <span className="mt-1.5 block text-micro text-muted">
              aniqlanganda {formatTemperature(incident.temperature)}
              {lowKind
                ? ` · eng past ${formatTemperature(incident.extremeTemperature)}`
                : ''}
            </span>
          </Readout>

          <Readout label={thresholdLabel} divided>
            <span className="figure-display block text-[24px]" data-numeric>
              {thresholdText}
            </span>
          </Readout>

          <Readout label="Davomiyligi" divided>
            <span className="figure-display block text-[24px]" data-numeric>
              {formatMinutes(incident.durationMinutes)}
            </span>
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1.5 text-micro font-medium',
                ended ? 'text-muted' : 'text-danger-600 dark:text-danger-300',
              )}
            >
              {!ended ? (
                <span aria-hidden className="relative flex size-1.5">
                  <span className="live-ping absolute inset-0 rounded-full bg-danger-500" />
                  <span className="relative size-1.5 rounded-full bg-danger-500" />
                </span>
              ) : null}
              {ended ? 'davom etdi' : 'davom etmoqda'}
            </span>
          </Readout>

          <Readout label="Oxirgi tasdiq" divided>
            <span className="block font-display text-[17px] leading-tight font-[700] tracking-[-0.01em] text-strong [font-stretch:106%]">
              {formatRelativeUz(incident.lastSeenAt)}
            </span>
          </Readout>
        </div>
        <div className="h-px bg-line" />

        <CardBody className="pt-1">
          <dl className="grid grid-cols-1 gap-x-8 text-ui md:grid-cols-2">
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
            <Fact label={thresholdLabel} value={thresholdText} />
            <Fact
              label="Aniqlangan vaqt"
              value={
                <>
                  <span className="font-mono text-[12.5px] tabular-nums">
                    {formatDateTimeUz(incident.detectedAt)}
                  </span>
                  <span className="text-muted">
                    {' '}
                    · {formatMinutes(incident.durationMinutes)}{' '}
                    {ended ? 'davom etdi' : 'davom etmoqda'}
                  </span>
                </>
              }
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
                      className="ml-2 rounded-sm text-meta font-semibold text-brand-600 underline-offset-4 transition-colors hover:text-brand-700 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
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
                  tone="ok"
                  title={
                    incident.resolution === 'auto'
                      ? 'Avtomatik bartaraf'
                      : 'Bajarilgan ishlar'
                  }
                  text={incident.resolutionNote}
                />
              ) : null}
              {incident.closeNote ? (
                <Note
                  tone="brand"
                  title="Tekshiruv natijasi"
                  text={incident.closeNote}
                />
              ) : null}
            </div>
          ) : null}
        </CardBody>

        {!closed && (actions.length > 0 || can('incidents.act')) ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3">
            <span className="label-eyebrow mr-1 hidden sm:inline">Amallar</span>
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
            eyebrow={`${incident.timeline.length} ta yozuv`}
            title="Hodisa tarixi"
            subtitle="Har bir amal kim va qachon qilgani bilan saqlanadi"
          />
          <CardBody>
            <ol className="flex flex-col">
              {incident.timeline.map((event, index) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  index={index}
                  last={index === incident.timeline.length - 1}
                />
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
                  <p className="label-eyebrow mt-2 flex items-center gap-2">
                    Hozirgi javobgarlar
                    <span aria-hidden className="h-px flex-1 bg-line" />
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
                incident.notifications.map((row, index) => (
                  <div
                    key={row.id}
                    className="reveal flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface-sunken)] px-3 py-2 text-meta ring-1 ring-[var(--border-subtle)] transition-colors duration-200 ring-inset hover:bg-[var(--surface-muted)]"
                    style={{ '--i': Math.min(index, 12) } as CSSProperties}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {/* Daraja belgisi: 0 — dastlabki, 1+ — eskalatsiya. */}
                      <span
                        title={
                          row.level > 0
                            ? `${row.level}-daraja eskalatsiya`
                            : 'Dastlabki ogohlantirish'
                        }
                        className={cn(
                          'grid h-5 min-w-5 shrink-0 place-items-center rounded-[4px] px-1 font-mono text-[10px] font-semibold tabular-nums',
                          row.level > 0
                            ? 'bg-danger-500 text-white'
                            : 'bg-[var(--surface)] text-muted ring-1 ring-[var(--border-subtle)] dark:bg-white/[0.05]',
                        )}
                      >
                        {row.level}
                      </span>
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
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-micro',
                        row.readAt
                          ? 'font-medium text-ok-600 dark:text-ok-300'
                          : 'text-faint',
                      )}
                    >
                      {row.readAt ? (
                        <CheckCheck className="size-3.5" aria-hidden />
                      ) : null}
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

/**
 * ASBOB KO'RSATKICHI — kartaning tepasidagi «pult» katagi.
 * ⚠️ Ajratgich chiziq (`divided`) faqat keng ekranda: tor ekranda
 * katakchalar qatorga o'raladi va vertikal chiziq yolg'iz osilib qolardi.
 */
function Readout({
  label,
  divided,
  children,
}: {
  label: string;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-w-[120px] flex-col justify-center',
        divided && 'sm:border-l sm:border-[var(--border-subtle)] sm:pl-7',
      )}
    >
      <span className="label-eyebrow mb-1.5">{label}</span>
      {children}
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
    <div className="flex flex-col gap-0.5 border-b border-[var(--border-cell)] py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="label-eyebrow shrink-0 sm:w-44">{label}</dt>
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

function Note({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: 'ok' | 'brand';
}) {
  return (
    <div
      className={cn(
        'rounded-lg bg-[var(--surface-sunken)] py-2.5 pr-3.5 pl-4 ring-1 ring-[var(--border-subtle)] ring-inset',
        tone === 'ok'
          ? 'shadow-[inset_3px_0_0_var(--color-ok-500)]'
          : 'shadow-[inset_3px_0_0_var(--color-brand-500)]',
      )}
    >
      <p className="label-eyebrow">{title}</p>
      <p className="mt-1 text-ui whitespace-pre-line text-ink">{text}</p>
    </div>
  );
}

function ResponsibleRow({ person }: { person: IncidentResponsible }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-3.5 py-2.5 ring-1 ring-[var(--border-subtle)] transition-[background-color,box-shadow] duration-200 ring-inset hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]',
        /* Asosiy javobgar — chap chetda sariq urg'u (yulduz bilan bir rang). */
        person.isPrimary && 'shadow-[inset_3px_0_0_var(--color-warn-400)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display text-[14.5px] font-[700] tracking-[-0.005em] text-strong [font-stretch:104%]">
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
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted tabular-nums">
            <Phone className="size-3.5" />
            {person.phone}
          </span>
        ) : (
          <a
            href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 font-mono text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors ring-inset tabular-nums hover:bg-brand-100 dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25 dark:hover:bg-brand-400/20"
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

/**
 * TARIX YOZUVI.
 * ⚠️ Vertikal chiziq har yozuvning O'ZIDA (keyingi tugungacha), umumiy
 * `border-l` emas: oxirgi tugundan keyin chiziq pastga osilib qolmaydi.
 * Vaqt — monoshriftda: ustma-ust turgan vaqtlar bir xil kenglikda.
 */
function TimelineEvent({
  event,
  index,
  last,
}: {
  event: IncidentTimelineItem;
  index: number;
  last: boolean;
}) {
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
    <li
      className="reveal relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0"
      style={{ '--i': Math.min(index, 12) } as CSSProperties}
    >
      {!last ? (
        <span
          aria-hidden
          className="absolute top-8 bottom-0 left-[13.5px] w-px bg-[var(--border-strong)]"
        />
      ) : null}
      <span
        className={cn(
          'relative z-[1] grid size-7 place-items-center rounded-full ring-4 ring-[var(--surface)]',
          EVENT_TONE[event.type] ??
            'bg-[var(--surface-sunken)] text-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]',
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.3} />
      </span>
      <div className="min-w-0 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-ui font-semibold text-strong">
            {EVENT_LABELS[event.type]}
            {detail ? (
              <span className="font-normal text-muted"> · {detail}</span>
            ) : null}
          </p>
          <time
            dateTime={event.at}
            className="shrink-0 font-mono text-[11px] text-faint tabular-nums"
          >
            {formatDateTimeUz(event.at)}
          </time>
        </div>
        <p className="text-micro text-muted">{event.actor}</p>
        {event.note ? (
          <p className="mt-1.5 rounded-md bg-[var(--surface-sunken)] px-2.5 py-1.5 text-meta whitespace-pre-line text-ink ring-1 ring-[var(--border-subtle)] ring-inset">
            {event.note}
          </p>
        ) : null}
        {gaps.length > 0 ? (
          <p className="mt-1.5 rounded-md bg-warn-50 px-2.5 py-1.5 text-micro font-medium text-warn-700 ring-1 ring-warn-200 ring-inset dark:bg-warn-400/10 dark:text-warn-300 dark:ring-warn-400/25">
            ⚠ Bo‘shliq: {gaps.join('; ')}
          </p>
        ) : null}
      </div>
    </li>
  );
}
