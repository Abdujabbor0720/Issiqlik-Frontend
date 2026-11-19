import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronsRight,
  CircleOff,
  Cpu,
  FileUp,
  Lock,
  PauseCircle,
  PlayCircle,
  Rocket,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  Select,
  Skeleton,
  Textarea,
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
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300',
    dot: 'bg-brand-500',
  },
  paused: {
    label: 'To‘xtatilgan',
    chip: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/14 dark:text-warn-300',
    dot: 'bg-warn-500',
  },
  done: {
    label: 'Tugadi',
    chip: 'bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300',
    dot: 'bg-ok-500',
  },
  cancelled: {
    label: 'Bekor qilingan',
    chip: 'bg-[var(--surface-sunken)] text-muted',
    dot: 'bg-slate-400',
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
  return <Badge className={meta.chip}>{meta.label}</Badge>;
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
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Proshivka va masofadan yangilash
          </h1>
          <p className="text-meta text-muted">
            {releases.data
              ? `${formatNumber(releases.data.length)} ta reliz`
              : 'Yuklanmoqda…'}
            {blockedCount > 0 ? ` · ${blockedCount} ta blok` : ''}
          </p>
        </div>

        {canUpload ? (
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <FileUp className="size-4" />
            Proshivka yuklash
          </Button>
        ) : null}
      </div>

      {/*
        ⚠️⚠️ FAOL TARQATISH ENG TEPADA va ajralib turadi. Administrator
        uni DARHOL ko'rishi kerak: har qurilma turi uchun bir vaqtda faqat
        bitta faol tarqatish bo'lishi mumkin.
      */}
      {activeRollouts.map((activeRollout) => (
        <Card
          key={activeRollout.id}
          className="border-brand-200 bg-brand-50/40 dark:border-brand-500/20 dark:bg-brand-500/5"
        >
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <Rocket className="size-4" strokeWidth={2} />
              </span>
              <div>
                <p className="flex flex-wrap items-center gap-2 text-ui font-semibold text-strong">
                  v{activeRollout.version} tarqatilmoqda
                  <DeviceTypeBadge type={activeRollout.deviceType} />
                </p>
                <p className="text-meta text-muted">
                  {TARGET_LABELS[activeRollout.targetType]}
                  {' · bosqich: '}
                  <strong className="font-semibold text-strong">
                    {stageLabel(activeRollout.maxDevices)}
                  </strong>
                  {' · '}
                  {formatRelativeUz(activeRollout.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setProgressFor(activeRollout)}
              >
                Jarayonni ko‘rish
              </Button>
              {rolloutControls(activeRollout)}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* ───────── Relizlar ───────── */}
      <Card className="overflow-hidden">
        <CardHeader title="Yuklangan relizlar" />
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-line text-micro font-medium text-muted">
                  <th className="px-5 py-2.5">Versiya</th>
                  <th className="px-5 py-2.5">Tur manbai</th>
                  <th className="px-5 py-2.5">Hajm</th>
                  <th className="px-5 py-2.5">SHA-256</th>
                  <th className="px-5 py-2.5">Yuklandi</th>
                  <th className="px-5 py-2.5">Izoh</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {releases.data?.map((release) => {
                  const blockingRollout = activeRollouts.find(
                    (item) => item.deviceType === release.deviceType,
                  );
                  return (
                    <tr
                      key={release.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-ui font-semibold text-strong"
                            data-numeric
                          >
                            v{release.version}
                          </span>
                          <DeviceTypeBadge type={release.deviceType} />
                          {release.isArchived ? (
                            <Badge className="bg-[var(--surface-sunken)] text-muted">
                              Arxiv
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      {/*
                        ⚠️ TUR MANBAI: «belgidan» — `.bin` ichidagi modul
                        belgisi; «qo'lda» — belgisiz eski fayl, turni
                        yuklovchi tanlagan (adashish ehtimoli bor).
                      */}
                      <td className="px-5 py-3 text-meta">
                        <span
                          className={
                            release.typeSource === 'manual'
                              ? 'font-medium text-warn-700 dark:text-warn-300'
                              : 'text-muted'
                          }
                        >
                          {TYPE_SOURCE_LABEL[release.typeSource]}
                        </span>
                        {release.markerPrefix ? (
                          <code className="mt-0.5 block font-mono text-micro text-faint">
                            {release.markerPrefix}_FW_VERSION
                          </code>
                        ) : null}
                      </td>
                      <td
                        className="px-5 py-3 text-meta text-muted"
                        data-numeric
                      >
                        {formatBytes(release.size)}
                      </td>
                      {/*
                        ⚠️ SHA-256 ning faqat BOSHI ko'rsatiladi: to'liq
                        64 belgi jadvalni buzadi (`title` da to'lig'i bor).
                      */}
                      <td
                        className="px-5 py-3 font-mono text-micro text-faint"
                        title={release.sha256}
                      >
                        {release.sha256.slice(0, 16)}…
                      </td>
                      <td className="px-5 py-3 text-meta text-muted">
                        {formatDateTimeUz(release.createdAt)}
                        {release.uploadedBy ? (
                          <span className="block text-micro text-faint">
                            {release.uploadedBy}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[220px] px-5 py-3 text-meta text-muted">
                        {release.note ?? '—'}
                      </td>
                      <td className="px-5 py-3">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ───────── Tarqatish tarixi ───────── */}
      <Card className="overflow-hidden">
        <CardHeader title="Tarqatishlar" />
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
              return (
                <li key={rollout.id}>
                  {index > 0 ? <div className="h-px bg-line" /> : null}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-[200px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-ui font-semibold text-strong"
                          data-numeric
                        >
                          v{rollout.version}
                        </span>
                        <DeviceTypeBadge type={rollout.deviceType} />
                        <Badge className={meta.chip} dot={meta.dot}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {TARGET_LABELS[rollout.targetType]}
                        {rollout.targetType !== 'all'
                          ? ` (${formatNumber(rollout.targetIds.length)})`
                          : ''}
                        {' · bosqich: '}
                        <span className="font-medium text-strong">
                          {stageLabel(rollout.maxDevices)}
                        </span>
                      </p>
                      <p className="text-micro text-faint">
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

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setProgressFor(rollout)}
                      >
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
            title="Bloklangan versiyalar"
            subtitle="Qurilma versiyani qaytargan yoki ketma-ket 3 marta xato bergan — u boshqa taklif qilinmaydi."
          />
          <ul className="flex flex-col">
            {blocks.data?.map((block, index) => (
              <li key={block.id}>
                {index > 0 ? <div className="h-px bg-line" /> : null}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-tile',
                        block.isBlocked
                          ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/12 dark:text-danger-300'
                          : 'bg-warn-50 text-warn-600 dark:bg-warn-400/14 dark:text-warn-300',
                      )}
                    >
                      {block.isBlocked ? (
                        <Ban className="size-4" strokeWidth={2} />
                      ) : (
                        <ShieldAlert className="size-4" strokeWidth={2} />
                      )}
                    </span>
                    <div>
                      <p className="text-ui font-medium text-strong">
                        {block.deviceId}{' '}
                        <span className="text-muted" data-numeric>
                          → v{block.version}
                        </span>
                      </p>
                      <p className="text-meta text-muted">
                        {block.isBlocked ? 'Bloklangan' : 'Kuzatilmoqda'} ·{' '}
                        {block.failCount} ta xato
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
            <input
              id={id}
              ref={fileRef}
              name="file"
              type="file"
              accept=".bin,application/octet-stream"
              onChange={(event) => onPick(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-md border border-line bg-[var(--surface)] px-3 py-2 text-meta text-ink file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-micro file:font-medium file:text-brand-700 dark:file:bg-brand-500/12 dark:file:text-brand-300"
            />
          )}
        </Field>

        {inspectMutation.isPending ? (
          <Skeleton className="h-20" />
        ) : inspection ? (
          <dl className="grid grid-cols-2 gap-2 rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5 text-meta">
            <div>
              <dt className="text-micro text-muted">Aniqlangan versiya</dt>
              <dd className="font-medium text-strong" data-numeric>
                {inspection.version ? `v${inspection.version}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">Prefiks</dt>
              <dd className="font-mono text-micro font-medium text-strong">
                {inspection.prefix ? `${inspection.prefix}_FW_VERSION` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">Belgidagi tur</dt>
              <dd className="font-medium text-strong">
                {inspection.markedType
                  ? DEVICE_TYPE_META[inspection.markedType].label
                  : 'belgi yo‘q (eski fayl)'}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">Hajm · SHA-256</dt>
              <dd
                className="font-mono text-micro text-strong"
                title={inspection.sha256}
              >
                {formatBytes(inspection.size)} ·{' '}
                {inspection.sha256.slice(0, 12)}…
              </dd>
            </div>
          </dl>
        ) : null}

        {blockingError ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
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
                  className="flex h-9.5 items-center gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 text-ui text-strong"
                >
                  <Lock className="size-3.5 text-faint" aria-hidden />
                  {deviceType ? DEVICE_TYPE_META[deviceType].label : '—'}
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
          <div className="flex items-center gap-2 rounded-md bg-[var(--surface-sunken)] px-3 py-2 text-meta text-ink">
            <DeviceTypeBadge type={release.deviceType} />
            <span>
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
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-line p-2">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-meta text-ink hover:bg-[var(--surface-sunken)]"
                    >
                      <input
                        type="checkbox"
                        /* a11y: har bir maydonda `name` bo'lishi kerak. */
                        name="rolloutTarget"
                        value={option.id}
                        className="mt-0.5"
                        checked={targetIds.includes(option.id)}
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
                  ))}
                  {options.length === 0 ? (
                    <p className="px-2 py-1 text-micro text-faint">
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
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.counts)
              .filter(([, count]) => count > 0)
              .map(([state, count]) => {
                const meta = otaStatusMeta(state);
                return (
                  <span
                    key={state}
                    className={cn(
                      'rounded-full px-3 py-1 text-micro font-medium',
                      meta.chip,
                    )}
                  >
                    {meta.label}: {count}
                  </span>
                );
              })}
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-line">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-line text-micro font-medium text-muted">
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
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-3 py-2 text-meta text-strong">
                        {device.deviceId}
                        {device.name ? (
                          <span className="block text-micro text-faint">
                            {device.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-micro font-medium',
                            meta.chip,
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-micro text-muted">
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
            <p className="flex items-start gap-2 rounded-md bg-[var(--surface-sunken)] px-3 py-2 text-micro text-muted">
              <CircleOff className="mt-0.5 size-3.5 shrink-0" />
              <span>
                «Kutilmoqda» — qurilma hali so‘ramagan yoki bosqich chegarasi
                to‘lgan. Tekshiruv har 30 daqiqada bo‘ladi, shuning uchun to‘liq
                yangilanish 30 daqiqadan ko‘proq vaqt olishi normal.
              </span>
            </p>
          ) : null}

          {data.status === 'done' ? (
            <p className="flex items-center gap-2 rounded-md bg-ok-50 px-3 py-2 text-micro text-ok-700 dark:bg-ok-500/10 dark:text-ok-300">
              <CheckCircle2 className="size-4 shrink-0" />
              Barcha maqsadli qurilmalar yangilandi.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
