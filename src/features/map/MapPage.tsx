import { useQuery } from '@tanstack/react-query';
import { Layers, MapPin, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  BoilerPoint,
  BoilerStatus,
  DistrictGeoJson,
  DistrictRow,
} from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { useFiltersStore } from '@/store/filters.store';
import { BoilerRoomsModal } from './BoilerRoomsModal';
import { DistrictMap } from './DistrictMap';

/**
 * XARITA SAHIFASI.
 *
 * ⚠️ Dashboard'dagi xaritadan FARQI — bu yerda u butun ekranni
 * egallaydi va yoniga TO'LIQ jadval qo'yiladi. Dashboard'da xarita
 * «umumiy manzara» uchun, bu yerda esa u ISH VOSITASI: foydalanuvchi
 * tumanlarni taqqoslaydi, nuqtalarni ochadi, kesimlarni almashtiradi.
 *
 * ⚠️ Nuqtalar FAQAT tanlov bo'lganda yuklanadi. Butun viloyat
 * bo'yicha ular ~1700 ta marker bo'lardi: Leaflet har birini alohida
 * DOM elementi qilib chizadi va xarita harakatlanmay qoladi.
 */
export function MapPage() {
  const districtId = useFiltersStore((state) => state.districtId);
  const setDistrict = useFiltersStore((state) => state.setDistrict);
  const [showPoints, setShowPoints] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<BoilerPoint | null>(null);

  const mapQuery = useQuery({
    queryKey: qk.map(null),
    queryFn: () => get<DistrictGeoJson>(API.geo.map),
  });

  const pointsQuery = useQuery({
    queryKey: qk.points(districtId),
    queryFn: () =>
      get<BoilerPoint[]>(API.geo.points, {
        params: districtId ? { districtIds: districtId } : {},
      }),
    /*
     * ⚠️ Viloyat ko'rinishida HAM — oqim kanallari uchun (canvas, DOM emas,
     * shuning uchun 2000 kotyol ham xaritani qotirmaydi).
     */
    enabled: showPoints,
  });

  const districtsQuery = useQuery({
    queryKey: qk.districtRows(null),
    queryFn: () => get<DistrictRow[]>(API.dashboard.districts),
  });

  const rows = [...(districtsQuery.data ?? [])].sort(
    (a, b) => b.total - a.total,
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Hududiy xarita"
        subtitle="Tumanlarni tanlang — qozonxona nuqtalari va jadval shunga moslashadi"
        actions={
          <>
            {/* ⚠️ Yoqilgan holat — BREND tugmasi va `aria-pressed`: bu
                almashtirgich, bir martalik amal emas. */}
            <Button
              size="sm"
              variant={showPoints ? 'primary' : 'secondary'}
              aria-pressed={showPoints}
              icon={<MapPin className="size-3.5" />}
              onClick={() => setShowPoints((value) => !value)}
            >
              Qozonxona nuqtalari
            </Button>
            {districtId ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDistrict(null)}
              >
                Butun viloyat
              </Button>
            ) : null}
          </>
        }
      />

      {mapQuery.isError ? (
        <Card>
          <ErrorState
            message={errorMessage(mapQuery.error)}
            onRetry={() => void mapQuery.refetch()}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Termal chiziq — bu sahifaning ASOSIY vositasi xarita. */}
          <span
            aria-hidden
            className="thermal-line absolute inset-x-0 top-0 z-[3] h-[2px] opacity-80"
          />
          <CardHeader
            icon={<Layers className="size-4" />}
            eyebrow="Andijon viloyati"
            title="16 ta tuman va shahar"
            subtitle={
              !districtId
                ? 'Butun viloyat ko‘rsatilmoqda — tumanni tanlang'
                : showPoints
                  ? `${formatNumber(pointsQuery.data?.length ?? 0)} ta qozonxona xaritada`
                  : 'Tuman tanlangan'
            }
          />
          <div className="px-3 pb-3">
            <DistrictMap
              geojson={mapQuery.data}
              points={showPoints ? pointsQuery.data : undefined}
              selectedId={districtId}
              onSelectDistrict={setDistrict}
              /*
               * ⚠️ Nuqta bosilganda AVVAL bino oynasi (kotyol + xonalar),
               * kotyol sahifasiga o'tish — undagi tugma bilan. Ilgari
               * to'g'ridan-to'g'ri o'tilardi va xonalarni ko'rish uchun
               * xaritani tark etish kerak edi.
               */
              onPointClick={setSelectedPoint}
              heightClass="aspect-square sm:aspect-auto sm:h-[min(74vh,760px)]"
            />
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          icon={<Table2 className="size-4" />}
          eyebrow="Taqqoslash"
          title="Tumanlar bo‘yicha jadval"
          subtitle="Qatordagi tumanga bosing — xaritada ham tanlanadi"
        />

        {districtsQuery.isLoading ? (
          <CardBody>
            <Skeleton className="h-64" />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tuman / shahar</Th>
                <Th align="right">Qozonxona</Th>
                <Th align="right">Kotyol</Th>
                {/* ⚠️ Holat ustunlari sarlavhasida RANG NUQTASI: ustundagi
                    rangli raqamlar nimani bildirishini afsonasiz aytadi. */}
                <Th align="right">
                  <StatusHead status="active">Faol</StatusHead>
                </Th>
                <Th align="right">
                  <StatusHead status="medium">O‘rta</StatusHead>
                </Th>
                <Th align="right">
                  <StatusHead status="inactive">Ishlamayotgan</StatusHead>
                </Th>
                <Th align="right">
                  <StatusHead status="offline">Aloqa yo‘q</StatusHead>
                </Th>
                <Th align="right">O‘rtacha</Th>
                <Th align="right">Ishlayapti</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const selected = districtId === row.districtId;
                return (
                  <Tr
                    key={row.districtId}
                    onClick={() =>
                      setDistrict(selected ? null : row.districtId)
                    }
                    className={cn(
                      selected &&
                        'bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-500)] dark:bg-brand-400/10',
                    )}
                  >
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            'w-5 shrink-0 font-mono text-[10.5px] font-semibold tabular-nums',
                            selected
                              ? 'text-brand-600 dark:text-brand-300'
                              : 'text-faint',
                          )}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={cn(
                            'font-semibold',
                            selected
                              ? 'text-brand-700 dark:text-brand-200'
                              : 'text-strong',
                          )}
                        >
                          {row.name}
                        </span>
                      </span>
                    </Td>
                    <Td
                      align="right"
                      className="font-display text-[15px] font-[740] tracking-[-0.015em] text-strong [font-stretch:106%]"
                    >
                      {formatNumber(row.total)}
                    </Td>
                    <Td align="right" className="text-muted">
                      {formatNumber(row.boilerUnits)}
                    </Td>
                    {/* ⚠️ Nol XIRA, noldan katta — holat rangida (qorong'i
                        rejimda och qadam): 16 qatorda ko'z faqat rangli
                        kataklarni qidiradi. */}
                    <Td align="right">
                      <StatusCount value={row.active} status="active" />
                    </Td>
                    <Td align="right">
                      <StatusCount value={row.medium} status="medium" />
                    </Td>
                    <Td align="right">
                      <StatusCount value={row.inactive} status="inactive" />
                    </Td>
                    <Td align="right">
                      <StatusCount value={row.offline} status="offline" />
                    </Td>
                    <Td align="right" className="text-muted">
                      {formatTemperature(row.avgTemperature)}
                    </Td>
                    <Td align="right">
                      <span
                        className={cn(
                          'inline-block w-12 rounded-md py-0.5 text-center font-mono text-[11px] font-semibold ring-1 ring-inset',
                          row.total === 0
                            ? 'bg-[var(--surface-sunken)] text-faint ring-[var(--border-subtle)]'
                            : row.workingPercent >= 80
                              ? 'bg-ok-50 text-ok-700 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25'
                              : row.workingPercent >= 55
                                ? 'bg-warn-50 text-warn-700 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25'
                                : 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30',
                        )}
                      >
                        {row.total === 0 ? '—' : `${row.workingPercent}%`}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <BoilerRoomsModal
        point={selectedPoint}
        onClose={() => setSelectedPoint(null)}
      />
    </div>
  );
}

/*
 * ⚠️ Holat raqami rangi TO'LIQ sinf nomlari bilan (yorug' + qorong'i). Ilgari
 * inline `hex` edi va to'q fonda `#118a56` yashil o'qilmay qolardi.
 */
const STATUS_TEXT: Record<BoilerStatus, string> = {
  active: 'font-semibold text-ok-600 dark:text-ok-300',
  medium: 'font-semibold text-warn-600 dark:text-warn-300',
  inactive: 'font-semibold text-danger-600 dark:text-danger-300',
  offline: 'font-semibold text-idle-600 dark:text-idle-300',
};

function StatusCount({ value, status }: { value: number; status: BoilerStatus }) {
  return (
    <span className={value === 0 ? 'text-faint' : STATUS_TEXT[status]} data-numeric>
      {formatNumber(value)}
    </span>
  );
}

function StatusHead({
  status,
  children,
}: {
  status: BoilerStatus;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: BOILER_STATUS[status].hex }}
      />
      {children}
    </span>
  );
}
