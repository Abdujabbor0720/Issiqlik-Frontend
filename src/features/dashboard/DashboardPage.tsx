import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Library,
  Map as MapIcon,
  RefreshCw,
  Thermometer,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  AttentionRow,
  BoilerPoint,
  BrandRow,
  DashboardSummary,
  DistrictGeoJson,
  DistrictRow,
  TrendPoint,
} from '@/shared/api/types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Skeleton,
} from '@/shared/ui';
import { formatTimeUz } from '@/shared/utils/date';
import { districtParams, useFiltersStore } from '@/store/filters.store';
import { DistrictMap } from '@/features/map/DistrictMap';
import { AttentionList } from './components/AttentionList';
import { BrandBars } from './components/BrandBars';
import { DistrictBars } from './components/DistrictBars';
import { KpiRow } from './components/KpiRow';
import { TemperatureChart } from './components/TemperatureChart';

type Range = '24h' | '7d' | '30d';

const RANGES: Array<{ key: Range; label: string }> = [
  { key: '24h', label: '24 soat' },
  { key: '7d', label: '7 kun' },
  { key: '30d', label: '30 kun' },
];

/**
 * BOSH SAHIFA.
 *
 * ⚠️⚠️ Tartib: KO'RSATKICHLAR → XARITA → TAFSILOT. Rahbar ekranni
 * yuqoridan pastga o'qiydi: avval «umuman ahvol qanday», keyin
 * «qayerda», keyin «aniq kim». Teskarisi bo'lsa (avval jadval), u
 * raqamlar ichida adashib, umumiy manzarani umuman ko'rmasdi.
 *
 * ⚠️ Xarita 2/3 ustunda va KATTA (620px): bu tizimning asosiy
 * vositasi, kichik «ko'rinish» emas. Yonidagi 1/3 ustunda esa
 * harakat talab qiladigan ro'yxat — ko'z xaritadan unga o'tadi.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const districtId = useFiltersStore((state) => state.districtId);
  const setDistrict = useFiltersStore((state) => state.setDistrict);
  const [range, setRange] = useState<Range>('24h');

  const summaryQuery = useQuery({
    queryKey: qk.summary(districtId),
    queryFn: () =>
      get<DashboardSummary>(API.dashboard.summary, {
        params: districtParams(districtId),
      }),
  });

  const mapQuery = useQuery({
    queryKey: qk.map(null),
    /*
     * ⚠️ Xarita HAR DOIM hamma tumanni so'raydi, tanlovdan QAT'I
     * NAZAR. Tanlov xaritada RANG bilan ko'rsatiladi (tanlanmaganlar
     * xiralashadi) — tanlanganlarnigina so'rasak, xaritadan qolgan
     * tumanlar YO'QOLIB, foydalanuvchi mo'ljalni butunlay
     * yo'qotardi va tanlovni bekor qila olmasdi.
     */
    queryFn: () => get<DistrictGeoJson>(API.geo.map),
  });

  /*
   * ⚠️ Qozonxona nuqtalari FAQAT tuman tanlanganda yuklanadi. Butun
   * viloyat bo'yicha ular ~1700 ta marker bo'lardi: Leaflet har birini
   * alohida DOM elementi qilib chizadi va xarita harakatlanmay
   * qolardi. Tuman ko'rinishida esa ular ekranning butun ma'nosi —
   * «bu tumanda nima bor» degan savolga javob aynan nuqtalarda.
   */
  const pointsQuery = useQuery({
    queryKey: qk.points(districtId),
    queryFn: () =>
      get<BoilerPoint[]>(API.geo.points, {
        params: { districtIds: districtId ?? '' },
      }),
    enabled: Boolean(districtId),
  });

  const districtsQuery = useQuery({
    queryKey: qk.districtRows(districtId),
    queryFn: () =>
      get<DistrictRow[]>(API.dashboard.districts, {
        params: districtParams(districtId),
      }),
  });

  const trendQuery = useQuery({
    queryKey: qk.trend(districtId, range),
    queryFn: () =>
      get<TrendPoint[]>(API.dashboard.trend, {
        params: { range, ...districtParams(districtId) },
      }),
  });

  const attentionQuery = useQuery({
    queryKey: qk.attention(districtId),
    queryFn: () =>
      get<AttentionRow[]>(API.dashboard.attention, {
        params: districtParams(districtId),
      }),
  });

  const brandsQuery = useQuery({
    queryKey: qk.brands(districtId),
    queryFn: () =>
      get<BrandRow[]>(API.dashboard.brands, {
        params: districtParams(districtId),
      }),
  });

  const summary = summaryQuery.data;

  return (
    <div className="flex flex-col gap-3">
      {/* ───── Sarlavha ───── */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Umumiy ko‘rinish
          </h1>
          <p className="text-meta text-muted">
            {districtId
              ? 'Tanlangan tuman bo‘yicha'
              : 'Andijon viloyati — barcha tumanlar'}
            {summary ? ` · yangilandi ${formatTimeUz(summary.updatedAt)}` : ''}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw className="size-3.5" />}
          onClick={() => {
            void summaryQuery.refetch();
            void districtsQuery.refetch();
            void trendQuery.refetch();
            void attentionQuery.refetch();
            void mapQuery.refetch();
          }}
          loading={summaryQuery.isFetching}
        >
          Yangilash
        </Button>
      </div>

      {/* ───── Ko'rsatkichlar ───── */}
      {summaryQuery.isError ? (
        <Card>
          <ErrorState
            message={errorMessage(summaryQuery.error)}
            onRetry={() => void summaryQuery.refetch()}
          />
        </Card>
      ) : summary ? (
        <KpiRow summary={summary} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-card" />
          ))}
        </div>
      )}

      {/* ───── Xarita + diqqat ───── */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={<MapIcon className="size-4" />}
            eyebrow="Hududiy kesim"
            title="Andijon viloyati xaritasi"
            subtitle={
              districtId
                ? 'Tuman ko‘rinishi — nuqtalar qozonxonalarni ko‘rsatadi'
                : 'Tumanni bosing — xarita o‘sha tumanga ochiladi'
            }
            actions={
              districtId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDistrict(null)}
                >
                  Butun viloyat
                </Button>
              ) : null
            }
          />
          <div className="px-3 pb-3">
            <DistrictMap
              geojson={mapQuery.data}
              points={pointsQuery.data}
              selectedId={districtId}
              onSelectDistrict={setDistrict}
              onPointClick={(point) => navigate(`/boilers/${point.id}`)}
              heightClass="h-[620px]"
            />
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            icon={<AlertTriangle className="size-4" />}
            eyebrow="Harakat kerak"
            title="Diqqat talab qiladi"
            subtitle={
              summary
                ? `${summary.openAlerts} ta ochiq ogohlantirish`
                : undefined
            }
            actions={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/alerts')}
              >
                Hammasi
              </Button>
            }
          />
          <CardBody className="flex-1 px-3">
            {attentionQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : attentionQuery.isError ? (
              <ErrorState
                message={errorMessage(attentionQuery.error)}
                onRetry={() => void attentionQuery.refetch()}
              />
            ) : (
              <AttentionList rows={attentionQuery.data ?? []} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ───── Trend + tumanlar ───── */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader
            icon={<Thermometer className="size-4" />}
            eyebrow="Harorat dinamikasi"
            title="O‘rtacha chiqish harorati"
            subtitle="Soya — eng past va eng yuqori qiymatlar oralig‘i"
            actions={
              /* Davr tanlovi — yumaloq segment boshqaruvi. */
              <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setRange(item.key)}
                    className={
                      range === item.key
                        ? 'rounded-full bg-[var(--surface)] px-2.5 py-1 text-micro font-semibold text-strong shadow-[var(--shadow-hair)]'
                        : 'rounded-full px-2.5 py-1 text-micro font-medium text-muted transition-colors hover:text-strong'
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            {trendQuery.isLoading ? (
              <Skeleton className="h-[260px]" />
            ) : trendQuery.isError ? (
              <ErrorState
                message={errorMessage(trendQuery.error)}
                onRetry={() => void trendQuery.refetch()}
              />
            ) : (trendQuery.data ?? []).length === 0 ? (
              <div className="grid h-[260px] place-items-center text-meta text-muted">
                Bu davr uchun o‘lchov yo‘q
              </div>
            ) : (
              <TemperatureChart
                data={trendQuery.data ?? []}
                bucket={range === '30d' ? 'day' : 'hour'}
                normTemperature={summary?.normTemperature ?? 60}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<BarChart3 className="size-4" />}
            eyebrow="Tumanlar kesimi"
            title="Ishlayotgan qozonxonalar ulushi"
            subtitle="Eng past ko‘rsatkichdan boshlab"
          />
          <CardBody className="px-3">
            {districtsQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-10" />
                ))}
              </div>
            ) : districtsQuery.isError ? (
              <ErrorState
                message={errorMessage(districtsQuery.error)}
                onRetry={() => void districtsQuery.refetch()}
              />
            ) : (
              <DistrictBars
                rows={districtsQuery.data ?? []}
                selectedId={districtId}
                onSelect={setDistrict}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ───── Markalar ───── */}
      <Card>
        <CardHeader
          icon={<Library className="size-4" />}
          eyebrow="Jihoz kesimi"
          title="Markalar bo‘yicha ishonchlilik"
          subtitle="Ishlayotganlar ulushi — keyingi xarid uchun dalil"
        />
        <CardBody>
          {brandsQuery.isLoading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-9" />
              ))}
            </div>
          ) : (
            <BrandBars rows={brandsQuery.data ?? []} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
