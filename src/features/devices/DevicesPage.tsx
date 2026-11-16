import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleHelp,
  Copy,
  Cpu,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  del,
  errorMessage,
  get,
  getPaged,
  patch,
  post,
} from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  Boiler,
  Device,
  DeviceWithKey,
  Paged,
  PendingDevice,
} from '@/shared/api/types';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { formatNumber, orDash } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';

/**
 * ESP32 MODULLARI.
 *
 * ⚠️⚠️ API kalit FAQAT yaratilgan yoki almashtirilgan paytda, BIR
 * MARTA ko'rsatiladi — bazada uning hash'i saqlanadi. Shuning uchun
 * kalit alohida oynada, nusxalash tugmasi bilan chiqadi va oyna
 * yopilgandan keyin uni tizimdan qayta olib bo'lmaydi. Ro'yxatda
 * faqat oxirgi 6 belgi ko'rinadi — qaysi kalit ekanini ajratish
 * uchun yetarli, ishlatish uchun emas.
 */
export function DevicesPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'offline'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [removing, setRemoving] = useState<Device | null>(null);
  const [rotating, setRotating] = useState<Device | null>(null);
  const [issuedKey, setIssuedKey] = useState<DeviceWithKey | null>(null);

  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(filter === 'unassigned' ? { unassigned: true } : {}),
      ...(filter === 'offline' ? { offline: true } : {}),
    }),
    [page, debouncedSearch, filter],
  );

  const query = useQuery({
    queryKey: qk.devices(params),
    queryFn: (): Promise<Paged<Device>> =>
      getPaged<Device>(API.devices.list, { params }),
    placeholderData: (previous) => previous,
  });

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
      setIssuedKey(result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            ESP32 modullari
          </h1>
          <p className="text-meta text-muted">
            {query.data
              ? `${formatNumber(query.data.meta.total)} ta qurilma`
              : 'Yuklanmoqda…'}
          </p>
        </div>

        {can('devices.create') ? (
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
        ) : null}
      </div>

      <PendingDevicesCard />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Qurilma identifikatori, nomi, lot raqami…"
              leading={<Search className="size-4" />}
            />
          </div>

          <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
            {(
              [
                { key: 'all', label: 'Hammasi' },
                { key: 'unassigned', label: 'Biriktirilmagan' },
                { key: 'offline', label: 'Aloqasi yo‘q' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setFilter(item.key);
                  setPage(1);
                }}
                className={
                  filter === item.key
                    ? 'rounded-full bg-[var(--surface)] px-3 py-1.5 text-micro font-semibold text-strong shadow-[var(--shadow-hair)]'
                    : 'rounded-full px-3 py-1.5 text-micro font-medium text-muted transition-colors hover:text-strong'
                }
              >
                {item.label}
              </button>
            ))}
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
                  <Th>Biriktirilgan kotyol</Th>
                  <Th>Tuman</Th>
                  <Th>Kalit</Th>
                  {/*
                    ⚠️ PROSHIVKA VERSIYASI va OTA TEKSHIRUVI — ikkisi
                    ALOHIDA ustun. «Oxirgi aloqa» telemetriya kelgan
                    vaqt; datchigi uzilgan plata esa telemetriya
                    yubormaydi, lekin OTA tekshiruvini davom ettiradi.
                    Bitta ustun bo'lsa, bunday qurilma «o'lgan» bo'lib
                    ko'rinardi — holbuki u tirik va yangilanishga tayyor.
                  */}
                  <Th>Proshivka</Th>
                  <Th align="right">Signallar</Th>
                  <Th align="right">Oxirgi aloqa</Th>
                  <Th align="right">OTA tekshiruvi</Th>
                  <Th>Holati</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((device) => {
                  const online = isOnline(device.lastSeenAt);
                  return (
                    <Tr key={device.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'grid size-7 shrink-0 place-items-center rounded-tile',
                              online
                                ? 'bg-ok-50 text-ok-600 dark:bg-ok-500/12 dark:text-ok-300'
                                : 'bg-idle-100 text-idle-500 dark:bg-white/6',
                            )}
                          >
                            {online ? (
                              <Wifi className="size-3.5" />
                            ) : (
                              <WifiOff className="size-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-strong">
                              {device.deviceId}
                            </p>
                            <p className="truncate text-micro text-muted">
                              {orDash(device.name)}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {device.boiler ? (
                          `Lot ${device.boiler.lotNumber}`
                        ) : (
                          <span className="text-faint">biriktirilmagan</span>
                        )}
                      </Td>
                      {/*
                        ⚠️ Tuman: avval PLATA yuborgani (o'zgarmas), bo'lmasa
                        kotyolniki (eski proshivka). Server taniy olmagan
                        kod ham ko'rinadi — montajchi xatosini topish uchun.
                      */}
                      <Td className="whitespace-nowrap text-muted">
                        {device.district ? (
                          <span
                            className="inline-flex items-center gap-1"
                            title="Platada tanlangan — kabinetda o‘zgartirilmaydi"
                          >
                            <Lock className="size-3 text-faint" aria-hidden />
                            {device.district.shortName}
                          </span>
                        ) : device.reportedDistrict ? (
                          <span
                            className="text-warn-700 dark:text-warn-300"
                            title="Plata yuborgan tuman kodi tizimda yo‘q — plata menyusini tekshiring"
                          >
                            noma‘lum: {device.reportedDistrict}
                          </span>
                        ) : (
                          orDash(device.boiler?.district?.shortName)
                        )}
                      </Td>
                      <Td>
                        <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-micro text-muted">
                          …{device.apiKeyPreview}
                        </code>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {device.firmwareVersion ? (
                          <span className="text-muted" data-numeric>
                            v{device.firmwareVersion}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                        {/*
                          ⚠️ UMUMIY TOKEN ALOHIDA BELGILANADI. Sukut
                          bo'yicha hamma qurilma shaxsiy tokenda
                          ishlaydi; umumiy tokenga ruxsat berilgani —
                          ONGLI, vaqtincha qaror va u ro'yxatda
                          KO'RINIB turishi kerak, aks holda «hammasi
                          shaxsiy tokenga o'tdi» deb o'ylab, o'nlab
                          qurilma eng zaif usulda qolib ketardi.
                        */}
                        {device.allowSharedToken ? (
                          <Badge className="ml-1.5 bg-warn-50 text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/14 dark:text-warn-300">
                            umumiy token
                          </Badge>
                        ) : null}
                      </Td>
                      <Td align="right" className="text-muted">
                        {formatNumber(Number(device.readingsCount))}
                      </Td>
                      <Td
                        align="right"
                        className="whitespace-nowrap text-muted"
                      >
                        {device.lastSeenAt
                          ? formatRelativeUz(device.lastSeenAt)
                          : 'hech qachon'}
                      </Td>
                      <Td
                        align="right"
                        className="whitespace-nowrap text-muted"
                      >
                        {device.lastCheckAt
                          ? formatRelativeUz(device.lastCheckAt)
                          : '—'}
                      </Td>
                      <Td>
                        {!device.isActive ? (
                          <Badge className="bg-[var(--surface-sunken)] text-faint">
                            O‘chirilgan
                          </Badge>
                        ) : online ? (
                          <Badge
                            className="bg-ok-50 text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300"
                            dot="bg-ok-500"
                          >
                            Onlayn
                          </Badge>
                        ) : (
                          <Badge
                            className="bg-idle-100 text-idle-700 ring-1 ring-idle-200 dark:bg-white/6 dark:text-idle-300"
                            dot="bg-idle-400"
                          >
                            Aloqa yo‘q
                          </Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <span className="flex items-center justify-end gap-1">
                          {can('devices.update') ? (
                            <IconButton
                              label="Tahrirlash"
                              onClick={() => {
                                setEditing(device);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </IconButton>
                          ) : null}

                          {can('devices.rotate_key') ? (
                            <IconButton
                              label="Kalitni almashtirish"
                              onClick={() => setRotating(device)}
                            >
                              <KeyRound className="size-3.5" />
                            </IconButton>
                          ) : null}

                          {can('devices.delete') ? (
                            <IconButton
                              label="O‘chirish"
                              danger
                              onClick={() => setRemoving(device)}
                            >
                              <Trash2 className="size-3.5" />
                            </IconButton>
                          ) : null}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
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
            <strong>{rotating?.deviceId}</strong> uchun yangi kalit
            generatsiya qilinadi.
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
        'grid size-7 place-items-center rounded-md text-muted transition-colors',
        danger
          ? 'hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10'
          : 'hover:bg-[var(--surface-sunken)] hover:text-strong',
      )}
    >
      {children}
    </button>
  );
}

/** Oxirgi signal 15 daqiqadan yangi bo'lsa — onlayn. */
function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 15 * 60 * 1000;
}

// ───────────────── Forma ─────────────────

function DeviceFormModal({
  open,
  onClose,
  device,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  device: Device | null;
  onIssued: (value: DeviceWithKey) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    deviceId: '',
    name: '',
    boilerId: '',
    apiKey: '',
    note: '',
  });
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(device);

  /* ⚠️ Holat oyna OCHILGANDA tiklanadi: modal DOM'da qolib, `open`
     bilan boshqariladi. Aks holda ikkinchi marta ochilganda oldingi
     qurilmaning ma'lumotlari ko'rinib turardi. */
  useEffect(() => {
    if (!open) return;
    setForm({
      deviceId: device?.deviceId ?? '',
      name: device?.name ?? '',
      boilerId: device?.boilerId ?? '',
      apiKey: '',
      note: device?.note ?? '',
    });
    setError(null);
  }, [open, device]);

  /*
   * ⚠️ FAQAT moduli yo'q kotyollar ro'yxatga olinadi: bitta kotyolga
   * ikkita modul biriktirib bo'lmaydi (baza darajasida ham taqiqlangan)
   * va band kotyolni ro'yxatda ko'rsatish foydalanuvchini xatoga
   * yetaklardi. Tahrirlashda esa JORIY kotyol ham qo'shiladi — aks
   * holda u ro'yxatdan yo'qolib, maydon bo'sh ko'rinardi.
   */
  /*
   * ⚠️⚠️ Plata tumani bor bo'lsa — FAQAT shu tumandagi kotyollar: server
   * boshqasini baribir rad etadi (modul faqat o'z tumanidagi kotyolga).
   */
  const deviceDistrictId = device?.districtId ?? null;
  const boilers = useQuery({
    queryKey: [
      'boilers',
      'without-device',
      device?.boilerId ?? null,
      deviceDistrictId,
    ],
    queryFn: async (): Promise<Boiler[]> => {
      const free = await getPaged<Boiler>(API.boilers.list, {
        params: {
          withoutDevice: true,
          limit: 200,
          ...(deviceDistrictId ? { districtIds: deviceDistrictId } : {}),
        },
      });
      if (!device?.boilerId) return free.items;
      const current = await get<Boiler>(API.boilers.one(device.boilerId));
      return [current, ...free.items];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Device | DeviceWithKey> => {
      const payload = {
        deviceId: form.deviceId.trim(),
        name: form.name.trim() || undefined,
        boilerId: form.boilerId || undefined,
        note: form.note.trim() || undefined,
        ...(device ? {} : { apiKey: form.apiKey.trim() || undefined }),
      };
      return device
        ? patch<Device>(API.devices.one(device.id), payload)
        : post<DeviceWithKey>(API.devices.list, payload);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      onClose();
      if (!device && result && 'apiKey' in result) {
        onIssued(result);
      } else {
        toast.success('Qurilma yangilandi');
      }
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const handleSubmit = (): void => {
    if (!form.deviceId.trim()) {
      setError('Qurilma identifikatori kiritilmagan');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modulni tahrirlash' : 'Yangi ESP32 moduli'}
      description={
        isEdit
          ? device?.deviceId
          : 'Proshivkadagi DEVICE_ID va (mavjud bo‘lsa) API kalitni kiriting'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={mutation.isPending}
          >
            {isEdit ? 'Saqlash' : 'Qo‘shish'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Qurilma identifikatori (DEVICE_ID)"
          required
          hint="Proshivkadagi qiymat bilan AYNAN bir xil bo‘lishi kerak"
        >
          {(id) => (
            <Input
              id={id}
              value={form.deviceId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deviceId: event.target.value }))
              }
              placeholder="modul1"
              className="font-mono"
            />
          )}
        </Field>

        <Field label="Nomi" hint="Ro‘yxatda ajratish uchun">
          {(id) => (
            <Input
              id={id}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="1-maktab qozonxonasi moduli"
            />
          )}
        </Field>

        {isEdit && device ? (
          <dl className="grid grid-cols-1 gap-2 rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5 text-meta sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1 text-micro text-muted">
                <Lock className="size-3" aria-hidden />
                Tuman (platadan)
              </dt>
              <dd className="font-medium text-strong">
                {device.district?.name ??
                  (device.reportedDistrict
                    ? `noma‘lum kod: ${device.reportedDistrict}`
                    : 'plata yubormagan (eski proshivka)')}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">
                Montajchi yozgan muassasa
              </dt>
              <dd className="font-medium text-strong">
                {orDash(device.institutionHint)}
              </dd>
            </div>
            {/*
              ⚠️ Nima uchun o'zgartirib bo'lmasligi YOZILADI: aks holda
              admin «tahrirlash tugmasi yo'q — xato» deb o'ylardi.
            */}
            <p className="text-micro text-faint sm:col-span-2">
              Tuman platada tanlanadi va bu yerda o‘zgartirilmaydi — modul
              faqat shu tumandagi kotyolga ulanadi. Haqiqiy muassasa —
              quyida tanlangan kotyolniki; montajchi yozgani faqat eslatma.
            </p>
          </dl>
        ) : null}

        <Field
          label="Biriktirilgan kotyol"
          hint={
            deviceDistrictId
              ? 'Faqat modul tumanidagi kotyollar ko‘rsatiladi'
              : 'Biriktirilmagan qurilmadan kelgan signal ham saqlanadi'
          }
        >
          {(id) => (
            <Select
              id={id}
              value={form.boilerId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, boilerId: event.target.value }))
              }
            >
              <option value="">Biriktirilmagan</option>
              {(boilers.data ?? []).map((boiler) => (
                <option key={boiler.id} value={boiler.id}>
                  Lot {boiler.lotNumber}
                  {boiler.organization?.name
                    ? ` — ${boiler.organization.name}`
                    : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {!isEdit ? (
          <Field
            label="Mavjud API kalit"
            hint="Bo‘sh qoldirilsa — tizim yangi kalit generatsiya qiladi"
          >
            {(id) => (
              <Input
                id={id}
                value={form.apiKey}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, apiKey: event.target.value }))
                }
                placeholder="91abcc3d6732ab04d017d3a30ded31b1"
                className="font-mono"
              />
            )}
          </Field>
        ) : null}

        <Field label="Izoh">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.note}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          )}
        </Field>

        {error ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * API KALIT OYNASI.
 *
 * ⚠️ Kalit BIR MARTA ko'rsatiladi va oyna yopilgandan keyin uni
 * tizimdan qayta olib bo'lmaydi (bazada faqat hash bor). Shuning
 * uchun oyna aniq ogohlantiradi va nusxalash tugmasi beradi — aks
 * holda foydalanuvchi uni oddiy xabar deb yopib yuborardi.
 */
function ApiKeyModal({
  value,
  onClose,
}: {
  value: DeviceWithKey | null;
  onClose: () => void;
}) {
  const copy = async (): Promise<void> => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.apiKey);
      toast.success('Kalit nusxalandi');
    } catch {
      toast.error('Nusxalab bo‘lmadi — kalitni qo‘lda belgilang');
    }
  };

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title="API kalit yaratildi"
      description="Bu kalit BOSHQA ko‘rsatilmaydi — proshivkaga darhol ko‘chiring"
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          Nusxaladim, yopish
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-warn-50 px-3 py-2.5 text-meta text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/10 dark:text-warn-300 dark:ring-warn-400/25">
          Tizim kalitning faqat hash‘ini saqlaydi. Oyna yopilgandan so‘ng uni
          qayta ko‘rish imkoni bo‘lmaydi — faqat yangisini generatsiya qilish
          mumkin.
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-sunken)] p-2.5">
          <code className="flex-1 overflow-x-auto font-mono text-ui text-strong">
            {value?.apiKey}
          </code>
          <Button
            size="sm"
            variant="secondary"
            icon={<Copy className="size-3.5" />}
            onClick={() => void copy()}
          >
            Nusxalash
          </Button>
        </div>

        <div>
          <p className="label-eyebrow mb-1.5">Proshivkaga qo‘yiladigan kod</p>
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-3 font-mono text-micro leading-relaxed text-neutral-100">
            {`const char* DEVICE_ID = "${value?.device.deviceId}";
const char* API_URL   = "http://<server>:3000/api/data";
const char* API_KEY   = "${value?.apiKey}";`}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

/**
 * «YANGI QURILMA SO'RAYAPTI» PANELI.
 *
 * ⚠️⚠️ NIMA UCHUN RO'YXAT TEPASIDA. Montajchi platani qozonxonaga
 * o'rnatib, Wi-Fi'ni sozlab ketadi; kabinetda esa uni ro'yxatga
 * kiritish esdan chiqishi mumkin. Qurilma har daqiqada serverga
 * uriladi va 403 oladi — ya'ni harorat YOZILMAYDI. Bu panel
 * bo'lmasa, «nega bu bino xaritada yo'q?» degan savolga javob
 * topish uchun server loglarini qidirishga to'g'ri kelardi.
 *
 * ⚠️ Panel faqat so'rov BOR bo'lganda ko'rinadi: bo'sh karta har
 * kuni joy egallab, foydalanuvchi uni ko'rishdan to'xtardi va
 * haqiqiy so'rov kelganda ham e'tibor bermasdi.
 */
function PendingDevicesCard() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);

  const query = useQuery({
    queryKey: qk.pendingDevices,
    queryFn: () => get<PendingDevice[]>(API.devices.pending),
    enabled: can('devices.view'),
    /* ⚠️ Daqiqada bir: dala ishida montajchi plata ulagach,
       administrator uni darhol ko'rishi kerak. */
    refetchInterval: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => post(API.devices.dismissPending(id)),
    onSuccess: () => {
      toast.success('So‘rov rad etildi');
      void queryClient.invalidateQueries({ queryKey: qk.pendingDevices });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = query.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="border-warn-200 bg-warn-50/40 dark:border-warn-400/20 dark:bg-warn-400/5">
      <CardBody className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-warn-100 text-warn-700 dark:bg-warn-400/15 dark:text-warn-300">
            <CircleHelp className="size-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-ui font-semibold text-strong">
              {rows.length} ta notanish qurilma ulanishga urinmoqda
            </p>
            <p className="text-meta text-muted">
              Ular ro‘yxatda yo‘q, shuning uchun MA‘LUMOT YOZILMAYDI.
              Qurilmani «Yangi modul» bilan qo‘shsangiz, so‘rov o‘z-o‘zidan
              yopiladi.
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-meta font-medium text-strong">
                  {row.deviceId}
                </p>
                <p className="text-micro text-muted">
                  {row.attempts} marta urindi
                  {row.institutionHint ? ` · ${row.institutionHint}` : ''}
                  {row.firmwareVersion ? ` · v${row.firmwareVersion}` : ''}
                  {row.lastIpAddress ? ` · ${row.lastIpAddress}` : ''}
                  {' · '}
                  {formatRelativeUz(row.lastSeenAt)}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(row.deviceId);
                    toast.success('Identifikator nusxalandi');
                  }}
                >
                  <Copy className="size-3.5" />
                  Nusxa
                </Button>
                {can('devices.update') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={dismiss.isPending}
                    onClick={() => dismiss.mutate(row.id)}
                  >
                    Rad etish
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
