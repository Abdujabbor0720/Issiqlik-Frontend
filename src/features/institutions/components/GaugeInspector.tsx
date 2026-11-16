import { ArrowUpRight, Map as MapIcon, MapPin, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GaugeItem } from '@/shared/api/types';
import { BRAND } from '@/shared/constants/brand';
import { BOILER_STATUS } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';
import { useFiltersStore } from '@/store/filters.store';
import { deltaT, isLive } from '../institution-meta';
import type { GaugeKind } from './TempGauge';
import { boilerName, lotLabel } from '@/shared/utils/boiler';

export interface InspectTarget {
  item: GaugeItem;
  kind: GaugeKind;
  trigger: HTMLElement;
}

const PANEL_WIDTH = 304;
const GAP = 10;

/**
 * TAFSILOTLAR OYNASI — shkala bosilganda: AVVAL TUMAN.
 *
 * ⚠️ Tuman kartada ataylab yozilmagan (karta toza qolsin), lekin
 * «bu harorat qaysi tumanda» — rahbarning birinchi savoli. Shuning uchun
 * oyna tuman bilan boshlanadi va «Xaritada ko'rish» o'sha tumanni
 * xaritada ochadi (umumiy tuman filtri orqali — boshqa ekranlar ham
 * shu tumanga o'tadi).
 *
 * ⚠️ BITTA oyna butun sahifaga (har shkala uchun alohida popover emas):
 * yuzlab karta bo'lishi mumkin. Joyi bosilgan shkaladan hisoblanadi —
 * pastda joy bo'lmasa tepasida; aylantirish yoki o'lcham o'zgarsa yopiladi
 * (aks holda u bo'shliqda «osilib» qolardi).
 */
export function GaugeInspector({
  target,
  norm,
  onClose,
}: {
  target: InspectTarget;
  norm: number;
  onClose: () => void;
}) {
  const { item, kind, trigger } = target;
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setDistrict = useFiltersStore((state) => state.setDistrict);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const anchor = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const below = anchor.bottom + GAP;
    /* Pastda joy bo'lmasa — tepada; u yerda ham sig'masa (past ekran,
       yotiq telefon) — ekran ichiga qisiladi, oyna esa o'zi suriladi
       (`max-height`), tugmalar ekrandan tashqarida qolmaydi. */
    const preferred =
      below + height <= window.innerHeight - 8
        ? below
        : anchor.top - GAP - height;
    const top = Math.max(8, Math.min(preferred, window.innerHeight - height - 8));
    const left = Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    setPosition({ top, left });
  }, [trigger, item.boilerId, kind]);

  /* Fokus oynaga — joyi hisoblangandan KEYIN (birinchi kadrda u
     `visibility: hidden` va yashirin elementga fokus berib bo'lmaydi).
     Yopilganda — bosilgan shkalaga qaytadi. */
  const placed = position !== null;
  useEffect(() => {
    if (placed) panelRef.current?.focus({ preventScroll: true });
  }, [placed, trigger]);
  /* ⚠️ Fokus faqat YO'QOLGAN bo'lsa qaytariladi (oyna bilan birga o'chib,
     `body` ga tushgan): foydalanuvchi Tab bilan o'zi boshqa joyga o'tgan
     bo'lsa, uni shkalaga tortib qaytarish — fokusni o'g'irlash. */
  useEffect(
    () => () => {
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if (lost && trigger.isConnected) trigger.focus({ preventScroll: true });
    },
    [trigger],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent): void => {
      const node = event.target as Node;
      if (panelRef.current?.contains(node) || trigger.contains(node)) return;
      onClose();
    };
    /*
     * ⚠️ Faqat SAHIFA surilsa yopiladi (shkala joyidan ketdi). Ichki
     * suriladigan joylar (tur tablari qatori) oynaga tegmaydi.
     */
    const onScroll = (event: Event): void => {
      if (event.target === document) onClose();
    };
    /*
     * ⚠️ Faqat KENGLIK o'zgarsa: telefonda manzil satri yig'ilganda
     * yoki klaviatura chiqqanda faqat balandlik o'zgaradi — bunda
     * yopilsa, oyna «o'z-o'zidan yo'qolib» qolardi.
     */
    const startWidth = window.innerWidth;
    const onResize = (): void => {
      if (window.innerWidth !== startWidth) onClose();
    };
    // Fokus oynadan ham, shkaladan ham chiqib ketsa (Tab) — yopiladi.
    const panel = panelRef.current;
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null;
      if (!next) return;
      if (panel?.contains(next) || trigger.contains(next)) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    panel?.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      panel?.removeEventListener('focusout', onFocusOut);
    };
  }, [onClose, trigger]);

  const live = isLive(item);
  const status = BOILER_STATUS[item.status];
  const dt = deltaT(item);
  const name = boilerName(item.organizationName, item.lotNumber);

  const showOnMap = (): void => {
    setDistrict(item.districtId);
    onClose();
    navigate('/map');
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${item.districtName} — ${name}`}
      tabIndex={-1}
      className="rail-tip fixed z-50 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-card bg-[var(--surface)] p-4 shadow-[var(--shadow-pop)] ring-1 ring-[var(--border-subtle)] outline-none"
      style={{
        width: `min(${PANEL_WIDTH}px, calc(100vw - 16px))`,
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {/* ───── Tuman ───── */}
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-brand-600 text-white shadow-[var(--shadow-brand)]">
          <MapPin className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow">Tuman</p>
          <p className="text-lede leading-tight font-semibold text-strong">
            {item.districtName}
          </p>
          <p className="text-micro text-muted">{BRAND.scope}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="-mt-1 -mr-1 grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ───── Muassasa ───── */}
      <div className="mt-3 rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5">
        <p className="line-clamp-2 text-ui leading-snug font-medium text-strong">
          {name}
        </p>
        <p className="mt-0.5 text-micro text-muted">
          {item.objectTypeName ?? 'Turi belgilanmagan'} ·{' '}
          <span className="tabular-nums">{lotLabel(item.lotNumber)}</span>
        </p>
      </div>

      {/* ───── Qiymatlar ───── */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Value
          label="Kirish"
          value={formatTemperature(item.inlet)}
          hue="var(--gauge-inlet)"
          active={kind === 'inlet'}
          live={live}
        />
        <Value
          label="Chiqish"
          value={formatTemperature(item.outlet)}
          hue="var(--gauge-outlet)"
          active={kind === 'outlet'}
          live={live}
        />
        <Value label="ΔT" value={formatTemperature(dt)} live={live} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2 rounded-full', status.dot)} />
          <span className="font-medium text-strong">{status.label}</span>
        </span>
        <span className="text-faint">·</span>
        <span>Me‘yor {formatTemperature(norm)}</span>
      </div>
      <p className="mt-1 text-micro text-muted">
        Oxirgi o‘lchov:{' '}
        {item.lastReadingAt ? (
          <>
            {formatDateTimeUz(item.lastReadingAt)}{' '}
            <span className="text-faint">
              ({formatRelativeUz(item.lastReadingAt)})
            </span>
          </>
        ) : (
          '—'
        )}
      </p>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={showOnMap}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-meta font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:outline-none"
        >
          <MapIcon className="size-4" />
          Xaritada
        </button>
        <Link
          to={`/boilers/${item.boilerId}`}
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-meta font-semibold text-strong ring-1 ring-[var(--border-strong)] transition-colors ring-inset hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:outline-none"
        >
          Kotyol
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function Value({
  label,
  value,
  hue,
  active,
  live,
}: {
  label: string;
  value: string;
  hue?: string;
  active?: boolean;
  live: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-tile px-2.5 py-2 ring-1 ring-inset',
        active
          ? 'bg-[var(--surface-sunken)] ring-[var(--border-strong)]'
          : 'ring-[var(--border-subtle)]',
      )}
    >
      <dt className="flex items-center gap-1.5 text-nano font-medium text-muted">
        {hue ? (
          <span
            aria-hidden
            className="h-2.5 w-1 rounded-full"
            style={{ backgroundColor: live ? hue : 'var(--gauge-stale)' }}
          />
        ) : null}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 text-ui font-semibold tabular-nums',
          live ? 'text-strong' : 'text-muted',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
