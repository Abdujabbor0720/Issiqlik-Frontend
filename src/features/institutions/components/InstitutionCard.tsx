import { ArrowUpRight } from 'lucide-react';
import { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { GaugeItem } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { stablePhase } from '@/features/map/flow/flow-geometry';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz, formatTimeUz } from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';
import { deltaT, isLive, typeIcon } from '../institution-meta';
import { TempGauge, type GaugeKind } from './TempGauge';

/**
 * MUASSASA KARTASI — bitta qozonxona: kirish va chiqish shkalalari.
 *
 * ⚠️ Holat (Faol / O'rta / Ishlamayapti / Aloqa yo'q) — PASTKI qatorda,
 * nuqta + MATN bilan: rang yagona belgi emas. Yuqoridagi ingichka chiziq
 * faqat jonli kartada — ko'z ro'yxatda «tirik» kartani darhol topadi.
 */
export const InstitutionCard = memo(function InstitutionCard({
  item,
  norm,
  reducedMotion,
  selectedKind,
  onInspect,
}: {
  item: GaugeItem;
  norm: number;
  reducedMotion: boolean;
  /** Shu kartadagi qaysi shkala tafsilotlar oynasida ochiq. */
  selectedKind: GaugeKind | null;
  onInspect: (item: GaugeItem, kind: GaugeKind, trigger: HTMLElement) => void;
}) {
  const live = isLive(item);
  const meta = BOILER_STATUS[item.status];
  const Icon = typeIcon(item.objectTypeCode);
  const phase = stablePhase(item.boilerId);
  const dt = deltaT(item);
  const name = item.organizationName ?? `Lot ${item.lotNumber}`;

  const inspect = useCallback(
    (kind: GaugeKind, trigger: HTMLButtonElement) =>
      onInspect(item, kind, trigger),
    [item, onInspect],
  );

  return (
    <article
      className={cn(
        'gauge-card card relative flex flex-col overflow-hidden',
        !live && 'opacity-[0.92]',
      )}
      aria-label={name}
    >
      {live ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${meta.hex}, transparent)`,
          }}
        />
      ) : null}

      <header className="flex items-start gap-3 px-4 pt-4">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-tile',
            live
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300'
              : 'bg-[var(--surface-sunken)] text-faint',
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-2 text-ui leading-snug font-semibold text-strong"
            title={name}
          >
            {name}
          </h3>
          <p className="mt-0.5 truncate text-micro text-muted">
            {item.objectTypeName ?? 'Turi belgilanmagan'}
            <span className="text-faint"> · </span>
            <span className="tabular-nums">{item.lotNumber}</span>
          </p>
        </div>
        <Link
          to={`/boilers/${item.boilerId}`}
          aria-label={`${name} — kotyol sahifasi`}
          title="Kotyol sahifasi"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-faint ring-1 ring-[var(--border-subtle)] transition-colors ring-inset hover:bg-[var(--surface-sunken)] hover:text-strong focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:outline-none"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </header>

      <div className="grid grid-cols-2 place-items-center gap-1 px-3 pt-2 pb-1">
        <TempGauge
          kind="inlet"
          value={item.inlet}
          delta={item.inletDelta}
          live={live}
          phase={phase}
          reducedMotion={reducedMotion}
          selected={selectedKind === 'inlet'}
          onInspect={inspect}
        />
        <TempGauge
          kind="outlet"
          value={item.outlet}
          delta={item.outletDelta}
          live={live}
          norm={norm}
          phase={(phase + 0.37) % 1}
          reducedMotion={reducedMotion}
          selected={selectedKind === 'outlet'}
          onInspect={inspect}
        />
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-subtle)] px-4 py-2.5 text-micro">
        <span className="text-muted">
          ΔT{' '}
          <b className="font-semibold text-strong tabular-nums">
            {formatTemperature(dt)}
          </b>
        </span>
        <StatusLine item={item} live={live} />
      </footer>
    </article>
  );
});

function StatusLine({ item, live }: { item: GaugeItem; live: boolean }) {
  const meta = BOILER_STATUS[item.status];

  if (live) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-muted">
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span
            className="rail-live-ping absolute inset-0 rounded-full"
            style={{ backgroundColor: meta.hex }}
          />
          <span
            className="relative size-2 rounded-full"
            style={{ backgroundColor: meta.hex }}
          />
        </span>
        <span className="truncate">
          <span className="font-medium text-strong">{meta.short}</span>
          {item.lastReadingAt ? ` · ${formatTimeUz(item.lastReadingAt)}` : ''}
        </span>
      </span>
    );
  }

  const when = !item.hasDevice
    ? 'modul ulanmagan'
    : item.lastReadingAt
      ? formatRelativeUz(item.lastReadingAt)
      : 'o‘lchov kelmagan';

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted">
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full', meta.dot)}
      />
      <span className="truncate">
        {meta.short} · {when}
      </span>
    </span>
  );
}
