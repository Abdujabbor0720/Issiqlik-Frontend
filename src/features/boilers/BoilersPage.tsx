import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileUp,
  Archive,
  ArchiveRestore,
  Download,
  Flame,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { download, errorMessage, getPaged, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { Boiler, BoilerStatus } from '@/shared/api/types';
import { BOILER_STATUS, STATUS_ORDER } from '@/shared/constants/status';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Button,
  Card,
  CardBody,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { formatNumber, formatTemperature, orDash } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { districtParams, useFiltersStore } from '@/store/filters.store';
import { BoilerFormModal } from './components/BoilerFormModal';
import { BoilerImportModal } from './components/BoilerImportModal';
import { boilerName } from '@/shared/utils/boiler';

/**
 * KOTYOLLAR RO'YXATI.
 *
 * ⚠️ Ustunlar foydalanuvchi bergan ro'yxatga AYNAN mos: tuman, lot
 * raqami, DXSH firma, tashkilot, marka, kotyol soni, 60 °C normasi.
 * Holat va harorat esa ULARDAN KEYIN — ular hujjat ma'lumoti emas,
 * tizim o'lchovi.
 *
 * ⚠️ Holat filtri YUQORIDA, chiplar ko'rinishida: eng ko'p
 * ishlatiladigan amal «ishlamayotganlarni ko'rsat» va u bitta
 * bosishda bajarilishi kerak, ochiladigan ro'yxat ichida emas.
 */
export function BoilersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const districtId = useFiltersStore((state) => state.districtId);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<BoilerStatus[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<Boiler | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archiving, setArchiving] = useState<Boiler | null>(null);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...districtParams(districtId),
      ...(statuses.length ? { statuses: statuses.join(',') } : {}),
      ...(includeArchived ? { includeArchived: true } : {}),
      sortBy: 'createdAt',
      sortOrder: 'DESC' as const,
    }),
    [page, debouncedSearch, districtId, statuses, includeArchived],
  );

  const query = useQuery({
    queryKey: qk.boilers(params),
    queryFn: () => getPaged<Boiler>(API.boilers.list, { params }),
    /* ⚠️ Oldingi sahifa ko'rinib turadi (`placeholderData`): usiz
       sahifani almashtirganda jadval bo'shab, butun ekran «sakrab»
       ketardi. */
    placeholderData: (previous) => previous,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      post(API.boilers.archive(id), { reason }),
    onSuccess: () => {
      toast.success('Kotyol arxivlandi');
      void queryClient.invalidateQueries({ queryKey: ['boilers'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      void queryClient.invalidateQueries({ queryKey: ['map'] });
      setArchiving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => post(API.boilers.restore(id)),
    onSuccess: () => {
      toast.success('Kotyol arxivdan qaytarildi');
      void queryClient.invalidateQueries({ queryKey: ['boilers'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleStatus = (status: BoilerStatus): void => {
    setPage(1);
    setStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status],
    );
  };

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await download(API.boilers.export, 'kotyollar.xlsx', { params });
      toast.success('Excel fayli yuklab olindi');
    } catch (error) {
      toast.error(errorMessage(error, 'Eksport bajarilmadi'));
    } finally {
      setExporting(false);
    }
  };

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Kotyollar
          </h1>
          <p className="text-meta text-muted">
            {query.data
              ? `${formatNumber(query.data.meta.total)} ta qozonxona`
              : 'Yuklanmoqda…'}
            {districtId ? ' · tanlangan tuman bo‘yicha' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('reports.export') ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="size-3.5" />}
              onClick={() => void handleExport()}
              loading={exporting}
            >
              Excel
            </Button>
          ) : null}

          {can('boilers.create') ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<FileUp className="size-3.5" />}
              onClick={() => setImportOpen(true)}
            >
              Excel'dan import
            </Button>
          ) : null}

          {can('boilers.create') ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Yangi qozonxona
            </Button>
          ) : null}
        </div>
      </div>

      {/* ───── Filtrlar ───── */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Lot raqami, tashkilot, firma, manzil…"
              leading={<Search className="size-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_ORDER.map((status) => {
              const meta = BOILER_STATUS[status];
              const active = statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-colors',
                    active
                      ? meta.chip
                      : 'text-muted ring-1 ring-[var(--border-strong)] hover:text-strong',
                  )}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: meta.hex }}
                  />
                  {meta.short}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIncludeArchived((value) => !value);
                setPage(1);
              }}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-colors',
                includeArchived
                  ? 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-200'
                  : 'text-muted ring-1 ring-[var(--border-strong)] hover:text-strong',
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Arxiv
            </button>
          </div>
        </CardBody>
      </Card>

      {/* ───── Jadval ───── */}
      <Card className="overflow-hidden">
        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-96" />
          </CardBody>
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Qozonxona topilmadi"
            description={
              search || statuses.length > 0 || districtId
                ? 'Filtrlarni o‘zgartirib ko‘ring yoki tanlovni tozalang.'
                : 'Hali birorta qozonxona kiritilmagan.'
            }
            action={
              can('boilers.create') ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Birinchisini qo‘shish
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Tuman / shahar</Th>
                  <Th>Lot raqami</Th>
                  <Th>DXSH firma</Th>
                  <Th>Tashkilot</Th>
                  <Th>Marka</Th>
                  <Th align="right">Kotyol soni</Th>
                  <Th align="right">60° norma</Th>
                  <Th>Holati</Th>
                  <Th align="right">Harorat</Th>
                  <Th align="right">Oxirgi signal</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((boiler) => (
                  <Tr
                    key={boiler.id}
                    onClick={() => navigate(`/boilers/${boiler.id}`)}
                    className={cn(boiler.isArchived && 'opacity-60')}
                  >
                    <Td className="whitespace-nowrap text-muted">
                      {boiler.district?.shortName ?? '—'}
                    </Td>
                    <Td className="font-medium whitespace-nowrap text-strong">
                      {boiler.lotNumber ?? <span className="text-faint">—</span>}
                      {boiler.isArchived ? (
                        <span className="ml-1.5 rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-nano text-faint">
                          arxiv
                        </span>
                      ) : null}
                    </Td>
                    <Td className="max-w-[200px] truncate text-muted">
                      {orDash(boiler.firm?.name)}
                    </Td>
                    <Td className="max-w-[240px] truncate">
                      {orDash(boiler.organization?.name)}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {orDash(boiler.brand?.name)}
                    </Td>
                    <Td align="right" className="font-semibold text-strong">
                      {boiler.boilerCount}
                    </Td>
                    <Td align="right" className="text-muted">
                      {boiler.normAt60 === null
                        ? '—'
                        : formatNumber(boiler.normAt60)}
                    </Td>
                    <Td>
                      <StatusBadge status={boiler.currentStatus} short />
                    </Td>
                    <Td
                      align="right"
                      className="font-semibold"
                      style={{
                        color:
                          BOILER_STATUS[boiler.currentStatus].hex,
                      }}
                    >
                      {formatTemperature(boiler.lastTemperature)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-muted">
                      {boiler.lastReadingAt
                        ? formatRelativeUz(boiler.lastReadingAt)
                        : 'signal yo‘q'}
                    </Td>
                    <Td align="right">
                      {/* ⚠️ Amallar qator bosilishini TO'SADI
                          (`stopPropagation`): usiz «tahrirlash»
                          tugmasi bosilganda qator ham ochilib,
                          foydalanuvchi boshqa sahifaga tushib
                          ketardi. */}
                      <span
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {can('boilers.update') && !boiler.isArchived ? (
                          <button
                            type="button"
                            aria-label="Tahrirlash"
                            onClick={() => {
                              setEditing(boiler);
                              setFormOpen(true);
                            }}
                            className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}

                        {can('boilers.delete') ? (
                          boiler.isArchived ? (
                            <button
                              type="button"
                              aria-label="Arxivdan qaytarish"
                              onClick={() => restoreMutation.mutate(boiler.id)}
                              className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-ok-600"
                            >
                              <ArchiveRestore className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label="Arxivlash"
                              onClick={() => setArchiving(boiler)}
                              className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          )
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {query.data ? (
              <Pagination meta={query.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <BoilerImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <BoilerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        boiler={editing}
      />

      <ConfirmModal
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() =>
          archiving &&
          archiveMutation.mutate({
            id: archiving.id,
            reason: 'Ro‘yxatdan chiqarildi',
          })
        }
        loading={archiveMutation.isPending}
        title="Kotyolni arxivlash"
        confirmLabel="Arxivlash"
        message={
          <>
            <strong>
              {boilerName(archiving?.organization?.name, archiving?.lotNumber)}
            </strong>{' '}
            arxivga ko‘chiriladi.
            <br />
            <span className="text-muted">
              Yozuv o‘chirilmaydi: telemetriya tarixi va hisobotlar saqlanib
              qoladi, kotyol esa joriy ro‘yxatdan chiqadi.
            </span>
          </>
        }
      />
    </div>
  );
}
