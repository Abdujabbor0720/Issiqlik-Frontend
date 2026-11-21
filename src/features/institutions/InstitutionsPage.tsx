import { useQuery } from '@tanstack/react-query';
import { Gauge, LayoutGrid, Search, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { GaugeBoard, GaugeItem } from '@/shared/api/types';
import { usePrefersReducedMotion } from '@/shared/hooks/useMediaQuery';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  AnimatedNumber,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Segmented,
  Skeleton,
} from '@/shared/ui';
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
    ? (visible.find((item) => item.boilerId === inspect.item.boilerId) ?? null)
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
      {/* ───── Sarlavha + jonli o'rtachalar ─────
          ⚠️ Sarlavha ikonkasi va nomi TANLANGAN turga ergashadi («Maktablar»):
          operator qaysi kesimda turganini sarlavhadan biladi. */}
      <PageHeader
        leading={
          <span
            key={activeKey}
            className="reveal grid size-10 place-items-center rounded-tile bg-linear-to-b from-brand-500 to-brand-700 text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.22)]"
          >
            <TitleIcon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
        }
        title={title}
        subtitle={
          board
            ? `${formatNumber(stats.total)} ta qozonxona · ${
                districtId ? 'tanlangan tuman' : 'butun viloyat'
              } · yangilandi ${formatTimeUz(board.updatedAt)}`
            : 'Yuklanmoqda…'
        }
        actions={
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
        }
      />

      {/* ───── Turlar + qidiruv ─────
          ⚠️ Kompyuterda tablar QATORGA O'RALADI (hammasi ko'rinadi), telefonda
          gorizontal suriladi: sakkizta tur tor ekranga sig'maydi, lekin
          ikki-uch qatorga o'ralsa kartalarni pastga itarib yuborardi. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex max-w-[calc(100%+0.5rem)] overflow-x-auto px-1 pt-0.5 pb-2 [scrollbar-width:none] max-lg:w-[calc(100%+0.5rem)] lg:overflow-visible lg:pb-0.5 [&::-webkit-scrollbar]:hidden">
          <Segmented
            size="md"
            ariaLabel="Muassasa turi"
            value={activeKey}
            onChange={setTypeKey}
            className="lg:max-w-full lg:shrink lg:flex-wrap"
            options={[
              {
                value: ALL_KEY,
                label: 'Hammasi',
                icon: <LayoutGrid strokeWidth={1.9} aria-hidden />,
                count: formatNumber(items.length),
              },
              ...tabs.map((tab) => {
                const Icon = typeIcon(tab.code);
                return {
                  value: tab.key,
                  label: tab.name,
                  icon: <Icon strokeWidth={1.9} aria-hidden />,
                  count: formatNumber(tab.total),
                };
              }),
            ]}
          />
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
                {sectionItems.map((item, index) => (
                  <InstitutionCard
                    key={item.boilerId}
                    /* ⚠️ Ketma-ket chiqish 12 ta bilan cheklanadi: 200 ta
                       kartada oxirgisi 12 soniya kutib turardi. */
                    revealIndex={Math.min(index, 12)}
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

/**
 * Jonli o'rtacha plitkasi. ⚠️ Raqam sanab o'tadi (`AnimatedNumber`): har
 * 30 soniyada yangilanganda ko'z «o'zgardi» ni ko'radi, lekin yakuniy matn
 * aynan `formatTemperature` natijasi.
 */
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
    <div className="card relative min-w-[136px] overflow-hidden px-3 pt-2 pb-2.5">
      {hue ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ backgroundColor: hue }}
        />
      ) : null}
      <dt className="label-eyebrow flex items-center gap-1.5">
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
              <span className="live-ping absolute inset-0 rounded-full bg-ok-500" />
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
      <dd className="mt-1">
        <AnimatedNumber value={value} className="figure-display text-[21px]" />
      </dd>
    </div>
  );
}

function SectionHeader({ tab, shown }: { tab: TypeTab; shown: number }) {
  const Icon = typeIcon(tab.code);
  return (
    <div className="mb-2.5 flex items-center gap-2.5 px-1">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] dark:bg-white/[0.04]">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <h2 className="font-display text-[15.5px] font-[720] tracking-[-0.012em] text-strong [font-stretch:106%]">
        {pluralTypeName(tab.name)}
      </h2>
      <span className="flex items-center gap-2 font-mono text-[10.5px] font-semibold text-muted tabular-nums">
        <span>
          {shown === tab.total
            ? `${formatNumber(tab.total)} ta`
            : `${formatNumber(shown)} / ${formatNumber(tab.total)}`}
        </span>
        <span className="text-faint">·</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              tab.online > 0 ? 'bg-ok-500' : 'bg-idle-400',
            )}
          />
          onlayn {formatNumber(tab.online)}
        </span>
      </span>
      <span aria-hidden className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}
