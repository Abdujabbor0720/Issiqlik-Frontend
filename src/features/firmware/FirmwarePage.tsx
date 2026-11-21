import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronsRight,
  CircleOff,
  Cpu,
  DoorOpen,
  FileUp,
  Flame,
  Lock,
  PauseCircle,
  PlayCircle,
  Rocket,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import toast from 'react-hot-toast';
import {
  del,
  errorMessage,
  get,
  getPaged,
  patch,
  post,
  postForm,
} from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DeviceRow,
  DeviceType,
  FirmwareBlock,
  FirmwareInspection,
  FirmwareRelease,
  FirmwareRollout,
  RolloutProgress,
  RolloutStatus,
  RolloutTargetType,
} from '@/shared/api/types';
import { DEVICE_TYPES, DEVICE_TYPE_META } from '@/shared/constants/device-type';
import { otaStatusMeta } from '@/shared/constants/ota';
import { useDistricts, useObjectTypes } from '@/shared/hooks/useCatalogOptions';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';

/** OTA bo'limi hajmi — serverdagi chegara bilan AYNI. */
const MAX_BIN_BYTES = 1_966_080;

const ROLLOUT_STATUS: Record<
  RolloutStatus,
  { label: string; chip: string; dot: string }
> = {
  active: {
    label: 'Tarqatilmoqda',
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25',
    dot: 'bg-brand-500 shadow-[0_0_6px_var(--color-brand-400)]',
  },
  paused: {
    label: 'To‘xtatilgan',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
    dot: 'bg-warn-500',
  },
  done: {
    label: 'Tugadi',
    chip: 'bg-ok-50 text-ok-700 ring-1 ring-ok-200 ring-inset dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25',
    dot: 'bg-ok-500',
  },
  cancelled: {
    label: 'Bekor qilingan',
    chip: 'bg-idle-100 text-idle-700 ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10',
    dot: 'bg-idle-400',
  },
};

const TARGET_LABELS: Record<RolloutTargetType, string> = {
  all: 'Barcha qurilmalar',
  districts: 'Tanlangan tumanlar',
  object_types: 'Obyekt turlari',
  devices: 'Tanlangan qurilmalar',
};

const TYPE_SOURCE_LABEL: Record<FirmwareRelease['typeSource'], string> = {
  marker: 'belgidan',
  manual: 'qo‘lda',
};

/**
 * BOSQICHLAR: 1 (sinov) → 10 → 50 → `null` (hammasi).
 *
 * ⚠️ Bosqich «bir vaqtda nechta qurilma» degani: 1 → 10 qilinsa sinovdagi
 * qurilma qayta hisoblanmaydi, yana 9 tasiga taklif ochiladi.
 */
const STAGES: ReadonlyArray<number | null> = [1, 10, 50, null];

/** Joriy bosqichdan keyingisi; `undefined` — oxirgi bosqich (hammasi). */
function nextStage(current: number | null): number | null | undefined {
  if (current === null) return undefined;
  return STAGES.find((stage) => stage === null || stage > current);
}

function stageLabel(maxDevices: number | null): string {
  if (maxDevices === null) return 'hammasi';
  if (maxDevices === 1) return '1 qurilma (sinov)';
  return `${formatNumber(maxDevices)} qurilma`;
}

/** Reliz/tarqatish qaysi qurilma turi uchun. */
function DeviceTypeBadge({ type }: { type: DeviceType }) {
  const meta = DEVICE_TYPE_META[type];
  const Icon = type === 'xona' ? DoorOpen : Flame;
  return (
    /* ⚠️ Tur yorlig'i IKONKA bilan: kotyol va xona relizlari bitta
       ro'yxatda turadi va faqat rang bilan ajralsa, adashib boshqa
       modulga tarqatish xavfi bor (xato tur modulni buzadi). */
    <Badge
      className={cn(
        meta.chip,
        'font-mono text-[10px] tracking-[0.06em] uppercase ring-inset',
        type === 'xona' && 'dark:ring-brand-400/25',
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}

/**
 * BOSQICH CHIZIG'I — 1 → 10 → 50 → hammasi.
 *
 * ⚠️ Faqat KO'RINISH: joriy bosqich `maxDevices` dan olinadi. Standart
 * bo'lmagan qiymat (masalan 25) undan kichik eng katta bosqichga tushadi.
 * Faol tarqatishda o'tilgan qism TERMAL oqim bilan — «jarayon ketyapti».
 */
function StageTrack({
  maxDevices,
  live,
  className,
}: {
  maxDevices: number | null;
  live?: boolean;
  className?: string;
}) {
  const current =
    maxDevices === null
      ? STAGES.length - 1
      : Math.max(
          0,
          STAGES.filter((stage) => stage !== null && stage <= maxDevices)
            .length - 1,
        );

  return (
    <div
      role="img"
      aria-label={`Bosqich: ${stageLabel(maxDevices)}`}
      title={`Bosqich: ${stageLabel(maxDevices)}`}
      className={cn('flex items-center gap-1', className)}
    >
      {STAGES.map((stage, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span className="relative h-[3px] w-5 overflow-hidden rounded-full bg-[var(--border-subtle)] sm:w-7">
              <span
                className={cn(
                  'absolute inset-0 origin-left rounded-full transition-transform duration-700 ease-out-expo',
                  index <= current ? 'scale-x-100' : 'scale-x-0',
                  live ? 'thermal-line' : 'bg-brand-400 dark:bg-brand-300',
                )}
              />
            </span>
          ) : null}
          <span
            className={cn(
              'grid h-5 min-w-5 place-items-center rounded-[5px] px-1 font-mono text-[10px] leading-none font-bold tabular-nums ring-1 ring-inset transition-[background-color,box-shadow,color] duration-300',
              index < current &&
                'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25',
              index === current &&
                'bg-brand-600 text-white ring-brand-700 shadow-[0_0_12px_-2px_var(--color-brand-500)] dark:bg-brand-500 dark:ring-brand-400/50',
              index > current &&
                'bg-[var(--surface-sunken)] text-faint ring-[var(--border-subtle)]',
            )}
          >
            {stage === null ? '∞' : stage}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * PROSHIVKA VA MASOFADAN YANGILASH (OTA).
 *
 * ⚠️⚠️ BU SAHIFA TIZIMDAGI ENG XAVFLI TUGMANI SAQLAYDI. «Tarqatishni
 * boshlash» butun viloyat bo'ylab qurilmalarga YANGI KOD yuboradi va
 * yaroqsiz reliz yuzlab platani «o'rnatish → qaytish» halqasiga
 * soladi. Shuning uchun interfeys ataylab BIR NECHTA to'siq
 * qo'yadi:
 *   • sinov bosqichi (1 qurilma) SUKUT BO'YICHA — keyin 10 → 50 → hammasi;
 *   • reliz turi (kotyol / xona) oynada aniq aytiladi;
 *   • «To'xtatish» tugmasi doim ko'rinib turadi;
 *   • bloklangan qurilmalar alohida bo'limda sanaladi.
 */
export function FirmwarePage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const canRollout = can('firmware.rollout');
  const canUpload = can('firmware.upload');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [rolloutFor, setRolloutFor] = useState<FirmwareRelease | null>(null);
  const [progressFor, setProgressFor] = useState<FirmwareRollout | null>(null);

  const releases = useQuery({
    queryKey: qk.releases,
    queryFn: () => get<FirmwareRelease[]>(API.firmware.releases),
  });

  const rollouts = useQuery({
    queryKey: qk.rollouts,
    queryFn: () => get<FirmwareRollout[]>(API.firmware.rollouts),
    /* ⚠️ Tarqatish davomida holat o'zgarib turadi: qurilmalar har
       30 daqiqada so'raydi va bu ekranda eskirgan ma'lumot
       «tarqatish qotib qoldi» degan noto'g'ri xulosaga olib kelardi. */
    refetchInterval: 30_000,
  });

  const blocks = useQuery({
    queryKey: qk.firmwareBlocks,
    queryFn: () => get<FirmwareBlock[]>(API.firmware.blocks),
  });

  /*
   * ⚠️ HAR QURILMA TURI uchun bittadan faol tarqatish (kotyol va xona
   * modullari mustaqil yangilanadi) — shuning uchun ro'yxat.
   */
  const activeRollouts = useMemo(
    () => rollouts.data?.filter((item) => item.status === 'active') ?? [],
    [rollouts.data],
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RolloutStatus }) =>
      patch(API.firmware.rolloutStatus(id), { status }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.status === 'paused'
          ? 'Tarqatish to‘xtatildi'
          : variables.status === 'active'
            ? 'Tarqatish davom ettirildi'
            : 'Tarqatish bekor qilindi',
      );
      void queryClient.invalidateQueries({ queryKey: qk.rollouts });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const limitMutation = useMutation({
    mutationFn: ({
      id,
      maxDevices,
    }: {
      id: string;
      maxDevices: number | null;
    }) => patch(API.firmware.rolloutLimit(id), { maxDevices }),
    onSuccess: (_result, variables) => {
      toast.success(`Bosqich: ${stageLabel(variables.maxDevices)}`);
      void queryClient.invalidateQueries({ queryKey: qk.rollouts });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => del(API.firmware.release(id)),
    onSuccess: () => {
      toast.success('Reliz arxivlandi');
      void queryClient.invalidateQueries({ queryKey: qk.releases });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => del(API.firmware.block(id)),
    onSuccess: () => {
      toast.success('Blok olib tashlandi — versiya qayta taklif qilinadi');
      void queryClient.invalidateQueries({ queryKey: qk.firmwareBlocks });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const blockedCount =
    blocks.data?.filter((item) => item.isBlocked).length ?? 0;

  const advanceStage = (rollout: FirmwareRollout): void => {
    const next = nextStage(rollout.maxDevices);
    if (next === undefined) return;
    /*
     * ⚠️ «Hammasi» — qaytarib bo'lmaydigan darajada keng qaror: tasdiq
     * so'raladi. Oraliq bosqichlar (10, 50) — bir bosishda.
     */
    if (
      next === null &&
      !window.confirm(
        `v${rollout.version} cheklovsiz tarqatiladi — maqsaddagi BARCHA qurilmalar yangilanadi. Davom etilsinmi?`,
      )
    ) {
      return;
    }
    limitMutation.mutate({ id: rollout.id, maxDevices: next });
  };

  const cancelRollout = (rollout: FirmwareRollout): void => {
    if (
      window.confirm(
        'Tarqatish BEKOR qilinadi va qayta davom ettirilmaydi. Davom etilsinmi?',
      )
    ) {
      statusMutation.mutate({ id: rollout.id, status: 'cancelled' });
    }
  };

  /** Bosqich / to'xtatish / bekor qilish — faol va to'xtatilganlar uchun. */
  const rolloutControls = (rollout: FirmwareRollout) => {
    if (!canRollout) return null;
    if (rollout.status !== 'active' && rollout.status !== 'paused') return null;
    const next = nextStage(rollout.maxDevices);
    return (
      <>
        {next !== undefined ? (
          <Button
            size="sm"
            variant="secondary"
            loading={
              limitMutation.isPending &&
              limitMutation.variables?.id === rollout.id
            }
            onClick={() => advanceStage(rollout)}
            title={`Keyingi bosqich: ${stageLabel(next)}`}
          >
            <ChevronsRight className="size-4" />
            Keyingi bosqich ({next === null ? 'hammasi' : formatNumber(next)})
          </Button>
        ) : null}
        {rollout.status === 'active' ? (
          <Button
            size="sm"
            variant="secondary"
            loading={
              statusMutation.isPending &&
              statusMutation.variables?.id === rollout.id &&
              statusMutation.variables.status === 'paused'
            }
            onClick={() =>
              statusMutation.mutate({ id: rollout.id, status: 'paused' })
            }
          >
            <PauseCircle className="size-4" />
            To‘xtatish
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={
              statusMutation.isPending &&
              statusMutation.variables?.id === rollout.id &&
              statusMutation.variables.status === 'active'
            }
            onClick={() =>
              statusMutation.mutate({ id: rollout.id, status: 'active' })
            }
          >
            <PlayCircle className="size-4" />
            Davom ettirish
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => cancelRollout(rollout)}
        >
          <XCircle className="size-4" />
          Bekor qilish
        </Button>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Proshivka va masofadan yangilash"
        subtitle={
          releases.data ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-baseline gap-1">
                <AnimatedNumber
                  value={formatNumber(releases.data.length)}
                  className="font-mono text-[12.5px] font-bold text-strong"
                />
                ta reliz
              </span>
              {activeRollouts.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25">
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="live-ping absolute inset-0 rounded-full bg-brand-500" />
                    <span className="relative size-1.5 rounded-full bg-brand-500" />
                  </span>
                  {activeRollouts.length} ta faol tarqatish
                </span>
              ) : null}
              {blockedCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-danger-50 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-danger-700 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
                  <Ban className="size-3" />
                  {blockedCount} ta blok
                </span>
              ) : null}
            </span>
          ) : (
            'Yuklanmoqda…'
          )
        }
        actions={
          canUpload ? (
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              <FileUp className="size-4" />
              Proshivka yuklash
            </Button>
          ) : null
        }
      />

      {/*
        ⚠️⚠️ FAOL TARQATISH ENG TEPADA va ajralib turadi. Administrator
        uni DARHOL ko'rishi kerak: har qurilma turi uchun bir vaqtda faqat
        bitta faol tarqatish bo'lishi mumkin. Tepasida TERMAL chiziq va
        jonli nuqta — bu ekrandagi yagona «hozir ketayotgan» jarayon.
      */}
      {activeRollouts.map((activeRollout) => (
        <Card
          key={activeRollout.id}
          className="overflow-hidden bg-[color-mix(in_srgb,var(--color-brand-50)_55%,var(--surface))] ring-1 ring-brand-200 dark:bg-brand-400/[0.06] dark:ring-brand-400/25"
        >
          <span
            aria-hidden
            className="thermal-line absolute inset-x-0 top-0 h-[3px]"
          />
          <span
            aria-hidden
            className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(90deg,transparent_35%,#000)]"
          />
          <CardBody className="relative flex flex-wrap items-center justify-between gap-4 pt-5">
            <div className="flex items-center gap-3.5">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-tile bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]">
                <Rocket className="size-5" strokeWidth={2} />
                <span
                  className="absolute -top-1 -right-1 flex size-2.5"
                  aria-hidden
                >
                  <span className="live-ping absolute inset-0 rounded-full bg-ok-400" />
                  <span className="relative size-2.5 rounded-full bg-ok-400 ring-2 ring-[var(--surface)]" />
                </span>
              </span>
              <div className="min-w-0">
                <p className="label-eyebrow !text-brand-600 dark:!text-brand-300">
                  Faol tarqatish
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[20px] leading-none font-bold tracking-[-0.02em] text-strong">
                    v{activeRollout.version}
                  </span>
                  <DeviceTypeBadge type={activeRollout.deviceType} />
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
                  <span>{TARGET_LABELS[activeRollout.targetType]}</span>
                  <span aria-hidden className="text-faint">
                    ·
                  </span>
                  <span className="font-mono text-[11px]">
                    {formatRelativeUz(activeRollout.createdAt)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1.5">
              <span className="label-eyebrow">
                Bosqich ·{' '}
                <span className="text-strong">
                  {stageLabel(activeRollout.maxDevices)}
                </span>
              </span>
              <StageTrack maxDevices={activeRollout.maxDevices} live />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setProgressFor(activeRollout)}
              >
                <Activity className="size-4" />
                Jarayonni ko‘rish
              </Button>
              {rolloutControls(activeRollout)}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* ───────── Relizlar ───────── */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<Cpu className="size-4" />}
          eyebrow="OTA · .bin"
          title="Yuklangan relizlar"
        />
        {releases.isLoading ? (
          <CardBody>
            <Skeleton className="h-40" />
          </CardBody>
        ) : releases.isError ? (
          <ErrorState
            message={errorMessage(releases.error)}
            onRetry={() => void releases.refetch()}
          />
        ) : (releases.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Cpu}
            title="Hali proshivka yuklanmagan"
            description="«.bin» faylni yuklang — versiya va qurilma turi fayl ichidagi ANDIJON_FW_VERSION va ANDIJON_FW_MODULE belgilaridan avtomatik o‘qiladi."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Versiya</Th>
                <Th>Tur manbai</Th>
                <Th align="right">Hajm</Th>
                <Th>SHA-256</Th>
                <Th>Yuklandi</Th>
                <Th>Izoh</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {releases.data?.map((release) => {
                const blockingRollout = activeRollouts.find(
                  (item) => item.deviceType === release.deviceType,
                );
                return (
                  <Tr
                    key={release.id}
                    className={cn(
                      'group/row hover:bg-[var(--surface-muted)] hover:shadow-[inset_3px_0_0_var(--color-brand-500)] dark:hover:bg-white/[0.025]',
                      release.isArchived && 'opacity-60 hover:opacity-90',
                    )}
                  >
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-mono text-ui font-bold tracking-[-0.01em] text-strong"
                          data-numeric
                        >
                          v{release.version}
                        </span>
                        <DeviceTypeBadge type={release.deviceType} />
                        {release.isArchived ? (
                          <Badge className="bg-idle-100 font-mono text-[10px] tracking-[0.06em] text-idle-600 uppercase ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10">
                            Arxiv
                          </Badge>
                        ) : null}
                      </div>
                    </Td>
                    {/*
                        ⚠️ TUR MANBAI: «belgidan» — `.bin` ichidagi modul
                        belgisi; «qo'lda» — belgisiz eski fayl, turni
                        yuklovchi tanlagan (adashish ehtimoli bor) —
                        shuning uchun «qo'lda» OGOHLANTIRISH rangida.
                      */}
                    <Td className="text-meta">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-semibold ring-1 ring-inset',
                          release.typeSource === 'manual'
                            ? 'bg-warn-50 text-warn-700 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25'
                            : 'bg-[var(--surface-sunken)] text-muted ring-[var(--border-subtle)]',
                        )}
                      >
                        {release.typeSource === 'manual' ? (
                          <AlertTriangle className="size-3" />
                        ) : (
                          <Lock className="size-3" />
                        )}
                        {TYPE_SOURCE_LABEL[release.typeSource]}
                      </span>
                      {release.markerPrefix ? (
                        <code className="mt-1 block font-mono text-[10.5px] text-faint">
                          {release.markerPrefix}_FW_VERSION
                        </code>
                      ) : null}
                    </Td>
                    <Td
                      align="right"
                      className="font-mono text-meta whitespace-nowrap text-ink"
                    >
                      {formatBytes(release.size)}
                    </Td>
                    {/*
                        ⚠️ SHA-256 ning faqat BOSHI ko'rsatiladi: to'liq
                        64 belgi jadvalni buzadi (`title` da to'lig'i bor).
                      */}
                    <td
                      className="px-3 py-2.5 align-middle"
                      title={release.sha256}
                    >
                      <code className="rounded-[5px] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted ring-1 ring-[var(--border-subtle)] ring-inset">
                        {release.sha256.slice(0, 16)}…
                      </code>
                    </td>
                    <Td className="text-meta whitespace-nowrap text-muted">
                      <span className="font-mono text-[11.5px] text-ink">
                        {formatDateTimeUz(release.createdAt)}
                      </span>
                      {release.uploadedBy ? (
                        <span className="block text-micro text-faint">
                          {release.uploadedBy}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="max-w-[220px] text-meta text-muted">
                      {release.note ?? '—'}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {canRollout && !release.isArchived ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            /*
                             * ⚠️ Faqat SHU turdagi faol tarqatish to'sadi:
                             * kotyol tarqatishi xona relizini kuttirmaydi.
                             */
                            disabled={Boolean(blockingRollout)}
                            title={
                              blockingRollout
                                ? `Avval ${DEVICE_TYPE_META[release.deviceType].plural.toLowerCase()} uchun faol tarqatishni to‘xtatish kerak`
                                : undefined
                            }
                            onClick={() => setRolloutFor(release)}
                          >
                            <Rocket className="size-4" />
                            Tarqatish
                          </Button>
                        ) : null}
                        {canUpload && !release.isArchived ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `v${release.version} arxivlanadi va boshqa tarqatilmaydi. Davom etilsinmi?`,
                                )
                              ) {
                                archiveMutation.mutate(release.id);
                              }
                            }}
                          >
                            Arxivlash
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ───────── Tarqatish tarixi ───────── */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<Rocket className="size-4" />}
          eyebrow="Tarix"
          title="Tarqatishlar"
        />
        {(rollouts.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Tarqatish bo‘lmagan"
            description="Reliz yuklanganidan keyin «Tarqatish» tugmasi bilan boshlanadi."
          />
        ) : (
          <ul className="flex flex-col">
            {rollouts.data?.map((rollout, index) => {
              const meta = ROLLOUT_STATUS[rollout.status];
              const live = rollout.status === 'active';
              return (
                <li
                  key={rollout.id}
                  className="reveal"
                  style={{ '--i': Math.min(index, 12) } as CSSProperties}
                >
                  {index > 0 ? <div className="h-px bg-line" /> : null}
                  <div
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-[background-color,box-shadow] duration-200 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.02]',
                      live
                        ? 'shadow-[inset_3px_0_0_var(--color-brand-500)]'
                        : rollout.status === 'paused'
                          ? 'shadow-[inset_3px_0_0_var(--color-warn-400)]'
                          : 'hover:shadow-[inset_3px_0_0_var(--border-strong)]',
                    )}
                  >
                    <div className="min-w-[200px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-mono text-ui font-bold tracking-[-0.01em] text-strong"
                          data-numeric
                        >
                          v{rollout.version}
                        </span>
                        <DeviceTypeBadge type={rollout.deviceType} />
                        <Badge className={meta.chip} dot={meta.dot}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-meta text-muted">
                        {TARGET_LABELS[rollout.targetType]}
                        {rollout.targetType !== 'all' ? (
                          <span className="ml-1 font-mono text-[11px] text-ink">
                            ({formatNumber(rollout.targetIds.length)})
                          </span>
                        ) : null}
                        {' · bosqich: '}
                        <span className="font-semibold text-strong">
                          {stageLabel(rollout.maxDevices)}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-faint">
                        Boshlandi: {formatDateTimeUz(rollout.createdAt)}
                        {rollout.finishedAt
                          ? ` · Yakunlandi: ${formatDateTimeUz(rollout.finishedAt)}`
                          : ''}
                      </p>
                      {rollout.note ? (
                        <p className="mt-1 text-micro text-muted">
                          {rollout.note}
                        </p>
                      ) : null}
                    </div>

                    <StageTrack
                      maxDevices={rollout.maxDevices}
                      live={live}
                      className={cn(
                        'hidden md:flex',
                        (rollout.status === 'cancelled' ||
                          rollout.status === 'done') &&
                          'opacity-60',
                      )}
                    />

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setProgressFor(rollout)}
                      >
                        <Activity className="size-3.5" />
                        Jarayon
                      </Button>
                      {rolloutControls(rollout)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ───────── Bloklar ───────── */}
      {(blocks.data?.length ?? 0) > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader
            icon={<ShieldAlert className="size-4" />}
            eyebrow="Himoya"
            title="Bloklangan versiyalar"
            subtitle="Qurilma versiyani qaytargan yoki ketma-ket 3 marta xato bergan — u boshqa taklif qilinmaydi."
          />
          <ul className="flex flex-col">
            {blocks.data?.map((block, index) => (
              <li
                key={block.id}
                className="reveal"
                style={{ '--i': Math.min(index, 12) } as CSSProperties}
              >
                {index > 0 ? <div className="h-px bg-line" /> : null}
                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-[background-color] duration-200 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.02]',
                    block.isBlocked
                      ? 'shadow-[inset_3px_0_0_var(--color-danger-500)]'
                      : 'shadow-[inset_3px_0_0_var(--color-warn-400)]',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-tile ring-1 ring-inset',
                        block.isBlocked
                          ? 'bg-danger-50 text-danger-600 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30'
                          : 'bg-warn-50 text-warn-600 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
                      )}
                    >
                      {block.isBlocked ? (
                        <Ban className="size-4" strokeWidth={2} />
                      ) : (
                        <ShieldAlert className="size-4" strokeWidth={2} />
                      )}
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-1.5 font-mono text-ui font-semibold text-strong">
                        {block.deviceId}
                        <span className="text-faint" aria-hidden>
                          →
                        </span>
                        <span className="text-muted" data-numeric>
                          v{block.version}
                        </span>
                      </p>
                      <p className="text-meta text-muted">
                        <span
                          className={cn(
                            'font-semibold',
                            block.isBlocked
                              ? 'text-danger-600 dark:text-danger-300'
                              : 'text-warn-700 dark:text-warn-300',
                          )}
                        >
                          {block.isBlocked ? 'Bloklangan' : 'Kuzatilmoqda'}
                        </span>{' '}
                        ·{' '}
                        <span className="font-mono text-[11px]">
                          {block.failCount} ta xato
                        </span>
                        {block.reason ? ` · ${block.reason}` : ''}
                      </p>
                    </div>
                  </div>

                  {canRollout ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={
                        unblockMutation.isPending &&
                        unblockMutation.variables === block.id
                      }
                      onClick={() => unblockMutation.mutate(block.id)}
                    >
                      <RotateCcw className="size-4" />
                      Qayta urinish
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          void queryClient.invalidateQueries({ queryKey: qk.releases });
        }}
      />

      <RolloutModal
        release={rolloutFor}
        onClose={() => setRolloutFor(null)}
        onDone={() => {
          setRolloutFor(null);
          void queryClient.invalidateQueries({ queryKey: qk.rollouts });
        }}
      />

      <ProgressModal
        rollout={progressFor}
        onClose={() => setProgressFor(null)}
      />
    </div>
  );
}

/* ═══════════════════════ Yuklash ═══════════════════════ */

/**
 * PROSHIVKA YUKLASH.
 *
 * ⚠️⚠️ Fayl tanlanishi bilan server uni TEKSHIRADI (`inspect`, saqlamaydi):
 * versiya, prefiks va belgidagi tur oldindan ko'rinadi. Belgisi bor
 * faylda tur QULFLANADI (belgiga zid tur server tomonidan rad etiladi);
 * belgisiz eski faylda tur qo'lda tanlanishi SHART (taklif oldindan
 * tanlangan). Xato bo'lsa yuklash to'siladi — yaroqsiz fayl serverga
 * yuborilmaydi.
 */
function UploadModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  /** Oxirgi tanlangan fayl — kech kelgan tekshiruv javobini tashlash uchun. */
  const latestFile = useRef<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<FirmwareInspection | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [note, setNote] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType | ''>('');

  const reset = (): void => {
    latestFile.current = null;
    setFile(null);
    setInspection(null);
    setLocalError(null);
    setVersion('');
    setNote('');
    setDeviceType('');
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    if (open) reset();
  }, [open]);

  const inspectMutation = useMutation({
    mutationFn: (picked: File) => {
      const form = new FormData();
      form.append('file', picked);
      return postForm<FirmwareInspection>(API.firmware.inspect, form);
    },
    onSuccess: (result, picked) => {
      if (latestFile.current !== picked) return;
      setInspection(result);
      setDeviceType(
        result.needsManualType
          ? (result.suggestedType ?? '')
          : (result.markedType ?? ''),
      );
    },
    onError: (error, picked) => {
      if (latestFile.current !== picked) return;
      setLocalError(errorMessage(error, 'Faylni tekshirib bo‘lmadi'));
    },
  });

  const onPick = (picked: File | null): void => {
    latestFile.current = picked;
    setFile(picked);
    setInspection(null);
    setLocalError(null);
    setDeviceType('');
    if (!picked) return;
    /*
     * ⚠️ Hajm BRAUZERDA ham tekshiriladi: katta faylni yuborib, serverdan
     * 413 kutish foydalanuvchining internetini behuda sarflardi.
     */
    if (picked.size > MAX_BIN_BYTES) {
      setLocalError(
        `Fayl juda katta: ${formatBytes(picked.size)}. OTA bo‘limi ${formatBytes(MAX_BIN_BYTES)}`,
      );
      return;
    }
    inspectMutation.mutate(picked);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Fayl tanlanmagan');
      if (!inspection) throw new Error('Fayl hali tekshirilmadi');
      if (!deviceType) throw new Error('Qurilma turini tanlang');

      const form = new FormData();
      form.append('file', file);
      if (version.trim()) form.append('version', version.trim());
      if (note.trim()) form.append('note', note.trim());
      // ⚠️ Tur faqat belgisiz faylda yuboriladi — belgilisida u fayldan.
      if (inspection.needsManualType) form.append('deviceType', deviceType);

      /*
       * ⚠️ `postForm()` — `FormData` ni JSON'ga aylantirmaydi va
       * `boundary` li sarlavhani brauzerga qo'ydiradi (`client.ts` izohi).
       */
      return postForm<FirmwareRelease>(API.firmware.releases, form);
    },
    onSuccess: (release) => {
      toast.success(
        `v${release.version} — ${DEVICE_TYPE_META[release.deviceType].label.toLowerCase()} yuklandi (${formatBytes(release.size)})`,
      );
      reset();
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const blockingError = localError ?? inspection?.error ?? null;
  const canUpload =
    Boolean(file) &&
    Boolean(inspection) &&
    !blockingError &&
    Boolean(deviceType) &&
    !inspectMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proshivka yuklash"
      description="Versiya va qurilma turi fayl ichidagi belgidan o‘qiladi (ANDIJON_FW_VERSION, ANDIJON_FW_MODULE)."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={uploadMutation.isPending}
            disabled={!canUpload}
            onClick={() => uploadMutation.mutate()}
          >
            Yuklash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Fayl (.bin)"
          hint="pio run natijasi: .pio/build/esp32dev/firmware.bin"
        >
          {(id) => (
            /*
             * ⚠️ Asl `<input type="file">` O'SHA — faqat ko'rinmas
             * (`sr-only`) va katta yorliq-maydon ichida: yorliqqa bosish
             * brauzerning o'z tanlash oynasini ochadi, Tab bilan fokus ham
             * input'ning o'ziga tushadi (halqa `focus-within` bilan).
             * Sudrab tashlash (drag & drop) ATAYLAB qo'shilmadi — xatti-
             * harakat o'zgarmasin.
             */
            <label
              className={cn(
                'group relative flex cursor-pointer items-center gap-3.5 overflow-hidden rounded-card border px-4 py-4 transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-brand-500',
                file
                  ? blockingError
                    ? 'border-danger-300 bg-danger-50/60 dark:border-danger-400/40 dark:bg-danger-500/[0.08]'
                    : 'border-brand-300 bg-brand-50/50 dark:border-brand-400/35 dark:bg-brand-400/[0.07]'
                  : 'border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] hover:border-brand-400 hover:bg-[var(--surface-muted)]',
              )}
            >
              <span
                aria-hidden
                className="grid-bg pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(90deg,transparent_30%,#000)]"
              />
              <span
                className={cn(
                  'relative grid size-11 shrink-0 place-items-center rounded-tile transition-transform duration-300 ease-out-expo group-hover:-translate-y-0.5',
                  file
                    ? 'bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]'
                    : 'bg-[var(--surface)] text-muted shadow-[var(--shadow-card)]',
                )}
              >
                <FileUp className="size-5" />
              </span>
              <span className="relative min-w-0 flex-1">
                {file ? (
                  <>
                    <span className="block truncate font-mono text-ui font-semibold text-strong">
                      {file.name}
                    </span>
                    <span className="block font-mono text-[11px] text-muted">
                      {formatBytes(file.size)} / {formatBytes(MAX_BIN_BYTES)} ·
                      boshqasini tanlash uchun bosing
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-ui font-semibold text-strong">
                      .bin faylni tanlang
                    </span>
                    <span className="block font-mono text-[11px] text-muted">
                      firmware.bin · ≤ {formatBytes(MAX_BIN_BYTES)}
                    </span>
                  </>
                )}
              </span>
              <input
                id={id}
                ref={fileRef}
                name="file"
                type="file"
                accept=".bin,application/octet-stream"
                onChange={(event) => onPick(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          )}
        </Field>

        {/* ⚠️ Tekshiruv va yuklash davomida — noaniq TERMAL chiziq: server
            foiz qaytarmaydi, «necha foiz» deb yolg'on raqam ko'rsatilmaydi. */}
        {inspectMutation.isPending || uploadMutation.isPending ? (
          <div role="status" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">
                {uploadMutation.isPending
                  ? 'Serverga yuklanmoqda'
                  : 'Fayl tekshirilmoqda'}
                …
              </span>
              <span className="font-mono text-[10.5px] text-faint">
                {file ? formatBytes(file.size) : ''}
              </span>
            </div>
            <span className="relative block h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <span className="loader-run thermal-line absolute inset-y-0 left-0 w-1/2 rounded-full" />
            </span>
          </div>
        ) : null}

        {inspectMutation.isPending ? (
          <Skeleton className="h-24 rounded-card" />
        ) : inspection ? (
          <div className="reveal relative overflow-hidden rounded-card bg-[var(--surface-sunken)] ring-1 ring-[var(--border-subtle)] ring-inset">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2">
              <span className="label-eyebrow">Fayl tekshiruvi</span>
              {inspection.error ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold text-danger-600 dark:text-danger-300">
                  <XCircle className="size-3.5" />
                  rad etildi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold text-ok-600 dark:text-ok-300">
                  <CheckCircle2 className="size-3.5" />
                  yaroqli
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-3.5 py-3 text-meta">
              <div>
                <dt className="label-eyebrow">Aniqlangan versiya</dt>
                <dd
                  className="mt-0.5 font-mono text-[17px] leading-tight font-bold text-strong"
                  data-numeric
                >
                  {inspection.version ? `v${inspection.version}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="label-eyebrow">Prefiks</dt>
                <dd className="mt-1 font-mono text-micro font-semibold break-all text-strong">
                  {inspection.prefix ? `${inspection.prefix}_FW_VERSION` : '—'}
                </dd>
              </div>
              <div>
                <dt className="label-eyebrow">Belgidagi tur</dt>
                <dd className="mt-1 font-medium text-strong">
                  {inspection.markedType ? (
                    <DeviceTypeBadge type={inspection.markedType} />
                  ) : (
                    <span className="text-warn-700 dark:text-warn-300">
                      belgi yo‘q (eski fayl)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="label-eyebrow">Hajm · SHA-256</dt>
                <dd
                  className="mt-1 font-mono text-micro text-strong"
                  title={inspection.sha256}
                >
                  {formatBytes(inspection.size)} ·{' '}
                  <span className="text-muted">
                    {inspection.sha256.slice(0, 12)}…
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {blockingError ? (
          <p
            role="alert"
            className="reveal flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 shadow-[inset_3px_0_0_var(--color-danger-500)] ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {blockingError}
          </p>
        ) : null}

        {inspection && !inspection.error ? (
          <Field
            label="Qurilma turi"
            required
            hint={
              inspection.needsManualType
                ? 'Faylda modul belgisi yo‘q — turni tanlang (taklif oldindan tanlangan). Xato tur boshqa modulni buzadi.'
                : 'Fayl ichidagi belgidan — o‘zgartirib bo‘lmaydi'
            }
          >
            {(id) =>
              inspection.needsManualType ? (
                <Select
                  id={id}
                  value={deviceType}
                  onChange={(event) =>
                    setDeviceType(event.target.value as DeviceType | '')
                  }
                >
                  <option value="">Tanlang…</option>
                  {DEVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DEVICE_TYPE_META[type].label}
                      {inspection.suggestedType === type ? ' (taklif)' : ''}
                    </option>
                  ))}
                </Select>
              ) : (
                <div
                  id={id}
                  className="flex h-9.5 items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 text-ui text-strong ring-1 ring-[var(--border-subtle)] ring-inset"
                >
                  <Lock className="size-3.5 text-faint" aria-hidden />
                  {deviceType ? <DeviceTypeBadge type={deviceType} /> : '—'}
                  <span className="label-eyebrow ml-auto">qulflangan</span>
                </div>
              )
            }
          </Field>
        ) : null}

        <Field
          label="Versiya (ixtiyoriy)"
          hint="Kiritilsa, fayl ichidagisi bilan solishtiriladi — mos kelmasa rad etiladi"
        >
          {(id) => (
            <Input
              id={id}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder={inspection?.version ?? '2.1.0'}
              className="font-mono font-semibold"
            />
          )}
        </Field>

        <Field label="Izoh">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Obratka datchigi o‘qilmasligi tuzatildi"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* ═══════════════════════ Tarqatish ═══════════════════════ */

function RolloutModal({
  release,
  onClose,
  onDone,
}: {
  release: FirmwareRelease | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = release !== null;
  const [targetType, setTargetType] = useState<RolloutTargetType>('devices');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  /*
   * ⚠️⚠️ SINOV BOSQICHI SUKUT BO'YICHA (1 qurilma — `maxDevices` umuman
   * yuborilmaydi, server 1 qo'yadi). «Hammaga» faqat bosqichma-bosqich:
   * yaroqsiz reliz butun viloyatni bir zumda qaytish halqasiga solmasin.
   */
  const [stage, setStage] = useState<'1' | '10' | '50'>('1');
  const [note, setNote] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const debouncedDeviceSearch = useDebounce(deviceSearch.trim(), 350);

  useEffect(() => {
    if (!open) return;
    setTargetType('devices');
    setTargetIds([]);
    setStage('1');
    setNote('');
    setDeviceSearch('');
  }, [open, release?.id]);

  const districts = useDistricts(open && targetType === 'districts');
  /*
   * ⚠️ Obyekt turlari KATALOGDAN olinadi, qo'lda yozilmaydi: UUID qo'lda
   * kiritilganda bitta belgi xatosi tarqatishni jimgina HECH KIMGA
   * tegmaydigan qilib qo'yardi.
   */
  const objectTypes = useObjectTypes(open && targetType === 'object_types');

  /*
   * ⚠️ Qurilmalar FAQAT relizning turida: boshqa turdagi qurilma server
   * tomonidan rad etiladi — ro'yxatda ko'rsatish xatoga yetaklardi.
   */
  const devices = useQuery({
    queryKey: qk.devices({
      purpose: 'rollout',
      deviceType: release?.deviceType,
      search: debouncedDeviceSearch,
    }),
    queryFn: () =>
      getPaged<DeviceRow>(API.devices.list, {
        params: {
          deviceType: release?.deviceType,
          isActive: true,
          limit: 100,
          ...(debouncedDeviceSearch ? { search: debouncedDeviceSearch } : {}),
        },
      }),
    enabled: open && targetType === 'devices',
  });

  const mutation = useMutation({
    mutationFn: () =>
      post<{ id: string; targetCount: number }>(API.firmware.rollouts, {
        releaseId: release?.id,
        targetType,
        targetIds: targetType === 'all' ? [] : targetIds,
        // ⚠️ 1 — yuborilmaydi (server sukuti: sinov).
        ...(stage === '1' ? {} : { maxDevices: Number(stage) }),
        note: note.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        stage === '1'
          ? `Sinov boshlandi — 1 qurilma (maqsadda ${result.targetCount} ta)`
          : `Tarqatish boshlandi — bir vaqtda ${stage} qurilma (maqsadda ${result.targetCount} ta)`,
      );
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const options: Array<{ id: string; label: string; sub?: string }> =
    targetType === 'districts'
      ? (districts.data ?? []).map((item) => ({
          id: item.id,
          label: item.name,
        }))
      : targetType === 'object_types'
        ? (objectTypes.data ?? []).map((item) => ({
            id: item.id,
            label: item.name,
          }))
        : targetType === 'devices'
          ? (devices.data?.items ?? []).map((item) => ({
              id: item.id,
              label: item.deviceId,
              sub: [
                item.location.institution?.name,
                item.location.district?.shortName,
                item.firmwareVersion ? `v${item.firmwareVersion}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }))
          : [];
  const loading =
    (targetType === 'districts' && districts.isLoading) ||
    (targetType === 'object_types' && objectTypes.isLoading) ||
    (targetType === 'devices' && devices.isFetching);

  const needsList = targetType !== 'all';
  const typeMeta = release ? DEVICE_TYPE_META[release.deviceType] : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={release ? `v${release.version} ni tarqatish` : 'Tarqatish'}
      description="Qurilmalar 30 daqiqa ichida yangilanishni oladi."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={needsList && targetIds.length === 0}
            onClick={() => mutation.mutate()}
          >
            Boshlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/*
          ⚠️ Reliz faqat O'Z turidagi qurilmalarga boradi — «Barcha
          qurilmalar» ham shu tur ichida. Buni aniq aytish kerak, aks holda
          administrator boshqa tur ham yangilanadi deb o'ylardi.
        */}
        {typeMeta && release ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-meta text-ink shadow-[inset_3px_0_0_var(--color-brand-500)] ring-1 ring-[var(--border-subtle)] ring-inset">
            <span className="font-mono text-ui font-bold text-strong">
              v{release.version}
            </span>
            <DeviceTypeBadge type={release.deviceType} />
            <span className="min-w-0">
              Faqat <strong>{typeMeta.plural.toLowerCase()}</strong>ga boradi —
              boshqa turdagi qurilmalarga tegmaydi.
            </span>
          </div>
        ) : null}

        <Field label="Kimga">
          {(id) => (
            <Select
              id={id}
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as RolloutTargetType);
                setTargetIds([]);
              }}
            >
              <option value="devices">Tanlangan qurilmalar</option>
              <option value="districts">Tanlangan tumanlar</option>
              <option value="object_types">Obyekt turi bo‘yicha</option>
              <option value="all">
                {typeMeta
                  ? `Barcha ${typeMeta.plural.toLowerCase()}`
                  : 'Hammasi'}
              </option>
            </Select>
          )}
        </Field>

        {needsList ? (
          <Field
            label={
              targetType === 'districts'
                ? 'Tumanlar'
                : targetType === 'object_types'
                  ? 'Obyekt turlari'
                  : 'Qurilmalar'
            }
            hint={
              targetIds.length > 0
                ? `${formatNumber(targetIds.length)} ta tanlandi`
                : undefined
            }
          >
            {() => (
              <div className="flex flex-col gap-1.5">
                {targetType === 'devices' ? (
                  <Input
                    value={deviceSearch}
                    onChange={(event) => setDeviceSearch(event.target.value)}
                    placeholder="Identifikator, muassasa yoki lot…"
                    leading={<Search className="size-4" />}
                    aria-label="Qurilma qidirish"
                  />
                ) : null}
                <div className="relative flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-[var(--surface-sunken)] p-1.5 ring-1 ring-[var(--border-subtle)] ring-inset">
                  {/* Yuklanayotganda — tepada ingichka termal yugurik. */}
                  {loading && options.length > 0 ? (
                    <span className="pointer-events-none sticky top-0 z-10 -mx-1.5 -mt-1.5 mb-1 block h-[2px] overflow-hidden">
                      <span className="loader-run thermal-line absolute inset-y-0 left-0 w-1/2" />
                    </span>
                  ) : null}
                  {options.map((option) => {
                    const checked = targetIds.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-meta transition-[background-color,box-shadow] duration-150',
                          checked
                            ? 'bg-[var(--surface)] text-strong shadow-[inset_2px_0_0_var(--color-brand-500),var(--shadow-hair)] dark:bg-brand-400/[0.08]'
                            : 'text-ink hover:bg-[var(--surface)] dark:hover:bg-white/[0.04]',
                        )}
                      >
                        <input
                          type="checkbox"
                          /* a11y: har bir maydonda `name` bo'lishi kerak. */
                          name="rolloutTarget"
                          value={option.id}
                          className="mt-0.5 size-3.5 accent-brand-600"
                          checked={checked}
                          onChange={(event) =>
                            setTargetIds((prev) =>
                              event.target.checked
                                ? [...prev, option.id]
                                : prev.filter((item) => item !== option.id),
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block',
                              checked && 'font-semibold',
                              targetType === 'devices' && 'font-mono',
                            )}
                          >
                            {option.label}
                          </span>
                          {option.sub ? (
                            <span className="block truncate text-micro text-faint">
                              {option.sub}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                  {options.length === 0 ? (
                    <p className="label-eyebrow px-2 py-3 text-center">
                      {loading ? 'Yuklanmoqda…' : 'Topilmadi'}
                    </p>
                  ) : null}
                </div>
                {targetType === 'devices' &&
                (devices.data?.meta.total ?? 0) >
                  (devices.data?.items.length ?? 0) ? (
                  <p className="text-micro text-warn-700 dark:text-warn-300">
                    Jami {formatNumber(devices.data?.meta.total)} ta — birinchi{' '}
                    {devices.data?.items.length} tasi ko‘rsatilmoqda. Qidiruvni
                    aniqlashtiring.
                  </p>
                ) : null}
              </div>
            )}
          </Field>
        ) : null}

        {/*
          ⚠️⚠️ BOSQICH — eng muhim tanlov. Matn nima bo'lishini ANIQ
          aytadi: «bir vaqtda 1 ta qurilma». Keyingi bosqichlar
          «Tarqatishlar» ro'yxatidagi «Keyingi bosqich» tugmasi bilan.
        */}
        <Field
          label="Boshlang‘ich bosqich"
          hint="Keyin «Keyingi bosqich» bilan 1 → 10 → 50 → hammasi"
        >
          {(id) => (
            <div className="flex flex-col gap-2">
              <Select
                id={id}
                value={stage}
                onChange={(event) =>
                  setStage(event.target.value as '1' | '10' | '50')
                }
              >
                <option value="1">Sinov — 1 ta qurilma (tavsiya)</option>
                <option value="10">Bir vaqtda 10 ta qurilma</option>
                <option value="50">Bir vaqtda 50 ta qurilma</option>
              </Select>
              {/* Tanlov KO'RINISHI — qaysi pog'onadan boshlanadi. */}
              <StageTrack maxDevices={Number(stage)} className="px-0.5" />
            </div>
          )}
        </Field>

        <Field label="Izoh">
          {(id) => (
            <Input
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Jalaquduq tumanida sinov"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* ═══════════════════════ Jarayon ═══════════════════════ */

function ProgressModal({
  rollout,
  onClose,
}: {
  rollout: FirmwareRollout | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: qk.rolloutProgress(rollout?.id ?? ''),
    queryFn: () =>
      get<RolloutProgress>(API.firmware.rolloutProgress(rollout?.id ?? '')),
    enabled: rollout !== null,
    /* ⚠️ Faol tarqatishda jarayon o'zgarib turadi. */
    refetchInterval: rollout?.status === 'active' ? 15_000 : false,
  });

  const data = query.data;

  return (
    <Modal
      open={rollout !== null}
      onClose={onClose}
      title={rollout ? `v${rollout.version} — jarayon` : 'Jarayon'}
      description={
        data
          ? `${formatNumber(data.total)} ta qurilma maqsadda${
              rollout ? ` · bosqich: ${stageLabel(rollout.maxDevices)}` : ''
            }`
          : undefined
      }
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      {query.isLoading ? (
        <Skeleton className="h-48" />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : !data ? null : (
        <div className="flex flex-col gap-3">
          {/*
            ⚠️ Umumiy chiziq — faqat «Tasdiqlandi» (qurilma yangi versiyada
            qayta ulangan) ulushi. «O'rnatildi» hali muvaffaqiyat EMAS:
            qurilma qaytishi mumkin, shuning uchun u chiziqqa qo'shilmaydi.
          */}
          <div className="rounded-card bg-[var(--surface-sunken)] px-3.5 py-3 ring-1 ring-[var(--border-subtle)] ring-inset">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label-eyebrow">Tasdiqlangan</span>
              <span className="flex items-baseline gap-1 font-mono">
                <AnimatedNumber
                  value={formatNumber(data.counts.ok ?? 0)}
                  className="text-[20px] leading-none font-bold text-strong"
                />
                <span className="text-meta text-faint">
                  / {formatNumber(data.total)}
                </span>
              </span>
            </div>
            <span
              role="progressbar"
              aria-label="Tasdiqlangan qurilmalar ulushi"
              aria-valuemin={0}
              aria-valuemax={data.total}
              aria-valuenow={data.counts.ok ?? 0}
              className="relative mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--surface)] dark:bg-white/[0.06]"
            >
              <span
                className={cn(
                  'absolute inset-0 origin-left rounded-full transition-transform duration-700 ease-out-expo',
                  data.status === 'done' ? 'bg-ok-500' : 'thermal-line',
                )}
                style={{
                  transform: `scaleX(${
                    data.total > 0
                      ? Math.min((data.counts.ok ?? 0) / data.total, 1)
                      : 0
                  })`,
                }}
              />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(data.counts)
              .filter(([, count]) => count > 0)
              .map(([state, count], index) => {
                const meta = otaStatusMeta(state);
                return (
                  <span
                    key={state}
                    style={{ '--i': index } as CSSProperties}
                    className={cn(
                      'reveal inline-flex items-baseline gap-2 rounded-md px-2.5 py-1.5 text-micro font-semibold ring-1 ring-current/15 ring-inset',
                      meta.chip,
                    )}
                  >
                    {meta.label}
                    <span className="font-mono text-ui font-bold tabular-nums">
                      {formatNumber(count)}
                    </span>
                  </span>
                );
              })}
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-lg ring-1 ring-[var(--border-subtle)] ring-inset">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] shadow-[inset_0_-1px_0_var(--border-subtle)]">
                <tr className="th-mono text-muted">
                  <th className="px-3 py-2">Qurilma</th>
                  <th className="px-3 py-2">Holat</th>
                  <th className="px-3 py-2">Vaqt</th>
                  <th className="px-3 py-2">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device) => {
                  const meta = otaStatusMeta(device.state);
                  return (
                    <tr
                      key={device.deviceId}
                      className="border-t border-[var(--border-cell)] transition-colors duration-150 first:border-t-0 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-3 py-2 font-mono text-meta font-semibold text-strong">
                        {device.deviceId}
                        {device.name ? (
                          <span className="block font-sans text-micro font-normal text-faint">
                            {device.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-micro font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset',
                            meta.chip,
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-muted">
                        {device.at ? formatDateTimeUz(device.at) : '—'}
                      </td>
                      <td className="max-w-[240px] px-3 py-2 text-micro text-muted">
                        {device.message ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(data.counts.pending ?? 0) > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-micro text-muted ring-1 ring-[var(--border-subtle)] ring-inset">
              <CircleOff className="mt-0.5 size-3.5 shrink-0" />
              <span>
                «Kutilmoqda» — qurilma hali so‘ramagan yoki bosqich chegarasi
                to‘lgan. Tekshiruv har 30 daqiqada bo‘ladi, shuning uchun to‘liq
                yangilanish 30 daqiqadan ko‘proq vaqt olishi normal.
              </span>
            </p>
          ) : null}

          {data.status === 'done' ? (
            <p className="reveal flex items-center gap-2 rounded-lg bg-ok-50 px-3 py-2 text-micro font-semibold text-ok-700 shadow-[inset_3px_0_0_var(--color-ok-500)] ring-1 ring-ok-200 ring-inset dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25">
              <CheckCircle2 className="size-4 shrink-0" />
              Barcha maqsadli qurilmalar yangilandi.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
