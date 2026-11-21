import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CircleHelp,
  Copy,
  RotateCcw,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DeviceType,
  PendingDevice,
  RegisterPendingResult,
} from '@/shared/api/types';
import {
  DEVICE_TYPES,
  DEVICE_TYPE_META,
  TOKEN_KIND_LABEL,
} from '@/shared/constants/device-type';
import {
  useDistrictCatalog,
  useDistricts,
} from '@/shared/hooks/useCatalogOptions';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Modal,
  Select,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz, formatRelativeUz } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import type { IssuedKey } from './ApiKeyModal';

const TOKEN_SOURCE_LABEL: Record<RegisterPendingResult['tokenSource'], string> =
  {
    adopted: 'qurilma tokeni qabul qilindi — plata o‘zgarishsiz ishlaydi',
    shared: 'umumiy token bilan ishlaydi',
    provided: 'kiritilgan kalit saqlandi',
  };

/**
 * «YANGI QURILMALAR» PANELI.
 *
 * ⚠️⚠️ NIMA UCHUN RO'YXAT TEPASIDA. Montajchi platani o'rnatib, Wi-Fi'ni
 * sozlab ketadi; kabinetda esa uni ro'yxatga kiritish esdan chiqishi
 * mumkin. Qurilma har daqiqada serverga uriladi va 403 oladi — ya'ni
 * harorat YOZILMAYDI. Bu panel bo'lmasa, «nega bu bino xaritada yo'q?»
 * degan savolga javob topish uchun server loglarini qidirishga to'g'ri
 * kelardi.
 *
 * ⚠️ «Ro'yxatga olish» — BIR BOSISH (`{}`): server plata aytgan tur,
 * tuman, obyekt turi va muassasani oladi, qurilma yuborgan tokenni qabul
 * qiladi. Token ziddiyati yoki tur noma'lum bo'lsa — «Sozlab ro'yxatga
 * olish» (kalit/tur qo'lda).
 *
 * ⚠️ Panel faqat so'rov BOR bo'lganda ko'rinadi: bo'sh karta har kuni
 * joy egallab, foydalanuvchi uni ko'rishdan to'xtardi.
 */
export function PendingDevicesCard({
  onIssued,
}: {
  onIssued: (value: IssuedKey) => void;
}) {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const canRegister = can('devices.create');
  const canDismiss = can('devices.update');
  const [showDismissed, setShowDismissed] = useState(false);
  const [configuring, setConfiguring] = useState<PendingDevice | null>(null);

  /*
   * ⚠️ Rad etilganlar ham BIRGA olinadi va ajratiladi: aks holda «Rad
   * etish» bosilgan so'rovni qaytarishning yo'li qolmasdi (u ro'yxatdan
   * butunlay yo'qolardi).
   */
  const query = useQuery({
    queryKey: qk.pendingDevicesList(true),
    queryFn: () =>
      get<PendingDevice[]>(API.devices.pending, {
        params: { includeDismissed: true },
      }),
    enabled: can('devices.view'),
    /* ⚠️ Daqiqada bir: montajchi plata ulagach, administrator uni
       darhol ko'rishi kerak. */
    refetchInterval: 60_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: qk.pendingDevices });
    void queryClient.invalidateQueries({ queryKey: ['devices'] });
  };

  const handleRegistered = (result: RegisterPendingResult): void => {
    invalidate();
    if (result.apiKey) {
      onIssued({ deviceId: result.device.deviceId, apiKey: result.apiKey });
    } else {
      toast.success(
        `«${result.device.deviceId}» ro‘yxatga olindi — ${TOKEN_SOURCE_LABEL[result.tokenSource]}`,
      );
    }
  };

  const register = useMutation({
    mutationFn: (id: string) =>
      post<RegisterPendingResult>(API.devices.registerPending(id), {}),
    onSuccess: handleRegistered,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => post(API.devices.dismissPending(id)),
    onSuccess: () => {
      toast.success('So‘rov rad etildi');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restore = useMutation({
    mutationFn: (id: string) => post(API.devices.restorePending(id)),
    onSuccess: () => {
      toast.success('So‘rov ro‘yxatga qaytarildi');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const all = query.data ?? [];
  const active = all.filter((row) => !row.isDismissed);
  const dismissed = all.filter((row) => row.isDismissed);
  const rows = showDismissed ? [...active, ...dismissed] : active;

  if (active.length === 0 && dismissed.length === 0) return null;

  if (active.length === 0 && !showDismissed) {
    return (
      <div className="flex justify-end px-1">
        <button
          type="button"
          onClick={() => setShowDismissed(true)}
          className="text-micro font-medium text-muted underline-offset-2 hover:text-strong hover:underline"
        >
          Rad etilgan so‘rovlar: {dismissed.length} ta
        </button>
      </div>
    );
  }

  return (
    /* ⚠️ Chap chekkadagi sariq chiziq — «diqqat talab qiladi»: panel ro'yxat
       tepasida turadi va oddiy kartadan ko'z bir qarashda ajratishi kerak. */
    <Card className="overflow-hidden bg-warn-50/40 dark:bg-warn-400/[0.05]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-warn-400 shadow-[0_0_14px_var(--color-warn-400)]"
      />
      <CardBody className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <span className="relative grid size-9 shrink-0 place-items-center rounded-tile bg-warn-100 text-warn-700 ring-1 ring-warn-200 ring-inset dark:bg-warn-400/15 dark:text-warn-300 dark:ring-warn-400/25">
              <CircleHelp className="size-4" strokeWidth={2} />
              {/* Jonli nuqta — qurilmalar HOZIR serverga urinmoqda. */}
              {active.length > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-2.5" aria-hidden>
                  <span className="live-ping absolute inset-0 rounded-full bg-warn-400" />
                  <span className="relative size-2.5 rounded-full bg-warn-400 ring-2 ring-[var(--surface)]" />
                </span>
              ) : null}
            </span>
            <div>
              <p className="font-display text-[15.5px] leading-snug font-[720] tracking-[-0.012em] text-strong [font-stretch:106%]">
                Yangi qurilmalar
                {active.length > 0
                  ? ` — ${active.length} ta ulanishga urinmoqda`
                  : ''}
              </p>
              <p className="text-meta text-muted">
                Ular ro‘yxatda yo‘q, shuning uchun MA‘LUMOT YOZILMAYDI.
                «Ro‘yxatga olish» plata aytgan joylashuv va tokenni qabul
                qiladi.
              </p>
            </div>
          </div>
          {dismissed.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDismissed((value) => !value)}
            >
              {showDismissed
                ? 'Rad etilganlarni yashirish'
                : `Rad etilganlar (${dismissed.length})`}
            </Button>
          ) : null}
        </div>

        <ul className="flex flex-col gap-1.5">
          {rows.map((row, index) => {
            const location = [
              row.district?.name,
              row.objectType?.name,
              row.institutionName ?? row.institutionHint,
            ].filter((part): part is string => Boolean(part));
            const oneClickBlocked = row.tokenConflict || !row.deviceType;
            return (
              <li
                key={row.id}
                style={{ '--i': Math.min(index, 12) } as CSSProperties}
                className={cn(
                  'reveal flex flex-col gap-2 rounded-tile bg-[var(--surface)] px-3 py-2.5 ring-1 ring-inset',
                  'transition-[box-shadow] duration-200 hover:shadow-[var(--shadow-card)]',
                  row.isDismissed && 'opacity-60',
                  row.tokenConflict
                    ? 'ring-danger-200 dark:ring-danger-400/30'
                    : 'ring-[var(--border-subtle)]',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-meta font-medium text-strong">
                        {row.deviceId}
                      </span>
                      {row.deviceType ? (
                        <Badge
                          className={DEVICE_TYPE_META[row.deviceType].chip}
                        >
                          {DEVICE_TYPE_META[row.deviceType].label}
                        </Badge>
                      ) : (
                        <Badge className="bg-warn-50 text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25">
                          tur noma‘lum
                        </Badge>
                      )}
                      {row.isDismissed ? (
                        <Badge className="bg-[var(--surface-sunken)] text-faint ring-1 ring-[var(--border-subtle)]">
                          rad etilgan
                        </Badge>
                      ) : null}
                    </p>
                    {/*
                      ⚠️ PLATA AYTGAN joylashuv — tuman, obyekt turi,
                      muassasa. Ro'yxatga olishda shular taklif bo'ladi.
                    */}
                    <p className="text-micro text-ink">
                      {location.length > 0 ? (
                        location.join(' · ')
                      ) : (
                        <span className="text-faint">
                          Plata joylashuv aytmagan
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted tabular-nums">
                      {formatNumber(row.attempts)} marta urindi
                      {row.firmwareVersion ? ` · v${row.firmwareVersion}` : ''}
                      {row.lastIpAddress ? ` · IP ${row.lastIpAddress}` : ''}
                      {row.tokenKind
                        ? ` · token: ${TOKEN_KIND_LABEL[row.tokenKind].toLowerCase()}`
                        : ''}
                      {' · '}
                      <span title={formatDateTimeUz(row.lastSeenAt)}>
                        oxirgi: {formatRelativeUz(row.lastSeenAt)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!row.isDismissed && canRegister ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<UserPlus className="size-3.5" />}
                          loading={
                            register.isPending && register.variables === row.id
                          }
                          disabled={oneClickBlocked}
                          title={
                            row.tokenConflict
                              ? 'Token ziddiyati — «Sozlab ro‘yxatga olish» orqali kalitni kiriting'
                              : !row.deviceType
                                ? 'Tur noma‘lum — «Sozlab ro‘yxatga olish» orqali tanlang'
                                : undefined
                          }
                          onClick={() => register.mutate(row.id)}
                        >
                          Ro‘yxatga olish
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Settings2 className="size-3.5" />}
                          onClick={() => setConfiguring(row)}
                        >
                          Sozlab ro‘yxatga olish
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy className="size-3.5" />}
                      onClick={() => {
                        void navigator.clipboard.writeText(row.deviceId);
                        toast.success('Identifikator nusxalandi');
                      }}
                    >
                      Nusxa
                    </Button>
                    {canDismiss ? (
                      row.isDismissed ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<RotateCcw className="size-3.5" />}
                          loading={
                            restore.isPending && restore.variables === row.id
                          }
                          onClick={() => restore.mutate(row.id)}
                        >
                          Qaytarish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={
                            dismiss.isPending && dismiss.variables === row.id
                          }
                          onClick={() => dismiss.mutate(row.id)}
                        >
                          Rad etish
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>

                {row.tokenConflict ? (
                  <p className="flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-1.5 text-micro font-medium text-danger-700 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" />
                    Token ziddiyati: bu identifikator bilan TURLI tokenlar
                    kelgan. Bir bosishda ro‘yxatga olib bo‘lmaydi — «Sozlab
                    ro‘yxatga olish» orqali API kalitni qo‘lda kiriting.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardBody>

      <RegisterPendingModal
        row={configuring}
        onClose={() => setConfiguring(null)}
        onDone={(result) => {
          setConfiguring(null);
          handleRegistered(result);
        }}
      />
    </Card>
  );
}

/**
 * «SOZLAB RO'YXATGA OLISH» — plata aytganini ustidan yozish uchun.
 *
 * ⚠️ Faqat TANLANGAN maydonlar yuboriladi: bo'sh qolgani server tomonidan
 * plata aytgan qiymat bilan to'ldiriladi (bir bosish bilan AYNI qoida).
 */
function RegisterPendingModal({
  row,
  onClose,
  onDone,
}: {
  row: PendingDevice | null;
  onClose: () => void;
  onDone: (result: RegisterPendingResult) => void;
}) {
  const open = row !== null;
  const [deviceType, setDeviceType] = useState<DeviceType | ''>('');
  const [districtId, setDistrictId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setDeviceType(row.deviceType ?? '');
    setDistrictId(row.district?.id ?? '');
    setOrganizationId('');
    setApiKey('');
    setName('');
    setError(null);
  }, [row]);

  const districts = useDistricts(open);
  const districtKey = useMemo(
    () => districts.data?.find((item) => item.id === districtId)?.key,
    [districts.data, districtId],
  );
  const organizations = useDistrictCatalog('organizations', districtKey, open);

  const mutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error('So‘rov tanlanmagan');
      const body: Record<string, unknown> = {};
      if (deviceType) body.deviceType = deviceType;
      // ⚠️ Tuman HAR DOIM aniq yuboriladi: bo'sh — «tumansiz», `null`.
      body.districtId = districtId || null;
      if (organizationId) body.organizationId = organizationId;
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (name.trim()) body.name = name.trim();
      return post<RegisterPendingResult>(
        API.devices.registerPending(row.id),
        body,
      );
    },
    onSuccess: onDone,
    onError: (err) => setError(errorMessage(err)),
  });

  const submit = (): void => {
    if (!deviceType) {
      setError('Qurilma turini tanlang: kotyol yoki xona');
      return;
    }
    if (row?.tokenConflict && !apiKey.trim()) {
      setError('Token ziddiyati — API kalitni kiriting');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const reportedInstitution = row?.institutionName ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Sozlab ro‘yxatga olish"
      description={row ? row.deviceId : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={submit}
          >
            Ro‘yxatga olish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {row?.tokenConflict ? (
          <p className="flex items-start gap-1.5 rounded-md bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Bu identifikator bilan turli tokenlar kelgan — platadagi API kalitni
            kiriting.
          </p>
        ) : null}

        <Field
          label="Qurilma turi"
          required
          hint={
            row?.deviceType
              ? `Plata aytgan: ${DEVICE_TYPE_META[row.deviceType].label.toLowerCase()}`
              : 'Plata turini aytmagan — tanlang'
          }
        >
          {(id) => (
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
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Tuman"
            hint={
              row?.district
                ? `Plata aytgan: ${row.district.name}`
                : 'Plata tuman aytmagan'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setOrganizationId('');
                }}
              >
                <option value="">Tanlanmagan</option>
                {(districts.data ?? []).map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Muassasa"
            hint={
              !districtId
                ? 'Avval tumanni tanlang'
                : 'Tanlanmasa — plata aytgani katalogdan topiladi yoki qo‘shiladi'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={organizationId}
                disabled={!districtId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                <option value="">
                  {reportedInstitution
                    ? `Plata aytgani: «${reportedInstitution}»`
                    : 'Tanlanmagan'}
                </option>
                {(organizations.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="API kalit"
          required={row?.tokenConflict}
          hint={
            row?.tokenConflict
              ? 'Platadagi kalit — majburiy'
              : 'Bo‘sh qoldirilsa — qurilma yuborgan token qabul qilinadi'
          }
        >
          {(id) => (
            <Input
              id={id}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="91abcc3d6732ab04d017d3a30ded31b1"
              className="font-mono"
            />
          )}
        </Field>

        <Field label="Nomi" hint="Ixtiyoriy — ro‘yxatda ajratish uchun">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-meta font-medium text-danger-700 ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
