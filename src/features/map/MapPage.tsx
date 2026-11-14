import { useQuery } from '@tanstack/react-query';
import { Layers, MapPin, Table2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  BoilerPoint,
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
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatNumber, formatTemperature } from '@/shared/utils/format';
import { useFiltersStore } from '@/store/filters.store';
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
  const navigate = useNavigate();
  const districtId = useFiltersStore((state) => state.districtId);
  const setDistrict = useFiltersStore((state) => state.setDistrict);
  const [showPoints, setShowPoints] = useState(true);

  const mapQuery = useQuery({
    queryKey: qk.map(null),
    queryFn: () => get<DistrictGeoJson>(API.geo.map),
  });

  const pointsQuery = useQuery({
    queryKey: qk.points(districtId),
    queryFn: () =>
      get<BoilerPoint[]>(API.geo.points, {
        params: { districtIds: districtId ?? '' },
      }),
    // ⚠️ Tanlovsiz so'ralmaydi — yuqoridagi izohga qarang.
    enabled: showPoints && Boolean(districtId),
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
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Hududiy xarita
          </h1>
          <p className="text-meta text-muted">
            Tumanlarni tanlang — qozonxona nuqtalari va jadval shunga
            moslashadi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showPoints ? 'primary' : 'secondary'}
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
        </div>
      </div>

      {mapQuery.isError ? (
        <Card>
          <ErrorState
            message={errorMessage(mapQuery.error)}
            onRetry={() => void mapQuery.refetch()}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
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
              onPointClick={(point) => navigate(`/boilers/${point.id}`)}
              heightClass="h-[min(74vh,760px)]"
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
                <Th align="right">Faol</Th>
                <Th align="right">O‘rta</Th>
                <Th align="right">Ishlamayotgan</Th>
                <Th align="right">Aloqa yo‘q</Th>
                <Th align="right">O‘rtacha</Th>
                <Th align="right">Ishlayapti</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = districtId === row.districtId;
                return (
                  <Tr
                    key={row.districtId}
                    onClick={() =>
                      setDistrict(selected ? null : row.districtId)
                    }
                    className={cn(
                      selected && 'bg-brand-50/70 dark:bg-brand-500/8',
                    )}
                  >
                    <Td>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            selected ? 'bg-brand-500' : 'bg-transparent',
                          )}
                        />
                        <span
                          className={cn(
                            'font-medium',
                            selected
                              ? 'text-brand-700 dark:text-brand-300'
                              : 'text-strong',
                          )}
                        >
                          {row.name}
                        </span>
                      </span>
                    </Td>
                    <Td align="right" className="font-semibold text-strong">
                      {formatNumber(row.total)}
                    </Td>
                    <Td align="right" className="text-muted">
                      {formatNumber(row.boilerUnits)}
                    </Td>
                    <Td align="right" style={{ color: BOILER_STATUS.active.hex }}>
                      {formatNumber(row.active)}
                    </Td>
                    <Td align="right" style={{ color: BOILER_STATUS.medium.hex }}>
                      {formatNumber(row.medium)}
                    </Td>
                    <Td
                      align="right"
                      style={{ color: BOILER_STATUS.inactive.hex }}
                    >
                      {formatNumber(row.inactive)}
                    </Td>
                    <Td align="right" className="text-muted">
                      {formatNumber(row.offline)}
                    </Td>
                    <Td align="right" className="text-muted">
                      {formatTemperature(row.avgTemperature)}
                    </Td>
                    <Td align="right">
                      <span
                        className={cn(
                          'inline-block w-12 rounded-full py-0.5 text-center text-micro font-semibold',
                          row.total === 0
                            ? 'bg-[var(--surface-sunken)] text-faint'
                            : row.workingPercent >= 80
                              ? 'bg-ok-50 text-ok-700 dark:bg-ok-500/12 dark:text-ok-300'
                              : row.workingPercent >= 55
                                ? 'bg-warn-50 text-warn-700 dark:bg-warn-400/14 dark:text-warn-300'
                                : 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
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
    </div>
  );
}
