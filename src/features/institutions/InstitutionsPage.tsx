import { useQuery } from '@tanstack/react-query';
import { Gauge, LayoutGrid, Search, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { GaugeBoard, GaugeItem } from '@/shared/api/types';
import { usePrefersReducedMotion } from '@/shared/hooks/useMediaQuery';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { Card, EmptyState, ErrorState, Input, Skeleton } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatTimeUz } from '@/shared/utils/date';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { districtParams, useFiltersStore } from '@/store/filters.store';
import {
  GaugeInspector,
  type InspectTarget,
} from './components/GaugeInspector';
import { InstitutionCard } from './components/InstitutionCard';
import type { GaugeKind } from './components/TempGauge';
import {
  ALL_KEY,
  UNTYPED_KEY,
  compareItems,
  gaugeStats,
  isLive,
  pluralTypeName,
  typeIcon,
  typeKeyOf,
} from './institution-meta';

interface TypeTab {
  key: string;
  name: string;
  code: string | null;
  total: number;
  online: number;
}

/**
 * MUASSASALAR — har qozonxonaning kirish/chiqish harorati, muassasa TURI
 * bo'yicha (Maktablar, Bog'chalar…) yoki hammasi birga.
 *
 * ⚠️ Ma'lumot BITTA so'rovda; tablar, sanoq va o'rtachalar mijozda — tab
 * almashganda kutish yo'q va sanoq kartalar bilan bir lahzadan. Tuman
 * filtri (yuqori panel) esa serverda — tuman operatori faqat o'zinikini
 * oladi.
 *
 * ⚠️ «Hammasi» ko'rinishida kartalar TUR BO'YICHA guruhlanadi: 200 ta
 * aralash kartada «maktablar qayerda» degan savolga ko'z bilan javob
 * topib bo'lmasdi.
 */
export function InstitutionsPage() {
  const districtId = useFiltersStore((state) => state.districtId);
  const reducedMotion = usePrefersReducedMotion();
  const [typeKey, setTypeKey] = useState<string>(ALL_KEY);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim().toLowerCase(), 200);
  const [inspect, setInspect] = useState<InspectTarget | null>(null);

  const query = useQuery({
    queryKey: qk.gauges(districtId),
    queryFn: () =>
      get<GaugeBoard>(API.dashboard.gauges, {
        params: districtParams(districtId),
      }),
    refetchInterval: 30_000,
  });
  const board = query.data;
  const items = useMemo(() => board?.items ?? [], [board]);

  const tabs = useMemo<TypeTab[]>(() => {
    const map = new Map<string, TypeTab>();
    for (const item of items) {
      const key = typeKeyOf(item);
      const tab = map.get(key) ?? {
        key,
        name: item.objectTypeName ?? 'Turi belgilanmagan',
        code: item.objectTypeCode,
        total: 0,
        online: 0,
      };
      tab.total += 1;
      if (isLive(item)) tab.online += 1;
      map.set(key, tab);
    }
    // Ko'pi birinchi; «turi belgilanmagan» — doim oxirida.
    return [...map.values()].sort(
      (a, b) =>
        Number(a.key === UNTYPED_KEY) - Number(b.key === UNTYPED_KEY) ||
        b.total - a.total,
    );
  }, [items]);

  // Tuman almashib, tanlangan tur u yerda bo'lmasa — «Hammasi».
  const activeKey = tabs.some((tab) => tab.key === typeKey) ? typeKey : ALL_KEY;
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? null;

  const scoped = useMemo(
    () =>
      activeKey === ALL_KEY
        ? items
        : items.filter((item) => typeKeyOf(item) === activeKey),
    [items, activeKey],
  );
  const stats = useMemo(() => gaugeStats(scoped), [scoped]);

  const visible = useMemo(() => {
    const filtered = debouncedSearch
      ? scoped.filter((item) =>
          [
            item.organizationName,
            item.lotNumber,
            item.districtName,
            item.objectTypeName,
          ].some((text) => text?.toLowerCase().includes(debouncedSearch)),
        )
      : scoped;
    return [...filtered].sort(compareItems);
  }, [scoped, debouncedSearch]);

  const sections = useMemo(() => {
    if (activeKey !== ALL_KEY) {
      return [{ tab: activeTab, items: visible }];
    }
    return tabs
      .map((tab) => ({
        tab,
        items: visible.filter((item) => typeKeyOf(item) === tab.key),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeKey, activeTab, tabs, visible]);

  const handleInspect = useCallback(
    (item: GaugeItem, kind: GaugeKind, trigger: HTMLElement) =>
      setInspect((current) =>
        current?.item.boilerId === item.boilerId && current.kind === kind
          ? null
          : { item, kind, trigger },
      ),
    [],
  );
  const closeInspect = useCallback(() => setInspect(null), []);

  /*
   * Oyna ochiq turganda ma'lumot yangilansa — eng so'nggi qiymat ko'rinsin.
   * ⚠️ Kotyol ro'yxatdan chiqib ketsa (arxivlandi, tuman almashdi,
   * qidiruv/tur o'zgardi) — oyna YOPILADI: aks holda u yo'qolgan shkala
   * o'rnida havoda osilib qolardi.
   */
  const inspectItem = inspect
    ? (visible.find((item) => item.boilerId === inspect.item.boilerId) ??
      null)
    : null;
  useEffect(() => {
    if (inspect && (!inspectItem || !inspect.trigger.isConnected)) {
      setInspect(null);
    }
  }, [inspect, inspectItem]);

  const title = activeTab ? pluralTypeName(activeTab.name) : 'Muassasalar';
  const TitleIcon = activeTab ? typeIcon(activeTab.code) : Gauge;

  return (
    <div className="flex flex-col gap-3">
      {/* ───── Sarlavha + jonli o'rtachalar ───── */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-brand-600 text-white shadow-[var(--shadow-brand)]">
            <TitleIcon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sub font-semibold tracking-tight text-strong">
              {title}
            </h1>
            <p className="text-meta text-muted">
              {board
                ? `${formatNumber(stats.total)} ta qozonxona · ${
                    districtId ? 'tanlangan tuman' : 'butun viloyat'
                  } · yangilandi ${formatTimeUz(board.updatedAt)}`
                : 'Yuklanmoqda…'}
            </p>
          </div>
        </div>

        <dl className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <StatTile
            label="O‘rtacha kirish"
            hue="var(--gauge-inlet)"
            value={formatTemperature(stats.avgInlet)}
          />
          <StatTile
            label="O‘rtacha chiqish"
            hue="var(--gauge-outlet)"
            value={formatTemperature(stats.avgOutlet)}
          />
          <StatTile
            label="O‘rtacha ΔT"
            value={formatTemperature(stats.avgDelta)}
          />
          <StatTile
            label="Onlayn"
            value={`${formatNumber(stats.online)} / ${formatNumber(stats.total)}`}
            live={stats.online > 0}
          />
        </dl>
      </div>

      {/* ───── Turlar + qidiruv ─────
          ⚠️ Kompyuterda tablar QATORGA O'RALADI (hammasi ko'rinadi), telefonda
          gorizontal suriladi: sakkizta tur tor ekranga sig'maydi, lekin
          ikki-uch qatorga o'ralsa kartalarni pastga itarib yuborardi. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Muassasa turi"
          className="-mx-1 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1 pt-0.5 pb-2 [scrollbar-width:none] lg:pb-0.5 max-lg:w-[calc(100%+0.5rem)] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          <TypeButton
            label="Hammasi"
            icon={LayoutGrid}
            count={items.length}
            active={activeKey === ALL_KEY}
            onClick={() => setTypeKey(ALL_KEY)}
          />
          {tabs.map((tab) => (
            <TypeButton
              key={tab.key}
              label={tab.name}
              icon={typeIcon(tab.code)}
              count={tab.total}
              active={activeKey === tab.key}
              onClick={() => setTypeKey(tab.key)}
            />
          ))}
        </div>
        <div className="w-full lg:ml-auto lg:w-72">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Muassasa, lot yoki tuman…"
            aria-label="Muassasani qidirish"
            leading={<Search className="size-4" />}
          />
        </div>
      </div>

      {/* ───── Kartalar ───── */}
      {query.isError ? (
        <Card>
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-[296px] rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gauge}
            title="Qozonxona yo‘q"
            description="Tanlangan hududda hali qozonxona ro‘yxatga olinmagan."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title="Hech narsa topilmadi"
            description={`«${search.trim()}» bo‘yicha muassasa yo‘q. Boshqa nom yoki lot raqamini kiriting.`}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map(({ tab, items: sectionItems }) => (
            <section
              key={tab?.key ?? 'all'}
              aria-label={tab ? pluralTypeName(tab.name) : 'Muassasalar'}
            >
              {activeKey === ALL_KEY && tab ? (
                <SectionHeader tab={tab} shown={sectionItems.length} />
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {sectionItems.map((item) => (
                  <InstitutionCard
                    key={item.boilerId}
                    item={item}
                    norm={board?.normTemperature ?? 60}
                    reducedMotion={reducedMotion}
                    selectedKind={
                      inspect?.item.boilerId === item.boilerId
                        ? inspect.kind
                        : null
                    }
                    onInspect={handleInspect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {inspect && inspectItem ? (
        <GaugeInspector
          target={{ ...inspect, item: inspectItem }}
          norm={board?.normTemperature ?? 60}
          onClose={closeInspect}
        />
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  hue,
  live,
}: {
  label: string;
  value: string;
  hue?: string;
  live?: boolean;
}) {
  return (
    <div className="min-w-[132px] rounded-tile bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-card)]">
      <dt className="flex items-center gap-1.5 text-nano font-medium text-muted">
        {hue ? (
          <span
            aria-hidden
            className="h-2.5 w-1 rounded-full"
            style={{ backgroundColor: hue }}
          />
        ) : null}
        {live !== undefined ? (
          <span className="relative flex size-1.5" aria-hidden>
            {live ? (
              <span className="rail-live-ping absolute inset-0 rounded-full bg-ok-500" />
            ) : null}
            <span
              className={cn(
                'relative size-1.5 rounded-full',
                live ? 'bg-ok-500' : 'bg-idle-400',
              )}
            />
          </span>
        ) : null}
        {label}
      </dt>
      <dd className="mt-0.5 text-lede font-semibold text-strong tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function TypeButton({
  label,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Gauge;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-meta font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70',
        active
          ? 'bg-brand-600 text-white shadow-[var(--shadow-brand)]'
          : 'bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] hover:text-strong',
      )}
    >
      <Icon className="size-4" strokeWidth={1.9} aria-hidden />
      {label}
      <span
        className={cn(
          'rounded-md px-1.5 text-[11px] leading-[18px] font-semibold tabular-nums',
          active
            ? 'bg-white/18 text-white'
            : 'bg-[var(--surface-sunken)] text-muted',
        )}
      >
        {formatNumber(count)}
      </span>
    </button>
  );
}

function SectionHeader({ tab, shown }: { tab: TypeTab; shown: number }) {
  const Icon = typeIcon(tab.code);
  return (
    <div className="mb-2 flex items-center gap-2.5 px-1">
      <Icon className="size-4 text-faint" strokeWidth={1.9} aria-hidden />
      <h2 className="text-ui font-semibold text-strong">
        {pluralTypeName(tab.name)}
      </h2>
      <span className="text-micro text-muted tabular-nums">
        {shown === tab.total
          ? `${formatNumber(tab.total)} ta`
          : `${formatNumber(shown)} / ${formatNumber(tab.total)}`}
        <span className="text-faint"> · </span>
        onlayn {formatNumber(tab.online)}
      </span>
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}
