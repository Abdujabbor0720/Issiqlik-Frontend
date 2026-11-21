import { ArrowUpRight, Phone, RotateCcw, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { IncidentListItem } from '@/shared/api/types';
import {
  ACTIVE_INCIDENT_STATUSES,
  INCIDENT_KIND,
  INCIDENT_STATUS,
  formatMinutes,
} from '@/shared/constants/incident';
import { ALERT_SEVERITY } from '@/shared/constants/status';
import { Badge } from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz } from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';

/**
 * OGOHLANTIRISH KARTASI (ro'yxat qatori) — texnik topshiriq §5:
 * XAVF turi, tuman, muassasa, qurilma, harorat va me'yor, aniqlangan
 * vaqt, javobgar (F.I.Sh., lavozim, telefon), holat.
 *
 * ⚠️ Telefon niqoblangan bo'lsa ham shu yerda ko'rinadi (`+998 ** …`):
 * kim javobgar ekani ajraladi, raqamning o'zi esa faqat ruxsat egasida.
 *
 * ⚠️ Chap chetdagi OG'IRLIK CHIZIG'I faqat FAOL hodisada rangli: yopilgan
 * yoki bartaraf etilgan qator ham qizil chiziq bilan tursa, «Yopilgan»
 * tabida ham ekran «yonib» turardi va ko'z haqiqiy xavfni ajratolmasdi.
 * Jonli to'lqin (`live-ping`) — faqat faol KRITIK hodisada: miltillash
 * EMAS, sekin to'lqin — diqqatni tortadi, lekin charchatmaydi.
 */
export function IncidentCard({ incident }: { incident: IncidentListItem }) {
  const kind = INCIDENT_KIND[incident.kind];
  const status = INCIDENT_STATUS[incident.status];
  const severity = ALERT_SEVERITY[incident.severity];
  const Icon = kind.icon;
  const responsible = incident.primaryResponsible;
  const place = incident.room?.name ?? incident.device?.label ?? null;
  const lowKind =
    incident.kind === 'room_low_temperature' ||
    incident.kind === 'boiler_low_temperature';
  const critical = incident.severity === 'critical';
  const active = ACTIVE_INCIDENT_STATUSES.includes(incident.status);
  const urgent = critical && active;

  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="group relative flex flex-wrap items-start gap-3.5 px-5 py-4 transition-[background-color,box-shadow] duration-200 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]"
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-3 left-0 w-[3px] origin-left rounded-r-full transition-transform duration-300 ease-out-expo group-hover:scale-x-[1.6]',
          !active
            ? 'bg-[var(--border-strong)]'
            : critical
              ? 'bg-danger-500'
              : 'bg-warn-400',
        )}
      />

      <span
        className={cn(
          'relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-tile ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover:-rotate-3',
          critical
            ? 'bg-danger-50 text-danger-600 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30'
            : 'bg-warn-50 text-warn-600 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
        )}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
        {urgent ? (
          <span aria-hidden className="absolute -top-1 -right-1 flex size-2.5">
            <span className="live-ping absolute inset-0 rounded-full bg-danger-500" />
            <span className="relative size-2.5 rounded-full bg-danger-500 ring-2 ring-[var(--surface)]" />
          </span>
        ) : null}
      </span>

      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-micro font-semibold text-faint tabular-nums">
            №{incident.number}
          </span>
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
          {incident.reopenCount > 0 ? (
            <Badge className="bg-[var(--surface-sunken)] text-muted ring-1 ring-[var(--border-subtle)]">
              <RotateCcw className="size-3" />
              {incident.reopenCount} marta qaytgan
            </Badge>
          ) : null}
        </div>

        <p className="mt-2 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-danger-600 uppercase dark:text-danger-300">
          XAVF: {kind.label}
        </p>
        <p className="mt-0.5 font-display text-[15px] leading-snug font-[700] tracking-[-0.01em] text-strong [font-stretch:104%]">
          {incident.organization?.name ??
            boilerName(null, incident.boiler.lotNumber)}
          {place ? (
            <span className="font-sans text-ui font-normal tracking-normal text-muted">
              {' '}
              · {place}
            </span>
          ) : null}
        </p>

        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-meta sm:grid-cols-2">
          <Row label="Tuman" value={incident.district.name} />
          <Row
            label="Aniqlangan"
            value={
              <>
                <span className="font-mono text-[11.5px] tabular-nums">
                  {formatDateTimeUz(incident.detectedAt)}
                </span>
                <span className="text-muted">
                  {' '}
                  · {formatMinutes(incident.durationMinutes)}
                </span>
              </>
            }
          />
          {incident.agency?.name ? (
            <Row label="Tashkilot" value={incident.agency.name} />
          ) : null}
          {responsible ? (
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-faint">Javobgar:</dt>
              <dd className="min-w-0 truncate text-ink">
                {responsible.fullName}
                <span className="text-muted"> · {responsible.position}</span>
                <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-muted tabular-nums">
                  <Phone className="size-3" />
                  {responsible.phone}
                </span>
              </dd>
            </div>
          ) : (
            <Row label="Javobgar" value="biriktirilmagan" warn />
          )}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-4 self-center">
        <div className="text-right">
          <p className="figure-display text-[26px]" data-numeric>
            {formatTemperature(incident.currentTemperature)}
          </p>
          <p className="label-eyebrow mt-1.5">
            {lowKind && incident.threshold !== null
              ? `me‘yor: ${formatTemperature(incident.threshold)}`
              : 'joriy harorat'}
          </p>
        </div>
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-md text-faint ring-1 ring-[var(--border-subtle)] transition-[background-color,color,box-shadow,transform] duration-300 ease-out-expo ring-inset group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-[var(--shadow-brand)] group-hover:ring-brand-500"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-faint">{label}:</dt>
      <dd
        className={cn(
          'min-w-0 truncate',
          warn ? 'font-medium text-warn-700 dark:text-warn-300' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
