import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Cpu,
  Flame,
  KeyRound,
  LineChart,
  Pencil,
  Plus,
  Search,
  Thermometer,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { del, errorMessage, get, getPaged, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DeviceRow,
  DeviceType,
  DeviceVersionCount,
  DeviceWithKey,
  Paged,
} from '@/shared/api/types';
import {
  DEVICE_TYPE_META,
  TOKEN_KIND_LABEL,
} from '@/shared/constants/device-type';
import { otaStatusMeta } from '@/shared/constants/ota';
import { useDistricts } from '@/shared/hooks/useCatalogOptions';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import {
  formatNumber,
  formatPercent,
  formatTemperature,
} from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { ApiKeyModal, type IssuedKey } from './components/ApiKeyModal';
import { DeviceChartModal } from './components/DeviceChartModal';
import { DeviceFormModal } from './components/DeviceFormModal';
import { PendingDevicesCard } from './components/PendingDevicesCard';

type StatusFilter = 'all' | 'online' | 'offline';

/**
 * ESP32 MODULLARI.
 *
 * ⚠️⚠️ API kalit FAQAT yaratilgan yoki almashtirilgan paytda, BIR
 * MARTA ko'rsatiladi — bazada uning hash'i saqlanadi. Ro'yxatda faqat
 * token TURI (shaxsiy / umumiy) ko'rinadi — qaysi usulda ishlayotganini
 * ajratish uchun yetarli, ishlatish uchun emas.
 *
 * ⚠️ Joylashuv ustunlari (tuman, obyekt turi, muassasa) — AMALDAGI
 * qiymat (`location`). Panelda bo'sh bo'lib, plata aytgan qiymat bo'lsa,
 * u «taklif» sifatida ko'rinadi va «Tasdiqlash» bilan qabul qilinadi.
 */
export function DevicesPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DeviceType>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [version, setVersion] = useState('');
  const [onlySuggestions, setOnlySuggestions] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [removing, setRemoving] = useState<DeviceRow | null>(null);
  const [rotating, setRotating] = useState<DeviceRow | null>(null);
  const [charting, setCharting] = useState<DeviceRow | null>(null);
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);

  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(districtId ? { districtId } : {}),
      ...(typeFilter !== 'all' ? { deviceType: typeFilter } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(version ? { version } : {}),
      ...(onlySuggestions ? { hasSuggestion: true } : {}),
      ...(onlyUnassigned ? { unassigned: true } : {}),
    }),
    [
      page,
      debouncedSearch,
      districtId,
      typeFilter,
      status,
      version,
      onlySuggestions,
      onlyUnassigned,
    ],
  );

  const query = useQuery({
    queryKey: qk.devices(params),
    queryFn: (): Promise<Paged<DeviceRow>> =>
      getPaged<DeviceRow>(API.devices.list, { params }),
    placeholderData: (previous) => previous,
    /* ⚠️ «Onlayn» 5 daqiqalik chegara — ro'yxat ham yangilanib turadi. */
    refetchInterval: 60_000,
  });

  const districts = useDistricts();
  const versions = useQuery({
    queryKey: qk.deviceVersions,
    queryFn: () => get<DeviceVersionCount[]>(API.devices.versions),
    staleTime: 60_000,
  });
  const hasNoneVersion = (versions.data ?? []).some(
    (item) => item.version === null,
  );

  const removeMutation = useMutation({
    mutationFn: (id: string) => del(API.devices.one(id)),
    onSuccess: () => {
      toast.success('Qurilma o‘chirildi');
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      setRemoving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => post<DeviceWithKey>(API.devices.rotateKey(id)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      setRotating(null);
      if (result.apiKey) {
        setIssuedKey({
          deviceId: result.device.deviceId,
          apiKey: result.apiKey,
        });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      post<DeviceRow>(API.devices.confirmLocation(id), {}),
    onSuccess: (row) => {
      toast.success(`«${row.deviceId}» joylashuvi tasdiqlandi`);
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetPage = (): void => setPage(1);
  const items = query.data?.items ?? [];
  const canUpdate = can('devices.update');

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="ESP32 modullari"
        subtitle={
          query.data
            ? `${formatNumber(query.data.meta.total)} ta qurilma`
            : 'Yuklanmoqda…'
        }
        actions={
          can('devices.create') ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Yangi modul
            </Button>
          ) : null
        }
      />

      <PendingDevicesCard onIssued={setIssuedKey} />

      <Card>
        <CardBody className="flex flex-col gap-2 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Identifikator, nom, lot, muassasa yoki MFY…"
                leading={<Search className="size-4" />}
              />
            </div>

            {/* ⚠️ Tuman mas'uliga server faqat o'z tumanini qaytaradi —
                bitta variantli filtr ma'nosiz, shuning uchun yashiriladi. */}
            {(districts.data?.length ?? 0) > 1 ? (
              <Select
                aria-label="Tuman bo‘yicha"
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  resetPage();
                }}
                className="w-auto min-w-[170px]"
              >
                <option value="">Barcha tumanlar</option>
                {(districts.data ?? []).map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </Select>
            ) : null}

            <Select
              aria-label="Proshivka versiyasi bo‘yicha"
              value={version}
              onChange={(event) => {
                setVersion(event.target.value);
                resetPage();
              }}
              className="w-auto min-w-[150px]"
            >
              <option value="">Barcha versiyalar</option>
              {(versions.data ?? []).map((item) => (
                <option
                  key={item.version ?? 'none'}
                  value={item.version ?? 'none'}
                >
                  {item.version ? `v${item.version}` : 'Versiyasiz'} (
                  {formatNumber(item.count)})
                </option>
              ))}
              {/* ⚠️ «Versiyasiz» ro'yxatda bo'lmasa ham tanlanadi. */}
              {hasNoneVersion ? null : <option value="none">Versiyasiz</option>}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Tur bo‘yicha"
              value={typeFilter}
              options={[
                { value: 'all', label: 'Barcha turlar' },
                {
                  value: 'kotyol',
                  label: DEVICE_TYPE_META.kotyol.short,
                  icon: <Flame aria-hidden />,
                },
                {
                  value: 'xona',
                  label: DEVICE_TYPE_META.xona.short,
                  icon: <Thermometer aria-hidden />,
                },
              ]}
              onChange={(key) => {
                setTypeFilter(key);
                resetPage();
              }}
            />
            <Segmented
              ariaLabel="Holat bo‘yicha"
              value={status}
              options={[
                { value: 'all', label: 'Hammasi' },
                {
                  value: 'online',
                  label: 'Onlayn',
                  icon: <Wifi aria-hidden />,
                },
                {
                  value: 'offline',
                  label: 'Oflayn',
                  icon: <WifiOff aria-hidden />,
                },
              ]}
              onChange={(key) => {
                setStatus(key);
                resetPage();
              }}
            />
            <span
              aria-hidden
              className="mx-0.5 hidden h-5 w-px bg-line sm:block"
            />
            <ToggleChip
              active={onlyUnassigned}
              onClick={() => {
                setOnlyUnassigned((value) => !value);
                resetPage();
              }}
            >
              Kotyolga biriktirilmagan
            </ToggleChip>
            <ToggleChip
              active={onlySuggestions}
              onClick={() => {
                setOnlySuggestions((value) => !value);
                resetPage();
              }}
            >
              Tasdiqlanmagan taklif
            </ToggleChip>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-80" />
          </CardBody>
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="Modul topilmadi"
            description="ESP32 moduli qo‘shilgandan so‘ng u shu ro‘yxatda ko‘rinadi va telemetriya qabul qila boshlaydi."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Qurilma</Th>
                  <Th>Turi</Th>
                  <Th>Tuman</Th>
                  <Th>Obyekt turi</Th>
                  <Th>Muassasa</Th>
                  <Th>Proshivka</Th>
                  {/*
                    ⚠️ «Oxirgi telemetriya» va «Oxirgi OTA» — ALOHIDA
                    ustun: datchigi uzilgan plata telemetriya yubormaydi,
                    lekin OTA tekshiruvini davom ettiradi. Bitta ustun
                    bo'lsa, bunday qurilma «o'lgan» bo'lib ko'rinardi.
                  */}
                  <Th>Oxirgi telemetriya</Th>
                  <Th>Oxirgi OTA</Th>
                  <Th>Token</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((device) => (
                  <DeviceTableRow
                    key={device.id}
                    device={device}
                    canUpdate={canUpdate}
                    canRotate={can('devices.rotate_key')}
                    canDelete={can('devices.delete')}
                    confirming={
                      confirmMutation.isPending &&
                      confirmMutation.variables === device.id
                    }
                    onConfirm={() => confirmMutation.mutate(device.id)}
                    onChart={() => setCharting(device)}
                    onEdit={() => {
                      setEditing(device);
                      setFormOpen(true);
                    }}
                    onRotate={() => setRotating(device)}
                    onRemove={() => setRemoving(device)}
                  />
                ))}
              </tbody>
            </Table>

            {query.data ? (
              <Pagination meta={query.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <DeviceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        device={editing}
        onIssued={setIssuedKey}
      />

      <DeviceChartModal device={charting} onClose={() => setCharting(null)} />

      <ApiKeyModal value={issuedKey} onClose={() => setIssuedKey(null)} />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeMutation.mutate(removing.id)}
        loading={removeMutation.isPending}
        title="Qurilmani o‘chirish"
        confirmLabel="O‘chirish"
        message={
          <>
            <strong>{removing?.deviceId}</strong> tizimdan o‘chiriladi.
            <br />
            <span className="text-muted">
              Telemetriya tarixi saqlanib qoladi (u kotyolga ham bog‘langan),
              lekin qurilma yangi signal yubora olmaydi.
            </span>
          </>
        }
      />

      <ConfirmModal
        open={Boolean(rotating)}
        onClose={() => setRotating(null)}
        onConfirm={() => rotating && rotateMutation.mutate(rotating.id)}
        loading={rotateMutation.isPending}
        title="API kalitni almashtirish"
        confirmLabel="Almashtirish"
        message={
          <>
            <strong>{rotating?.deviceId}</strong> uchun yangi kalit generatsiya
            qilinadi.
            <br />
            <span className="text-danger-600">
              Eski kalit DARHOL ishlamay qoladi — proshivka yangilanmaguncha
              qurilma signal yubora olmaydi.
            </span>
          </>
        }
      />
    </div>
  );
}

// ───────────────── Jadval qatori ─────────────────

function DeviceTableRow({
  device,
  canUpdate,
  canRotate,
  canDelete,
  confirming,
  onConfirm,
  onChart,
  onEdit,
  onRotate,
  onRemove,
}: {
  device: DeviceRow;
  canUpdate: boolean;
  canRotate: boolean;
  canDelete: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onChart: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const { location, suggestion } = device;
  const typeMeta = DEVICE_TYPE_META[device.deviceType];
  /*
   * ⚠️ Kotyolga ulangan qurilmada joylashuv kotyoldan olinadi — server
   * tasdiqlashni rad etadi, shuning uchun tugma ko'rsatilmaydi.
   */
  const canConfirm = canUpdate && suggestion !== null && !device.boilerId;
  const ota = device.lastOta ? otaStatusMeta(device.lastOta.status) : null;

  return (
    <Tr className={cn(!device.isActive && 'opacity-60')}>
      <Td>
        <div className="flex items-center gap-3">
          {/* ⚠️ Jonli nuqta faqat ONLAYN qurilmada to'lqin tarqatadi: oflayn
              nuqta harakatsiz va kulrang — «aloqa yo'q» avariya emas,
              noma'lum holat (`index.css` dagi `idle` qoidasi). */}
          <span
            className="relative flex size-2.5 shrink-0"
            title={device.online ? 'Onlayn' : 'Oflayn'}
          >
            {device.online ? (
              <span
                aria-hidden
                className="live-ping absolute inset-0 rounded-full bg-ok-500"
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                'relative size-2.5 rounded-full',
                device.online
                  ? 'bg-ok-500 shadow-[0_0_0_3px_rgb(17_138_86/0.16),0_0_10px_rgb(17_138_86/0.55)]'
                  : 'bg-idle-300 ring-2 ring-idle-200 ring-inset dark:bg-idle-500 dark:ring-white/10',
              )}
            />
            <span className="sr-only">
              {device.online ? 'Onlayn' : 'Oflayn'}
            </span>
          </span>
          <div className="min-w-0">
            {/*
              ⚠️ Identifikator BITTA qatorda: u montajchi platadan o'qib
              solishtiradigan qiymat, ikkiga bo'linsa adashtirish oson.
            */}
            <p className="font-mono font-medium whitespace-nowrap text-strong">
              {device.deviceId}
            </p>
            {device.name ? (
              <p className="max-w-[16rem] truncate text-micro text-muted">
                {device.name}
              </p>
            ) : null}
            {device.deviceType === 'xona' ? (
              <RoomReading device={device} />
            ) : null}
            {!device.isActive ? (
              <Badge className="mt-0.5 bg-[var(--surface-sunken)] text-faint">
                O‘chirilgan
              </Badge>
            ) : null}
          </div>
        </div>
      </Td>

      <Td>
        <Badge className={typeMeta.chip}>{typeMeta.short}</Badge>
      </Td>

      <Td className="whitespace-nowrap">
        <LocationValue
          value={location.district?.shortName}
          suggested={suggestion?.district?.name}
        />
      </Td>

      <Td className="whitespace-nowrap">
        <LocationValue
          value={location.objectType?.name}
          suggested={suggestion?.objectType?.name}
        />
      </Td>

      <Td>
        <div className="flex max-w-[16rem] flex-col gap-1">
          <LocationValue
            value={location.institution?.name}
            suggested={suggestion?.institution}
          />
          {device.boiler ? (
            <span className="truncate text-micro text-faint">
              Kotyol:{' '}
              {boilerName(
                device.boiler.organization?.name,
                device.boiler.lotNumber,
              )}
            </span>
          ) : null}
          {canConfirm ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              icon={<CheckCircle2 className="size-3.5" />}
              loading={confirming}
              onClick={onConfirm}
              title="Plata aytgan qiymatlar paneldagi BO‘SH maydonlarga yoziladi"
            >
              Tasdiqlash
            </Button>
          ) : null}
        </div>
      </Td>

      <Td className="whitespace-nowrap">
        {device.firmwareVersion ? (
          <span
            className="rounded-[4px] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink ring-1 ring-[var(--border-subtle)] ring-inset"
            data-numeric
          >
            v{device.firmwareVersion}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </Td>

      <Td className="whitespace-nowrap">
        <span
          className="block text-muted"
          title={
            device.lastSeenAt ? formatDateTimeUz(device.lastSeenAt) : undefined
          }
        >
          {device.lastSeenAt
            ? formatRelativeUz(device.lastSeenAt)
            : 'hech qachon'}
        </span>
        {/* ⚠️ Oflayn — KULRANG, qizil emas: aloqa yo'qligi ko'pincha
            internet uzilishi, avariya emas (`index.css` dagi `idle` holat
            qoidasi). Qizil faqat haqiqiy nosozlik uchun qoladi. */}
        {device.online ? (
          <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-ok-700 uppercase dark:text-ok-300">
            onlayn
          </span>
        ) : (
          <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-idle-600 uppercase dark:text-idle-300">
            oflayn
          </span>
        )}
      </Td>

      <Td className="whitespace-nowrap">
        {device.lastOta && ota ? (
          <span
            className="flex flex-col items-start gap-0.5"
            title={[formatDateTimeUz(device.lastOta.at), device.lastOta.message]
              .filter(Boolean)
              .join(' · ')}
          >
            <Badge className={ota.chip}>{ota.label}</Badge>
            {device.lastOta.targetVersion ? (
              <span
                className="font-mono text-[10.5px] text-muted"
                data-numeric
              >
                → v{device.lastOta.targetVersion}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </Td>

      <Td className="whitespace-nowrap">
        {device.tokenKind ? (
          <Badge
            className={
              device.tokenKind === 'shared'
                ? 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25'
                : 'bg-[var(--surface-sunken)] text-muted ring-1 ring-[var(--border-subtle)]'
            }
          >
            {TOKEN_KIND_LABEL[device.tokenKind]}
          </Badge>
        ) : (
          <span className="text-faint">—</span>
        )}
      </Td>

      <Td align="right">
        <span className="flex items-center justify-end gap-1">
          <IconButton label="Grafik" onClick={onChart}>
            <LineChart className="size-3.5" />
          </IconButton>
          {canUpdate ? (
            <IconButton label="Tahrirlash" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </IconButton>
          ) : null}
          {canRotate ? (
            <IconButton label="Kalitni almashtirish" onClick={onRotate}>
              <KeyRound className="size-3.5" />
            </IconButton>
          ) : null}
          {canDelete ? (
            <IconButton label="O‘chirish" danger onClick={onRemove}>
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </span>
      </Td>
    </Tr>
  );
}

/**
 * Joylashuv qiymati: panelda bor bo'lsa — o'zi; bo'lmasa plata aytgani
 * «taklif» belgisi bilan (hali tasdiqlanmagan).
 */
function LocationValue({
  value,
  suggested,
}: {
  value: string | null | undefined;
  suggested: string | null | undefined;
}) {
  if (value) return <span className="text-ink">{value}</span>;
  if (suggested) {
    return (
      <span
        className="inline-flex flex-wrap items-center gap-1 text-warn-700 dark:text-warn-300"
        title="Plata aytgan — hali tasdiqlanmagan"
      >
        <span className="italic">{suggested}</span>
        <Badge className="bg-warn-50 font-mono text-[9.5px] tracking-[0.08em] text-warn-700 uppercase ring-1 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25">
          taklif
        </Badge>
      </span>
    );
  }
  return <span className="text-faint">—</span>;
}

/** Oxirgi xona harorati va namligi; eskirgan o'lchov xira ko'rinadi. */
function RoomReading({ device }: { device: DeviceRow }) {
  const temperature = device.lastRoomTemperature;
  if (temperature === null) return null;
  const fresh =
    device.lastRoomReadingAt !== null &&
    Date.now() - new Date(device.lastRoomReadingAt).getTime() < 15 * 60 * 1000;
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-micro tabular-nums',
        fresh ? 'text-strong' : 'text-faint',
      )}
      title={
        device.lastRoomReadingAt
          ? `O‘lchandi: ${formatDateTimeUz(device.lastRoomReadingAt)}`
          : undefined
      }
    >
      <Thermometer className="size-3" aria-hidden />
      <span className="font-medium">{formatTemperature(temperature)}</span>
      {device.lastHumidity !== null ? (
        <span className="text-muted">
          · {formatPercent(device.lastHumidity)}
        </span>
      ) : null}
    </p>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted outline-none',
        'transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-90',
        danger
          ? 'hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/12 dark:hover:text-danger-300'
          : 'hover:bg-[var(--surface-sunken)] hover:text-strong dark:hover:bg-white/[0.06]',
      )}
    >
      {children}
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-md px-3 text-micro font-semibold outline-none',
        'transition-[background-color,box-shadow,color,transform] duration-200 ease-out-quint active:scale-[0.97]',
        'focus-visible:ring-2 focus-visible:ring-brand-400',
        active
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25'
          : 'text-muted ring-1 ring-[var(--border-strong)] ring-inset hover:bg-[var(--surface-muted)] hover:text-strong',
      )}
    >
      {/* Belgi katagi — «yoqilgan / o'chiq» rangsiz ham ko'rinsin. */}
      <span
        aria-hidden
        className={cn(
          'grid size-3 place-items-center rounded-[3px] ring-1 ring-inset transition-colors duration-200',
          active
            ? 'bg-brand-600 ring-brand-600 dark:bg-brand-400 dark:ring-brand-400'
            : 'ring-[var(--border-strong)]',
        )}
      >
        {active ? <Check className="size-2.5 text-white" strokeWidth={3.5} /> : null}
      </span>
      {children}
    </button>
  );
}
