import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { get, getPaged } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  Alert,
  DashboardSummary,
  IncidentListItem,
} from '@/shared/api/types';
import { BRAND } from '@/shared/constants/brand';
import {
  NAV_GROUP_LABELS,
  NAV_ITEMS,
  type NavItem,
} from '@/shared/constants/nav';
import {
  useMediaQuery,
  usePrefersReducedMotion,
} from '@/shared/hooks/useMediaQuery';
import { StateEmblem } from '@/shared/ui/StateEmblem';
import { cn } from '@/shared/utils/cn';
import { formatTimeUz } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { useRealtimeStore, type RealtimeLink } from '@/store/realtime.store';
import { useUiStore } from '@/store/ui.store';

const GROUPS: Array<NavItem['group']> = ['main', 'manage'];

/**
 * Menyuni yig'ish/yoyish — klaviatura tugmasi.
 *
 * ⚠️ `[` — matn maydonida EMAS (u yerda oddiy belgi), faqat sahifada.
 * `Ctrl+B` olinmadi: brauzerda u xatcho'plar paneli.
 *
 * ⚠️⚠️ Belgi (`event.key`) emas, JISMONIY tugma (`event.code`) tekshiriladi:
 * rus/o'zbek kirill tartibida shu tugma «х» beradi va `key === '['`
 * bo'yicha yorliq bu yerdagi foydalanuvchilarning ko'pchiligida
 * ishlamasdi.
 */
const RAIL_SHORTCUT = '[';
const RAIL_SHORTCUT_CODE = 'BracketLeft';

/** Faol ko'rsatkich va yig'ilish — bitta egri (tez boshlanib, yumshoq to'xtaydi). */
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

interface TipState {
  label: string;
  detail?: string;
  top: number;
}

type TipProps = (
  label: string,
  detail?: string,
) => {
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
};

/**
 * CHAP YON PANEL — monitoring tizimining navigatsiyasi.
 *
 * ⚠️⚠️ To'q ko'k («rail»), oq EMAS. Kontent maydoni och kulrang va
 * oq kartalardan iborat; yon panel ham oq bo'lsa, u kontentga singib
 * ketib, «qayergacha menyu, qayerdan sahifa» degan chegara yo'qolardi.
 *
 * ⚠️ USLUB — jiddiy, sokin: faol bo'lim to'yingan ko'k «tabletka» bilan
 * EMAS, yupqa yorug' fon va chap chetdagi ingichka chiziq bilan
 * belgilanadi. Ko'zni tortadigan yagona narsa — ochiq ogohlantirishlar
 * soni va ulanish holati: panel e'tiborni o'ziga emas, muammoga qaratadi.
 *
 * ⚠️ Faol ko'rsatkich bo'limlar orasida SURILADI (bitta element, har
 * bandda alohida emas) — «qayerdan qayerga o'tdim» ko'zga ko'rinadi.
 * «Harakatni kamaytirish» yoqilgan bo'lsa — sakraydi, suriladi emas.
 *
 * ⚠️ YIG'ILGAN holatda (faqat desktop) har ikonkaga tooltip: brauzerning
 * `title` i bir soniya kechikib, xira chiqadi va klaviaturada umuman
 * ko'rinmaydi. Telefonda menyu HAR DOIM to'liq — yig'ilgan menyu tortma
 * ichida ma'nosiz.
 */
export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const can = useAuthStore((state) => state.can);
  const railCollapsed = useUiStore((state) => state.railCollapsed);
  const toggleRail = useUiStore((state) => state.toggleRail);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reducedMotion = usePrefersReducedMotion();
  const collapsed = railCollapsed && isDesktop;

  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );
  const groups = GROUPS.map((group) => ({
    group,
    items: visible.filter((item) => item.group === group),
  })).filter(({ items }) => items.length > 0);

  /*
   * ⚠️ Ochiq ogohlantirishlar soni MENYUDA ko'rsatiladi. Faqat
   * «Ogohlantirishlar» sahifasida bo'lsa, operator u yerga kirmaguncha
   * muammodan bexabar qolardi — holbuki tizimning butun maqsadi aynan
   * shu xabarni yetkazish.
   */
  const { data: alerts } = useQuery({
    queryKey: qk.alerts({ badge: true }),
    queryFn: () =>
      getPaged<Alert>(API.alerts.list, {
        params: { limit: 1, states: 'open' },
      }),
    enabled: can('alerts.view'),
    refetchInterval: 60_000,
  });
  const openAlerts = alerts?.meta.total ?? 0;
  const alertsText = openAlerts > 99 ? '99+' : formatNumber(openAlerts);

  /*
   * ⚠️ Faol XAVF soni ham menyuda: mas'ul «XAVF» bo'limiga kirmasdan
   * ham muammo borligini ko'rishi kerak. Realtime hodisasi bu kalitni
   * (`incidents` prefiksi) darhol yangilaydi.
   */
  const { data: incidents } = useQuery({
    queryKey: qk.incidentBadge,
    queryFn: () =>
      getPaged<IncidentListItem>(API.incidents.list, {
        params: { limit: 1, statuses: 'new,acknowledged,in_progress' },
      }),
    enabled: can('incidents.view'),
    refetchInterval: 60_000,
  });
  const activeIncidents = incidents?.meta.total ?? 0;
  const incidentsText =
    activeIncidents > 99 ? '99+' : formatNumber(activeIncidents);

  /* ───────── Tooltip (faqat yig'ilgan holatda) ───────── */
  const [tip, setTip] = useState<TipState | null>(null);
  const showTip = useCallback(
    (target: HTMLElement, label: string, detail?: string) => {
      const aside = asideRef.current;
      if (!aside) return;
      const box = aside.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      setTip({ label, detail, top: rect.top - box.top + rect.height / 2 });
    },
    [],
  );
  const hideTip = useCallback(() => setTip(null), []);
  /* ⚠️ Menyu yoyilganda (masalan oyna 1024 px dan torayganda) tooltip
     ham o'chadi: aks holda qayta yig'ilganda eski joyida «osilib»
     paydo bo'lardi. */
  useEffect(() => {
    if (!collapsed) setTip(null);
  }, [collapsed]);
  const tipProps: TipProps = (label, detail) =>
    collapsed
      ? {
          onMouseEnter: (event) => showTip(event.currentTarget, label, detail),
          onMouseLeave: hideTip,
          onFocus: (event) => showTip(event.currentTarget, label, detail),
          onBlur: hideTip,
        }
      : {};

  /* ───────── Surilib yuradigan faol ko'rsatkich ───────── */
  const [indicator, setIndicator] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);

  useLayoutEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const measure = (): void => {
      // NavLink faol bandga `aria-current="page"` qo'yadi — yagona manba.
      const active = root.querySelector<HTMLElement>('a[aria-current="page"]');
      setIndicator(
        active ? { top: active.offsetTop, height: active.offsetHeight } : null,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pathname, collapsed, visible.length]);

  /* ⚠️ Birinchi chizishda o'tish YO'Q: aks holda ko'rsatkich har sahifa
     ochilganda tepadan «uchib kelardi». */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIndicatorReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* ───────── Klaviatura: `[` — yig'ish/yoyish ───────── */
  useEffect(() => {
    if (!isDesktop) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.code !== RAIL_SHORTCUT_CODE ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        event.defaultPrevented
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          // Oyna ochiq bo'lsa menyu uning ORQASIDA yig'ilib ketmasin.
          target.closest(
            '[role="dialog"],[aria-modal="true"],[role="textbox"],[role="combobox"],[role="listbox"]',
          ))
      ) {
        return;
      }
      event.preventDefault();
      setTip(null);
      toggleRail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, toggleRail]);

  /*
   * ───────── Telefon: tortma ─────────
   * ⚠️ Ochiq tortma ostida sahifa AYLANMAYDI (aks holda barmoq menyuni
   * emas, orqadagi jadvalni surardi), Esc yopadi, fokus yopish tugmasiga
   * o'tadi — klaviatura/ekran o'quvchi foydalanuvchisi tortma ichida
   * boshlaydi. Yopilganda fokus uni OCHGAN tugmaga qaytadi (aks holda
   * u `<body>` ga tushib, foydalanuvchi sahifa boshidan qayta Tab
   * bosib chiqardi). Orqadagi sahifa `inert` — `AppLayout` da.
   */
  useEffect(() => {
    if (!mobileOpen || isDesktop) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
      const aside = asideRef.current;
      const active = document.activeElement;
      const focusLost =
        active === document.body ||
        (active instanceof HTMLElement &&
          active.matches('[data-rail-overlay]')) ||
        (aside !== null && aside.contains(active));
      if (focusLost && opener?.isConnected) opener.focus();
    };
  }, [mobileOpen, isDesktop, onCloseMobile]);

  return (
    <>
      {/* Telefon qoplamasi — yumshoq paydo bo'ladi, sakramaydi. */}
      <button
        type="button"
        aria-label="Menyuni yopish"
        data-rail-overlay
        tabIndex={-1}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-neutral-950/55 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        ref={asideRef}
        aria-label="Bo‘limlar"
        /* ⚠️ Yopiq tortma klaviaturadan ham yashiriladi: ekrandan
           tashqarida bo'lsa ham Tab unga kirib, fokus «g'oyib» bo'lardi. */
        inert={!isDesktop && !mobileOpen}
        className={cn(
          'grain fixed inset-y-0 left-0 z-40 flex flex-col text-white',
          'w-[min(86vw,288px)] transition-[width,transform] duration-300',
          EASE,
          collapsed ? 'lg:w-rail-tight' : 'lg:w-rail',
          // ⚠️ Mobilda panel SURILIB chiqadi; `hidden` ishlatilmaydi,
          // chunki `hidden` da o'tish animatsiyasi bo'lmaydi.
          mobileOpen
            ? 'translate-x-0 shadow-[0_24px_64px_-12px_rgb(0_0_0/0.6)]'
            : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          /* Chuqurlik — juda nozik: yuqori chap burchakda brend
             ko'kining tushishi, pastga qarab to'qlashuv. */
          background:
            'radial-gradient(120% 38% at 0% 0%, rgb(22 115 214 / 0.22) 0%, transparent 62%), radial-gradient(90% 30% at 100% 100%, rgb(255 127 31 / 0.08) 0%, transparent 70%), linear-gradient(180deg, var(--color-rail-900) 0%, var(--color-rail-950) 100%)',
        }}
      >
        {/* O'ng chetdagi soch tolasidek chegara. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.06]"
        />

        {/* ───── Logotip ───── */}
        <div
          className={cn(
            'relative flex h-topbar shrink-0 items-center',
            collapsed ? 'justify-center px-2' : 'gap-3 px-4',
          )}
        >
          <NavLink
            to="/"
            onClick={onCloseMobile}
            aria-label={`${BRAND.short} — bosh sahifa`}
            className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70"
            {...tipProps(BRAND.short, BRAND.scope)}
          >
            <StateEmblem size={36} glow />
            {!collapsed ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-[15px] leading-[19px] font-[780] tracking-[-0.018em] text-white [font-stretch:110%]">
                  {BRAND.short}
                </span>
                <span className="mt-0.5 truncate font-mono text-[9.5px] leading-[13px] font-semibold tracking-[0.18em] text-white/45 uppercase">
                  {BRAND.scope}
                </span>
              </span>
            ) : null}
          </NavLink>

          <button
            ref={closeRef}
            type="button"
            onClick={onCloseMobile}
            aria-label="Menyuni yopish"
            className="ml-auto grid size-9 place-items-center rounded-lg text-white/55 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-300/70 lg:hidden"
          >
            <X className="size-4" />
          </button>

          {/* Bayroq lentasi — davlat tizimi belgisi, logotip ostida. */}
          <span
            aria-hidden
            className="flag-ribbon absolute inset-x-0 bottom-0 h-[2px] opacity-75"
          />
        </div>

        {/* ───── Menyu ───── */}
        <nav
          aria-label="Asosiy menyu"
          onScroll={hideTip}
          className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3 [scrollbar-color:rgb(255_255_255/0.14)_transparent] [scrollbar-width:thin]"
        >
          <div ref={navRef} className="relative">
            {indicator ? (
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 z-0',
                  indicatorReady &&
                    !reducedMotion &&
                    cn('transition-[transform,height] duration-300', EASE),
                )}
                style={{
                  transform: `translateY(${indicator.top}px)`,
                  height: indicator.height,
                }}
              >
                <span className="absolute inset-0 rounded-lg bg-linear-to-r from-white/[0.11] via-white/[0.05] to-white/[0.02] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_10px_24px_-14px_rgb(0_0_0/0.9)] ring-1 ring-white/[0.08] ring-inset" />
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[image:var(--thermal-v)] shadow-[0_0_16px_rgb(255_165_61/0.55)]" />
              </div>
            ) : null}

            {groups.map(({ group, items }, index) => (
              <section
                key={group}
                aria-label={NAV_GROUP_LABELS[group]}
                className={cn(index > 0 && (collapsed ? 'mt-3' : 'mt-6'))}
              >
                {/* ⚠️ Guruh nomi yig'ilgan holatda YOZILMAYDI — 68 px ga
                    «BOSHQARUV» sig'maydi; o'rniga nozik chiziq. */}
                {collapsed ? (
                  index > 0 ? (
                    <div className="mx-3 mb-3 h-px bg-white/[0.08]" />
                  ) : null
                ) : (
                  <div className="mb-1.5 flex items-center gap-2.5 px-3">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-white/35 uppercase">
                      {NAV_GROUP_LABELS[group]}
                    </span>
                    <span className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )}

                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const isAlerts = item.to === '/alerts';
                    const isIncidents = item.to === '/incidents';
                    const badge =
                      (isAlerts && openAlerts > 0) ||
                      (isIncidents && activeIncidents > 0);
                    const badgeText = isIncidents ? incidentsText : alertsText;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === '/'}
                          onClick={onCloseMobile}
                          aria-label={
                            collapsed
                              ? badge
                                ? `${item.label}, ${badgeText} ta ochiq`
                                : item.label
                              : undefined
                          }
                          {...tipProps(
                            item.label,
                            badge ? `${badgeText} ta ochiq` : undefined,
                          )}
                          className={({ isActive }) =>
                            cn(
                              'group relative z-[1] flex items-center rounded-lg outline-none transition-colors duration-150',
                              'focus-visible:ring-2 focus-visible:ring-brand-300/70',
                              collapsed
                                ? 'h-10 justify-center'
                                : 'h-10 gap-3 px-3 lg:h-9',
                              isActive
                                ? 'text-white'
                                : 'text-white/60 hover:bg-white/[0.045] hover:text-white/95',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon
                                className={cn(
                                  'size-[17px] shrink-0 transition-[color,transform] duration-300 ease-out-expo',
                                  isActive
                                    ? 'text-heat-300 drop-shadow-[0_0_8px_rgb(255_165_61/0.45)]'
                                    : 'text-white/45 group-hover:scale-110 group-hover:text-white/85',
                                )}
                                strokeWidth={isActive ? 2.1 : 1.8}
                              />
                              {!collapsed ? (
                                <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.006em] transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">
                                  {item.label}
                                </span>
                              ) : null}

                              {badge ? (
                                collapsed ? (
                                  <span
                                    aria-hidden
                                    className="absolute top-2 right-3 size-2 rounded-full bg-danger-400 ring-2 ring-rail-900"
                                  />
                                ) : (
                                  <span className="rounded-md bg-danger-500/20 px-1.5 text-[11px] leading-[18px] font-semibold text-danger-300 tabular-nums ring-1 ring-danger-400/30 ring-inset">
                                    {badgeText}
                                  </span>
                                )
                              ) : null}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        {/* ───── Tizim holati + yig'ish ───── */}
        <div className="shrink-0 border-t border-white/[0.06] p-2">
          <SystemPulse collapsed={collapsed} tipProps={tipProps} />

          <button
            type="button"
            onClick={() => {
              setTip(null);
              toggleRail();
            }}
            aria-label={collapsed ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            aria-keyshortcuts={RAIL_SHORTCUT}
            {...tipProps('Menyuni yoyish', `Tugma: ${RAIL_SHORTCUT}`)}
            className={cn(
              'mt-1 hidden h-9 w-full items-center rounded-lg text-white/45 outline-none transition-colors hover:bg-white/[0.045] hover:text-white/85 focus-visible:ring-2 focus-visible:ring-brand-300/70 lg:flex',
              collapsed ? 'justify-center' : 'gap-3 px-3',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[17px]" strokeWidth={1.8} />
            ) : (
              <>
                <PanelLeftClose className="size-[17px]" strokeWidth={1.8} />
                <span className="flex-1 text-left text-[12.5px] font-medium">
                  Menyuni yig‘ish
                </span>
                <kbd className="grid h-5 min-w-5 place-items-center rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[10.5px] text-white/45">
                  {RAIL_SHORTCUT}
                </kbd>
              </>
            )}
          </button>
        </div>

        {collapsed && tip ? (
          <div
            role="tooltip"
            className="rail-tip pointer-events-none absolute left-full z-50 ml-2.5 -translate-y-1/2 rounded-md bg-neutral-950 px-2.5 py-1.5 whitespace-nowrap shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
            style={{ top: tip.top }}
          >
            <p className="text-[12px] leading-4 font-medium text-white">
              {tip.label}
            </p>
            {tip.detail ? (
              <p className="mt-0.5 text-[11px] leading-4 text-white/55">
                {tip.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </>
  );
}

const LINK_META: Record<
  RealtimeLink,
  { label: string; dot: string; live: boolean; hint?: string }
> = {
  live: { label: 'Jonli ulanish', dot: 'bg-ok-400', live: true },
  connecting: { label: 'Ulanmoqda…', dot: 'bg-warn-300', live: false },
  idle: { label: 'Ulanmoqda…', dot: 'bg-warn-300', live: false },
  offline: {
    label: 'Aloqa uzilgan',
    dot: 'bg-danger-400',
    live: false,
    hint: 'Ekrandagi ma‘lumot eskirgan bo‘lishi mumkin',
  },
};

/**
 * TIZIM HOLATI — jonli ulanish, modullar onlayn, yangilangan vaqt.
 *
 * ⚠️ Bezak emas: monitoring tizimida «ekrandagi raqamlar jonlimi» degan
 * savol hamma bo'limda bir xil muhim, shuning uchun u har sahifada
 * ko'rinadigan yagona joyda — yon panelda turadi.
 *
 * ⚠️ Raqamlar dashboard bilan AYNI so'rovdan (`qk.summary(null)`) —
 * kesh umumiy, ikki joyda ikki xil son chiqmaydi. Ruxsati yo'q
 * foydalanuvchida faqat ulanish holati qoladi.
 */
function SystemPulse({
  collapsed,
  tipProps,
}: {
  collapsed: boolean;
  tipProps: TipProps;
}) {
  const link = useRealtimeStore((state) => state.link);
  const can = useAuthStore((state) => state.can);
  const { data: summary } = useQuery({
    queryKey: qk.summary(null),
    queryFn: () => get<DashboardSummary>(API.dashboard.summary),
    enabled: can('reports.view'),
    refetchInterval: 60_000,
  });

  const meta = LINK_META[link];
  const total = summary?.devicesTotal ?? 0;
  const online = summary?.devicesOnline ?? 0;
  const share = total > 0 ? Math.min(100, (online / total) * 100) : 0;
  const updated = summary ? formatTimeUz(summary.updatedAt) : null;
  const detail = [
    total > 0
      ? `${formatNumber(online)} / ${formatNumber(total)} modul onlayn`
      : null,
    updated ? `Yangilandi ${updated}` : null,
    meta.hint ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const dot = (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      {meta.live ? (
        <span
          className={cn(
            'rail-live-ping absolute inset-0 rounded-full',
            meta.dot,
          )}
        />
      ) : null}
      <span className={cn('relative size-2 rounded-full', meta.dot)} />
    </span>
  );

  if (collapsed) {
    /* ⚠️ `role="status"` + yashirin matn: rolsiz `div` dagi `aria-label`
       ni ekran o'quvchilar e'tiborsiz qoldiradi va «Aloqa uzilgan» ga
       o'tish yig'ilgan menyuda umuman e'lon qilinmasdi. Vaqt (har
       daqiqa yangilanadi) faqat tooltipda — e'lon tinmasligi uchun. */
    return (
      <div
        role="status"
        tabIndex={0}
        {...tipProps(meta.label, detail || undefined)}
        className="grid h-10 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70"
      >
        {dot}
        <span className="sr-only">{meta.label}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/[0.035] px-3 py-2.5 ring-1 ring-white/[0.06] ring-inset">
      <div className="flex items-center gap-2">
        {dot}
        {/* ⚠️ `aria-live` faqat holat matnida — vaqt har daqiqa
            yangilanadi va butun blok o'qilsa, ekran o'quvchi tinmasdi. */}
        <span
          aria-live="polite"
          className="truncate text-[12px] font-medium text-white/85"
        >
          {meta.label}
        </span>
        {updated ? (
          <span
            className="ml-auto text-[11px] text-white/40 tabular-nums"
            title="Ko‘rsatkichlar yangilangan vaqt"
          >
            {updated}
          </span>
        ) : null}
      </div>

      {meta.hint ? (
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          {meta.hint}
        </p>
      ) : null}

      {total > 0 ? (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-white/45">Modullar onlayn</span>
            <span className="text-[12px] font-semibold text-white/85 tabular-nums">
              {formatNumber(online)}
              <span className="font-normal text-white/35">
                {' '}
                / {formatNumber(total)}
              </span>
            </span>
          </div>
          <div
            role="meter"
            aria-label="Modullar onlayn"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={online}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-400 to-[#38b6ff] shadow-[0_0_10px_rgb(56_182_255/0.6)] transition-[width] duration-700 ease-out-expo"
              style={{ width: `${share}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
