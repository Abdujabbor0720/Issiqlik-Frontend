import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, getPaged, patch, post } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type {
  Boiler,
  DeviceRow,
  DeviceType,
  DeviceWithKey,
} from '@/shared/api/types';
import { DEVICE_TYPES, DEVICE_TYPE_META } from '@/shared/constants/device-type';
import {
  useDistrictCatalog,
  useDistricts,
} from '@/shared/hooks/useCatalogOptions';
import { Button, Field, Input, Modal, Select, Textarea } from '@/shared/ui';
import { lotLabel } from '@/shared/utils/boiler';
import { orDash } from '@/shared/utils/format';
import type { IssuedKey } from './ApiKeyModal';

interface FormState {
  deviceId: string;
  name: string;
  deviceType: DeviceType;
  districtId: string;
  organizationId: string;
  boilerId: string;
  apiKey: string;
  note: string;
}

/**
 * QURILMA FORMASI — yaratish va tahrirlash.
 *
 * ⚠️ Tuman va muassasa — PANELDAGI qiymat (qurilmaning o'zi). Qurilma
 * kotyolga ulangan bo'lsa, AMALDAGI joylashuv kotyoldan olinadi va bu
 * maydonlar faqat zaxira. Muassasa tumanga tegishli: ro'yxat tanlangan
 * tuman KALITI bo'yicha so'raladi va tuman o'zgarsa tanlov tozalanadi.
 */
export function DeviceFormModal({
  open,
  onClose,
  device,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  device: DeviceRow | null;
  onIssued: (value: IssuedKey) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    deviceId: '',
    name: '',
    deviceType: 'kotyol',
    districtId: '',
    organizationId: '',
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
      deviceType: device?.deviceType ?? 'kotyol',
      districtId: device?.districtId ?? '',
      organizationId: device?.organizationId ?? '',
      boilerId: device?.boilerId ?? '',
      apiKey: '',
      note: device?.note ?? '',
    });
    setError(null);
  }, [open, device]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const districts = useDistricts(open);
  const selectedDistrict =
    districts.data?.find((item) => item.id === form.districtId) ?? null;

  const organizations = useDistrictCatalog(
    'organizations',
    selectedDistrict?.key,
    open,
  );
  /*
   * ⚠️ Joriy muassasa ro'yxatda bo'lmasa ham (arxivlangan yoki 200 dan
   * keyin) tanlov sifatida qoladi — aks holda maydon bo'sh ko'rinib,
   * saqlashda muassasa jimgina olib tashlanardi.
   */
  const organizationOptions = useMemo(() => {
    const items = (organizations.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
    }));
    const current =
      device?.organizationId &&
      device.organizationId === form.organizationId &&
      device.location.source === 'device' &&
      device.location.institution
        ? device.location.institution
        : null;
    if (current && !items.some((item) => item.id === current.id)) {
      items.unshift({ id: current.id, name: current.name });
    }
    return items;
  }, [organizations.data, device, form.organizationId]);

  /*
   * ⚠️ KOTYOL moduli uchun FAQAT kotyol modulisiz kotyollar: bitta
   * kotyolga ikkita kotyol moduli biriktirib bo'lmaydi (bazada ham
   * taqiqlangan). XONA moduli esa kotyol moduli bor binoga ham ulanadi
   * (har modul alohida xona) — unga filtr qo'llanmaydi. Tahrirlashda
   * JORIY kotyol ham qo'shiladi — aks holda maydon bo'sh ko'rinardi.
   */
  const isRoomModule = form.deviceType === 'xona';
  const boilers = useQuery({
    queryKey: [
      'boilers',
      'device-form',
      isRoomModule ? 'any' : 'without-device',
      device?.boilerId ?? null,
      form.districtId || null,
    ],
    queryFn: async (): Promise<Boiler[]> => {
      const list = await getPaged<Boiler>(API.boilers.list, {
        params: {
          ...(isRoomModule ? {} : { withoutDevice: true }),
          limit: 200,
          ...(form.districtId ? { districtIds: form.districtId } : {}),
        },
      });
      if (
        !device?.boilerId ||
        list.items.some((item) => item.id === device.boilerId)
      ) {
        return list.items;
      }
      const current = await get<Boiler>(API.boilers.one(device.boilerId));
      return [current, ...list.items];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<DeviceRow | DeviceWithKey> => {
      if (device) {
        const payload: Record<string, unknown> = {
          deviceId: form.deviceId.trim(),
          name: form.name.trim() || undefined,
          note: form.note.trim() || undefined,
          deviceType: form.deviceType,
          // ⚠️ Bo'sh tanlov — `null` («tozalash»), `undefined` emas.
          districtId: form.districtId || null,
          organizationId: form.organizationId || null,
        };
        /*
         * ⚠️ Kotyol FAQAT o'zgarganda yuboriladi. Ajratish — `null`:
         * server `boilerId` ni UUID sifatida tekshiradi va bo'sh satrni
         * rad etadi, `null` esa «kotyoldan ajratish» deb o'qiladi.
         */
        if (form.boilerId !== (device.boilerId ?? '')) {
          payload.boilerId = form.boilerId || null;
        }
        return patch<DeviceRow>(API.devices.one(device.id), payload);
      }
      return post<DeviceWithKey>(API.devices.list, {
        deviceId: form.deviceId.trim(),
        name: form.name.trim() || undefined,
        deviceType: form.deviceType,
        districtId: form.districtId || undefined,
        organizationId: form.organizationId || undefined,
        boilerId: form.boilerId || undefined,
        apiKey: form.apiKey.trim() || undefined,
        note: form.note.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['pendingDevices'] });
      onClose();
      if (!device && 'apiKey' in result) {
        if (result.apiKey) {
          onIssued({ deviceId: result.device.deviceId, apiKey: result.apiKey });
        } else {
          toast.success('Qurilma qo‘shildi');
        }
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

  const typeChanged = isEdit && device && form.deviceType !== device.deviceType;

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
              onChange={(event) => set('deviceId', event.target.value)}
              placeholder="modul1"
              className="font-mono"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nomi" hint="Ro‘yxatda ajratish uchun">
            {(id) => (
              <Input
                id={id}
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="1-maktab qozonxonasi moduli"
              />
            )}
          </Field>

          <Field
            label="Qurilma turi"
            required
            hint={
              typeChanged
                ? 'Tur OTA’ga ta’sir qiladi — faqat turini aytmaydigan eski proshivkada o‘zgartiring'
                : 'Proshivka faqat shu turdagi modullarga tarqatiladi'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.deviceType}
                onChange={(event) =>
                  set('deviceType', event.target.value as DeviceType)
                }
              >
                {DEVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DEVICE_TYPE_META[type].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Tuman"
            hint={
              device?.boilerId
                ? 'Kotyolga ulangan — amaldagi tuman kotyolniki'
                : 'Muassasa va kotyol ro‘yxati shu tuman bo‘yicha'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.districtId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    districtId: event.target.value,
                    // ⚠️ Muassasa tumanga tegishli — tuman o'zgarsa tozalanadi.
                    organizationId: '',
                  }))
                }
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
              !form.districtId
                ? 'Avval tumanni tanlang'
                : 'Ro‘yxat «Kataloglar → Muassasalar» dan'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.organizationId}
                disabled={!form.districtId}
                onChange={(event) => set('organizationId', event.target.value)}
              >
                <option value="">
                  {organizations.isFetching ? 'Yuklanmoqda…' : 'Tanlanmagan'}
                </option>
                {organizationOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {isEdit && device ? (
          <dl className="grid grid-cols-1 gap-2 rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5 text-meta sm:grid-cols-2">
            {/*
              ⚠️ «QURILMA XABAR QILDI» — plata menyusida tanlangan joylashuv.
              Biriktirishda yordam beradi, lekin hech narsani yo'naltirmaydi.
            */}
            <div>
              <dt className="text-micro text-muted">Tuman (plata aytgan)</dt>
              <dd className="font-medium text-strong">
                {orDash(device.reported.district)}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">
                Obyekt turi (plata aytgan)
              </dt>
              <dd className="font-medium text-strong">
                {orDash(device.reported.objectType)}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">Muassasa (plata aytgan)</dt>
              <dd className="font-medium text-strong">
                {orDash(
                  device.reported.institution ??
                    device.reported.institutionHint,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-micro text-muted">MFY (plata aytgan)</dt>
              <dd className="font-medium text-strong">
                {orDash(device.reported.mfy)}
              </dd>
            </div>
          </dl>
        ) : null}

        <Field
          label="Biriktirilgan kotyol"
          hint={
            isRoomModule
              ? 'Xona moduli kotyol moduli bor binoga ham ulanadi — har modul alohida xona bo‘ladi'
              : form.districtId
                ? 'Faqat tanlangan tumandagi, kotyol modulisiz kotyollar'
                : 'Kotyol tanlansa, joylashuv kotyoldan olinadi'
          }
        >
          {(id) => (
            <Select
              id={id}
              value={form.boilerId}
              onChange={(event) => set('boilerId', event.target.value)}
            >
              <option value="">Biriktirilmagan</option>
              {(boilers.data ?? []).map((boiler) => (
                <option key={boiler.id} value={boiler.id}>
                  {lotLabel(boiler.lotNumber)}
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
                onChange={(event) => set('apiKey', event.target.value)}
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
              onChange={(event) => set('note', event.target.value)}
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
