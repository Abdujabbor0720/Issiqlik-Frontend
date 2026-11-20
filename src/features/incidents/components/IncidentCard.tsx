import { ArrowUpRight, Phone, RotateCcw, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { IncidentListItem } from '@/shared/api/types';
import {
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

  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="group flex flex-wrap items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-sunken)]/60"
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-tile',
          incident.severity === 'critical'
            ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-danger-300'
            : 'bg-warn-50 text-warn-600 dark:bg-warn-400/14 dark:text-warn-300',
        )}
      >
        <Icon className="size-4.5" strokeWidth={2} />
      </span>

      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-micro font-semibold text-faint tabular-nums">
            №{incident.number}
          </span>
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
          {incident.reopenCount > 0 ? (
            <Badge className="bg-[var(--surface-sunken)] text-muted">
              <RotateCcw className="size-3" />
              {incident.reopenCount} marta qaytgan
            </Badge>
          ) : null}
        </div>

        <p className="mt-1.5 text-micro font-semibold tracking-wide text-danger-600 uppercase dark:text-danger-300">
          XAVF: {kind.label}
        </p>
        <p className="text-ui font-semibold text-strong">
          {incident.organization?.name ??
            boilerName(null, incident.boiler.lotNumber)}
          {place ? (
            <span className="font-normal text-muted"> · {place}</span>
          ) : null}
        </p>

        <dl className="mt-1.5 grid grid-cols-1 gap-x-5 gap-y-0.5 text-meta sm:grid-cols-2">
          <Row label="Tuman" value={incident.district.name} />
          <Row
            label="Aniqlangan"
            value={`${formatDateTimeUz(incident.detectedAt)} · ${formatMinutes(incident.durationMinutes)}`}
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
                <span className="ml-1.5 inline-flex items-center gap-1 text-muted">
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

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-head font-semibold text-strong" data-numeric>
            {formatTemperature(incident.currentTemperature)}
          </p>
          <p className="text-nano text-faint">
            {lowKind && incident.threshold !== null
              ? `me‘yor: ${formatTemperature(incident.threshold)}`
              : 'joriy harorat'}
          </p>
        </div>
        <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-brand-600" />
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
  value: string;
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
