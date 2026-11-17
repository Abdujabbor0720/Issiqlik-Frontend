import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  CircleOff,
  Cpu,
  FileUp,
  PauseCircle,
  PlayCircle,
  Rocket,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
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
  CatalogItem,
  DistrictOption,
  FirmwareBlock,
  FirmwareRelease,
  FirmwareRollout,
  ModuleType,
  RolloutProgress,
  RolloutStatus,
  RolloutTargetType,
} from '@/shared/api/types';
import { MODULE_TYPE_META } from '@/shared/constants/module-type';
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

/**
 * TARQATISH JARAYONIDAGI HOLATLAR.
 *
 * ⚠️ `pending` — «hali tegmagan» va u ENG MUHIM ustun: «nechta
 * qurilma hali yangilanmagan» degan savolga javob beradi. Uni
 * ro'yxatdan tushirib qoldirish tarqatishni tugaganday ko'rsatardi.
 */
const STATE_LABELS: Record<string, { label: string; chip: string }> = {
  pending: {
    label: 'Kutilmoqda',
    chip: 'bg-[var(--surface-sunken)] text-muted',
  },
  offered: {
    label: 'Taklif qilindi',
    chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300',
  },
  installed: {
    label: 'O‘rnatildi',
    chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-300',
  },
  ok: {
    label: 'Tasdiqlandi',
    chip: 'bg-ok-50 text-ok-700 dark:bg-ok-500/12 dark:text-ok-300',
  },
  failed: {
    label: 'Xato',
    chip: 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
  },
  rolled_back: {
    label: 'Qaytarildi',
    chip: 'bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-300',
  },
};

/**
 * Reliz/tarqatish qaysi modul uchun — `.bin` ichidagi belgidan.
 * ⚠️ Eski javobda maydon bo'lmasa qozonxona (avval faqat shu tur bor edi).
 */
function ModuleTypeBadge({ type }: { type: ModuleType | undefined }) {
  const key = type ?? 'boiler';
  return (
    <Badge
      className={
        key === 'room'
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300'
          : 'bg-[var(--surface-sunken)] text-muted ring-1 ring-[var(--border-subtle)]'
      }
    >
      {MODULE_TYPE_META[key].label}
    </Badge>
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
 *   • sinov rejimi (1 qurilma) SUKUT BO'YICHA tanlangan;
 *   • tarqatish boshlangach nechta qurilmaga tegishi aytiladi;
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
   * ⚠️ HAR MODUL TURI uchun bittadan faol tarqatish (qozonxona va xona
   * modullari mustaqil yangilanadi) — shuning uchun ro'yxat.
   */
  const activeRollouts = useMemo(
    () => rollouts.data?.filter((item) => item.status === 'active') ?? [],
    [rollouts.data],
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RolloutStatus }) =>
      patch(API.firmware.rolloutStatus(id), { status }),
    onSuccess: () => {
      toast.success('Tarqatish holati o‘zgardi');
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
        ⚠️⚠️ FAOL TARQATISH ENG TEPADA va ajralib turadi. Tarqatish
        davom etayotganini administrator DARHOL ko'rishi kerak: aks
        holda u yangi reliz yuklab, ikkinchi tarqatishni boshlashga
        urinib, «nega ishlamayapti» degan savolga tushardi (bir vaqtda
        faqat bitta faol tarqatish bo'lishi mumkin).
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
                  <ModuleTypeBadge type={activeRollout.moduleType} />
                </p>
                <p className="text-meta text-muted">
                  {TARGET_LABELS[activeRollout.targetType]}
                  {activeRollout.maxDevices
                    ? ` · sinov rejimi: ${activeRollout.maxDevices} qurilma`
                    : ''}
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
              {canRollout ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: activeRollout.id,
                        status: 'paused',
                      })
                    }
                  >
                    <PauseCircle className="size-4" />
                    To‘xtatish
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Tarqatish BEKOR qilinadi va qayta davom ettirilmaydi. Davom etilsinmi?',
                        )
                      ) {
                        statusMutation.mutate({
                          id: activeRollout.id,
                          status: 'cancelled',
                        });
                      }
                    }}
                  >
                    <XCircle className="size-4" />
                    Bekor qilish
                  </Button>
                </>
              ) : null}
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
            description="«.bin» faylni yuklang — versiya va modul turi fayl ichidagi XONOBOD_FW_VERSION (qozonxona) yoki XONA_FW_VERSION (xona) belgisidan avtomatik o‘qiladi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-micro font-medium text-muted">
                  <th className="px-5 py-2.5">Versiya</th>
                  <th className="px-5 py-2.5">Hajm</th>
                  <th className="px-5 py-2.5">SHA-256</th>
                  <th className="px-5 py-2.5">Yuklandi</th>
                  <th className="px-5 py-2.5">Izoh</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {releases.data?.map((release) => (
                  <tr
                    key={release.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-ui font-semibold text-strong"
                          data-numeric
                        >
                          v{release.version}
                        </span>
                        <ModuleTypeBadge type={release.moduleType} />
                        {release.isArchived ? (
                          <Badge className="bg-[var(--surface-sunken)] text-muted">
                            Arxiv
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-meta text-muted" data-numeric>
                      {formatBytes(release.size)}
                    </td>
                    {/*
                      ⚠️ SHA-256 ning faqat BOSHI ko'rsatiladi: to'liq
                      64 belgi jadvalni buzadi, lekin boshi ham
                      «qaysi fayl» degan savolga javob berish uchun
                      yetarli (`title` da to'lig'i bor).
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
                             * qozonxona tarqatishi xona relizini kuttirmaydi.
                             */
                            disabled={activeRollouts.some(
                              (item) => item.moduleType === release.moduleType,
                            )}
                            title={
                              activeRollouts.some(
                                (item) =>
                                  item.moduleType === release.moduleType,
                              )
                                ? `Avval ${MODULE_TYPE_META[release.moduleType].plural.toLowerCase()} uchun faol tarqatishni to‘xtatish kerak`
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
                ))}
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
                        <ModuleTypeBadge type={rollout.moduleType} />
                        <Badge className={meta.chip} dot={meta.dot}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {TARGET_LABELS[rollout.targetType]}
                        {rollout.maxDevices
                          ? ` · sinov: ${rollout.maxDevices}`
                          : ''}
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
                      {canRollout && rollout.status === 'paused' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            statusMutation.mutate({
                              id: rollout.id,
                              status: 'active',
                            })
                          }
                        >
                          <PlayCircle className="size-4" />
                          Davom etish
                        </Button>
                      ) : null}
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
                      loading={unblockMutation.isPending}
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
  const [version, setVersion] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Fayl tanlanmagan');

      /*
       * ⚠️ Hajm BROUZERDA ham tekshiriladi: 500 MB lik faylni
       * yuborib, serverdan 413 kutish foydalanuvchining internetini
       * behuda sarflardi (dala sharoitida bu muhim).
       */
      if (file.size > MAX_BIN_BYTES) {
        throw new Error(
          `Fayl juda katta: ${formatBytes(file.size)}. ` +
            `OTA bo‘limi ${formatBytes(MAX_BIN_BYTES)}`,
        );
      }

      const form = new FormData();
      form.append('file', file);
      if (version.trim()) form.append('version', version.trim());
      if (note.trim()) form.append('note', note.trim());

      /*
       * ⚠️ `postForm()` — `FormData` ni JSON'ga aylantirmaydi va
       * `boundary` li sarlavhani brauzerga qo'ydiradi (`client.ts` izohi).
       */
      return postForm<FirmwareRelease>(API.firmware.releases, form);
    },
    onSuccess: (release) => {
      toast.success(
        `v${release.version} yuklandi (${formatBytes(release.size)})`,
      );
      setVersion('');
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proshivka yuklash"
      description="Versiya va modul turi fayl ichidagi belgidan o‘qiladi: XONOBOD_FW_VERSION — qozonxona moduli, XONA_FW_VERSION — xona moduli."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
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
              className="block w-full cursor-pointer rounded-md border border-line bg-[var(--surface)] px-3 py-2 text-meta text-ink file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-micro file:font-medium file:text-brand-700 dark:file:bg-brand-500/12 dark:file:text-brand-300"
            />
          )}
        </Field>

        <Field
          label="Versiya (ixtiyoriy)"
          hint="Kiritilsa, fayl ichidagisi bilan solishtiriladi — mos kelmasa rad etiladi"
        >
          {(id) => (
            <Input
              id={id}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="2.0.1"
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
  const [targetType, setTargetType] = useState<RolloutTargetType>('devices');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  /*
   * ⚠️⚠️ SINOV REJIMI SUKUT BO'YICHA YOQILGAN (1 qurilma).
   * «Hammaga tarqat» ONGLI harakat bo'lishi kerak: yaroqsiz reliz
   * butun viloyatni bir zumda qaytish halqasiga soladi va buni
   * tuzatish uchun har bir qozonxonaga borish kerak bo'lardi.
   */
  const [canary, setCanary] = useState(true);
  const [note, setNote] = useState('');

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    enabled: release !== null && targetType === 'districts',
  });

  /*
   * WARN: Obyekt turlari KATALOGDAN olinadi, qo'lda yozilmaydi.
   * Ilgari bu yerda UUID ni qo'lda kiritish kerak edi -- administrator
   * uni boshqa sahifadan nusxalab kelishi va adashmasligi kerak
   * bo'lardi. Bitta belgi xato bo'lsa, tarqatish jimgina HECH KIMGA
   * tegmasdan "ishlayotgan" bo'lib turardi.
   */
  const objectTypes = useQuery({
    queryKey: qk.catalog('object-types', { forRollout: true }),
    queryFn: () =>
      getPaged<CatalogItem>(API.catalogs.list('object-types'), {
        params: { limit: 200 },
      }),
    enabled: release !== null && targetType === 'object_types',
  });

  const mutation = useMutation({
    mutationFn: () =>
      post<{ id: string; targetCount: number }>(API.firmware.rollouts, {
        releaseId: release?.id,
        targetType,
        targetIds: targetType === 'all' ? [] : targetIds,
        maxDevices: canary ? 1 : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        canary
          ? `Sinov boshlandi — 1 qurilma (maqsadda ${result.targetCount} ta)`
          : `Tarqatish boshlandi — ${result.targetCount} qurilma`,
      );
      setTargetIds([]);
      setNote('');
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const options =
    targetType === 'districts'
      ? (districts.data ?? []).map((item) => ({
          id: item.id,
          label: item.name,
        }))
      : targetType === 'object_types'
        ? (objectTypes.data?.items ?? []).map((item) => ({
            id: item.id,
            label: item.name,
          }))
        : [];

  const needsList = targetType === 'districts' || targetType === 'object_types';
  // WARN: Faqat qurilmalar UUID bilan tanlanadi -- ularning ro'yxati
  //       yuzlab qator bo'lishi mumkin va bu oynaga sig'masdi.
  const needsIds = targetType === 'devices';

  return (
    <Modal
      open={release !== null}
      onClose={onClose}
      title={release ? `v${release.version} ni tarqatish` : 'Tarqatish'}
      /*
       * ⚠️ Reliz faqat O'Z turidagi modullarga boradi — «Barcha qurilmalar»
       * ham shu tur ichida. Buni oynada aniq aytish kerak, aks holda
       * administrator «hammasi» deb tanlab, xona modullari ham yangilanadi
       * deb o'ylardi.
       */
      description={
        release
          ? `Faqat ${MODULE_TYPE_META[release.moduleType ?? 'boiler'].plural.toLowerCase()}ga boradi. Qurilmalar 30 daqiqa ichida yangilanishni oladi.`
          : 'Qurilmalar 30 daqiqa ichida yangilanishni oladi.'
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={(needsList || needsIds) && targetIds.length === 0}
            onClick={() => mutation.mutate()}
          >
            Boshlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
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
              <option value="all">Barcha qurilmalar</option>
            </Select>
          )}
        </Field>

        {needsIds ? (
          <Field
            label="Qurilma identifikatorlari (UUID)"
            hint="Vergul bilan ajratiladi. UUID «ESP32 modullari» sahifasidan olinadi; qurilmalar relizning turiga mos bo‘lishi kerak."
          >
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={targetIds.join(', ')}
                onChange={(event) =>
                  setTargetIds(
                    event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="a81663fb-8cf1-4956-8cb0-e421b0621c26"
              />
            )}
          </Field>
        ) : null}

        {needsList ? (
          <Field
            label={targetType === 'districts' ? 'Tumanlar' : 'Obyekt turlari'}
          >
            {() => (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-line p-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-meta text-ink hover:bg-[var(--surface-sunken)]"
                  >
                    <input
                      type="checkbox"
                      /* a11y: har bir maydonda `name` bo'lishi kerak. */
                      name="rolloutTarget"
                      value={option.id}
                      checked={targetIds.includes(option.id)}
                      onChange={(event) =>
                        setTargetIds((prev) =>
                          event.target.checked
                            ? [...prev, option.id]
                            : prev.filter((item) => item !== option.id),
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
                {options.length === 0 ? (
                  <p className="px-2 py-1 text-micro text-faint">
                    Yuklanmoqda…
                  </p>
                ) : null}
              </div>
            )}
          </Field>
        ) : null}

        {/*
          ⚠️⚠️ SINOV REJIMI — eng muhim belgi. Matn nima bo'lishini
          ANIQ aytadi: «faqat 1 ta qurilma». Mavhum «sinov rejimi»
          yozuvi foydalanuvchiga nima bo'layotganini tushuntirmasdi.
        */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-[var(--surface-sunken)] p-3">
          <input
            type="checkbox"
            id="rolloutCanary"
            name="rolloutCanary"
            checked={canary}
            onChange={(event) => setCanary(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-meta font-medium text-strong">
              Avval faqat 1 ta qurilmada sinab ko‘rish
            </span>
            <span className="block text-micro text-muted">
              Yangilanish birinchi so‘ragan bitta qurilmaga beriladi. U
              tasdiqlangandan keyin belgini olib, tarqatishni davom ettirasiz.
            </span>
          </span>
        </label>

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
        data ? `${formatNumber(data.total)} ta qurilma maqsadda` : undefined
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
                const meta = STATE_LABELS[state] ?? {
                  label: state,
                  chip: 'bg-[var(--surface-sunken)] text-muted',
                };
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
                  const meta = STATE_LABELS[device.state] ?? {
                    label: device.state,
                    chip: 'bg-[var(--surface-sunken)] text-muted',
                  };
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
                «Kutilmoqda» — qurilma hali so‘ramagan. Tekshiruv har 30
                daqiqada bo‘ladi, shuning uchun to‘liq yangilanish 30 daqiqadan
                ko‘proq vaqt olishi normal.
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
