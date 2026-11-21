import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, getPaged, patch, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  Boiler,
  CatalogItem,
  DeviceRow,
  DistrictOption,
  FuelType,
} from '@/shared/api/types';
import { FUEL_LABELS } from '@/shared/constants/status';
import { Button, Field, Input, Modal, Select, Textarea } from '@/shared/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { useAuthStore } from '@/store/auth.store';
import { boilerName } from '@/shared/utils/boiler';

/** «Yangi muassasa» varianti — Select'dagi maxsus qiymat. */
const NEW_ORGANIZATION = '__new__';

/** Modul bilan nima qilinadi (faqat YANGI kotyolda). */
type DeviceMode = 'none' | 'existing' | 'new';

/** `/boiler-setup` javobi. */
interface BoilerSetupResult {
  boiler: Boiler;
  /** ⚠️ Xom yozuv (`DeviceRow` emas) — faqat identifikator o'qiladi. */
  device: Pick<DeviceRow, 'id' | 'deviceId'> | null;
  apiKey: string | null;
  organizationCreated: boolean;
}

interface FormState {
  districtId: string;
  lotNumber: string;
  firmId: string;
  organizationId: string;
  brandId: string;
  boilerCount: string;
  normAt60: string;
  fuelType: FuelType;
  capacityKw: string;
  installedYear: string;
  address: string;
  lat: string;
  lng: string;
  responsibleName: string;
  responsiblePhone: string;
  note: string;
  /** `organizationId === NEW_ORGANIZATION` bo'lganda. */
  newOrganizationName: string;
  newOrganizationTypeId: string;
  deviceMode: DeviceMode;
  existingDeviceId: string;
  newDeviceId: string;
}

const EMPTY: FormState = {
  districtId: '',
  lotNumber: '',
  firmId: '',
  organizationId: '',
  brandId: '',
  boilerCount: '1',
  normAt60: '',
  fuelType: 'gas',
  capacityKw: '',
  installedYear: '',
  address: '',
  lat: '',
  lng: '',
  responsibleName: '',
  responsiblePhone: '',
  note: '',
  newOrganizationName: '',
  newOrganizationTypeId: '',
  deviceMode: 'none',
  existingDeviceId: '',
  newDeviceId: '',
};

/**
 * KOTYOL FORMASI — qo'shish va tahrirlash.
 *
 * ⚠️⚠️ BITTA forma ikkala amal uchun. Maydonlar, tekshiruvlar va
 * katalog ro'yxatlari aynan bir xil; ikkita komponent bo'lsa,
 * «60 gradusda norma» maydoniga qo'yilgan tuzatish faqat bittasiga
 * tushib, ikkinchisi eski holida qolardi.
 *
 * ⚠️ Holat maydonlari (harorat, holati) formada YO'Q va bo'lmaydi
 * ham: ular FAQAT telemetriyadan yoziladi. Qo'lda kiritiladigan
 * holat «hujjatdagi raqam» bo'lib qolib, datchik ko'rsatkichi bilan
 * ziddiyatga tushardi.
 */
export function BoilerFormModal({
  open,
  onClose,
  boiler,
}: {
  open: boolean;
  onClose: () => void;
  boiler?: Boiler | null;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const can = useAuthStore((state) => state.can);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Shaxsiy kalit — FAQAT server umumiy tokensiz ishlaganda qaytadi. */
  const [issuedKey, setIssuedKey] = useState<{
    deviceId: string;
    apiKey: string;
  } | null>(null);

  const isEdit = Boolean(boiler);
  const isOperator = user?.role === 'operator';
  /*
   * ⚠️ Modul bo'limi FAQAT ruxsat bo'lsa ko'rinadi — server ham alohida
   * tekshiradi (`assertDevicePermission`), bu yerda esa foydalanuvchi
   * bosib bo'lmaydigan tugmani ko'rmasligi uchun.
   */
  const canAttachDevice = can('devices.update');
  const canCreateDevice = can('devices.create');
  const showDeviceSection = !isEdit && (canAttachDevice || canCreateDevice);

  useEffect(() => {
    if (!open) return;
    /*
     * ⚠️ Holat oyna OCHILGANDA tiklanadi, komponent yaratilganda
     * emas: modal DOM'da qolib, `open` bilan boshqariladi. Aks
     * holda ikkinchi marta ochilganda oldingi yozuvning
     * ma'lumotlari ko'rinib turardi.
     */
    if (boiler) {
      setForm({
        districtId: boiler.districtId,
        lotNumber: boiler.lotNumber ?? '',
        firmId: boiler.firmId ?? '',
        organizationId: boiler.organizationId ?? '',
        brandId: boiler.brandId ?? '',
        boilerCount: String(boiler.boilerCount),
        normAt60: boiler.normAt60 === null ? '' : String(boiler.normAt60),
        fuelType: boiler.fuelType,
        capacityKw: boiler.capacityKw === null ? '' : String(boiler.capacityKw),
        installedYear:
          boiler.installedYear === null ? '' : String(boiler.installedYear),
        address: boiler.address ?? '',
        lat: boiler.lat === null ? '' : String(boiler.lat),
        lng: boiler.lng === null ? '' : String(boiler.lng),
        responsibleName: boiler.responsibleName ?? '',
        responsiblePhone: boiler.responsiblePhone ?? '',
        note: boiler.note ?? '',
        newOrganizationName: '',
        newOrganizationTypeId: '',
        deviceMode: 'none',
        existingDeviceId: '',
        newDeviceId: '',
      });
    } else {
      /*
       * ⚠️ TUMAN MAS'ULI — o'z tumani OLDINDAN tanlanadi va
       * o'zgartirilmaydi: boshqa tumanni tanlasa, server baribir 403
       * qaytarardi va u nima noto'g'ri ekanini tushunmasdi.
       */
      setForm({
        ...EMPTY,
        districtId: user?.role === 'operator' ? (user.districtId ?? '') : '',
      });
    }
    setIssuedKey(null);
    setDeviceSearch('');
    setErrors({});
  }, [open, boiler, user]);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  /*
   * ⚠️ Uchta `useQuery` ALOHIDA yozilgan, yordamchi funksiya ichida
   * emas. Hook'ni funksiya ichidan chaqirish React qoidasini buzadi:
   * bu yerda u tasodifan ishlaydi (uchalasi shartsiz va bir xil
   * tartibda chaqiriladi), lekin birinchi `if` qo'shilishi bilan
   * hook'lar tartibi buzilib, komponent yiqilardi.
   */
  const firms = useQuery({
    queryKey: qk.catalog('firms', 'form'),
    queryFn: () =>
      get<CatalogItem[]>(API.catalogs.list('firms'), {
        params: { limit: 200 },
      }),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const organizations = useQuery({
    queryKey: qk.catalog('organizations', 'form'),
    queryFn: () =>
      get<CatalogItem[]>(API.catalogs.list('organizations'), {
        params: { limit: 200 },
      }),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const objectTypes = useQuery({
    queryKey: qk.catalog('object-types', 'form'),
    queryFn: () =>
      get<CatalogItem[]>(API.catalogs.list('object-types'), {
        params: { limit: 200 },
      }),
    staleTime: 10 * 60 * 1000,
    enabled: open && !isEdit && form.organizationId === NEW_ORGANIZATION,
  });

  /*
   * ⚠️ Faqat BIRIKTIRILMAGAN modullar: biriktirilgani tanlansa server
   * 409 qaytaradi. Oxirgi signal vaqti va muassasa ishorasi (proshivkada
   * kiritilgan) ko'rsatiladi — tuman mas'uli aynan O'Z binosidagi
   * platani shu bo'yicha taniydi.
   */
  /*
   * ⚠️⚠️ QIDIRUV SERVERDA, ro'yxat cheklangan. Ilgari birinchi 100 tasi
   * olinardi: yuzlab plata o'zi ro'yxatga tushganda keraklisi ro'yxatga
   * umuman KIRMAY qolishi mumkin edi. Endi tuman mas'uli ID oxirini
   * (`a4cf12`) yoki montajchi kiritgan muassasa nomini (`12-maktab`)
   * yozadi va server mosini qaytaradi.
   */
  const [deviceSearch, setDeviceSearch] = useState('');
  const debouncedDeviceSearch = useDebounce(deviceSearch.trim(), 350);
  const DEVICE_PICK_LIMIT = 50;

  const unassignedDevices = useQuery({
    queryKey: qk.devices({
      unassigned: true,
      purpose: 'boiler-form',
      search: debouncedDeviceSearch,
      districtId: form.districtId,
    }),
    queryFn: () =>
      getPaged<DeviceRow>(API.devices.list, {
        params: {
          unassigned: true,
          limit: DEVICE_PICK_LIMIT,
          page: 1,
          /*
           * ⚠️ Faqat kotyol tumanidagi modullar: modul platada tanlangan
           * tumanga qulflangan va server boshqasini baribir rad etadi.
           */
          districtId: form.districtId,
          /*
           * ⚠️ Faqat KOTYOL modullari: bu kotyolning o'z moduli (suv
           * harorati). Xona moduli kotyol haroratini bermaydi — u «ESP32
           * modullari» sahifasidan binoga biriktiriladi.
           */
          deviceType: 'kotyol',
          ...(debouncedDeviceSearch ? { search: debouncedDeviceSearch } : {}),
        },
      }),
    // ⚠️ Tuman tanlanmaguncha so'ralmaydi — qaysi tuman modullari kerakligi noma'lum.
    enabled:
      open &&
      showDeviceSection &&
      form.deviceMode === 'existing' &&
      Boolean(form.districtId),
  });
  const unassignedTotal = unassignedDevices.data?.meta.total ?? 0;

  const brands = useQuery({
    queryKey: qk.catalog('brands', 'form'),
    queryFn: () =>
      get<CatalogItem[]>(API.catalogs.list('brands'), {
        params: { limit: 200 },
      }),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<BoilerSetupResult | Boiler> => {
      const payload = buildPayload(form);
      if (boiler) return patch<Boiler>(API.boilers.one(boiler.id), payload);

      /*
       * ⚠️⚠️ YANGI KOTYOL — HAR DOIM `/boiler-setup` orqali (modulsiz
       * bo'lsa ham): muassasa + kotyol + modul BITTA tranzaksiyada. Biror
       * qism yiqilsa hech narsa yozilmaydi va forma qayta yuborilganda
       * «lot raqami band» degan ikkinchi xato chiqmaydi.
       */
      const isNewOrg = form.organizationId === NEW_ORGANIZATION;
      return post<BoilerSetupResult>(API.boilerSetup, {
        boiler: {
          ...payload,
          organizationId: isNewOrg ? null : payload.organizationId,
        },
        ...(isNewOrg
          ? {
              newOrganizationName: form.newOrganizationName.trim(),
              ...(form.newOrganizationTypeId
                ? { newOrganizationTypeId: form.newOrganizationTypeId }
                : {}),
            }
          : {}),
        device:
          form.deviceMode === 'existing'
            ? { mode: 'existing', existingId: form.existingDeviceId }
            : form.deviceMode === 'new'
              ? { mode: 'new', deviceId: form.newDeviceId.trim() }
              : { mode: 'none' },
      });
    },
    onSuccess: (result) => {
      const setup = !isEdit ? (result as BoilerSetupResult) : null;
      toast.success(
        isEdit
          ? 'Kotyol yangilandi'
          : setup?.device
            ? `Kotyol qo‘shildi va «${setup.device.deviceId}» moduli biriktirildi`
            : 'Kotyol qo‘shildi',
      );
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['pendingDevices'] });
      if (setup?.organizationCreated) {
        void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      }
      /*
       * ⚠️ Xarita va dashboard keshlari ham bekor qilinadi: yangi
       * kotyol tumandagi sanoqni o'zgartiradi va xaritada eski
       * raqam qolib ketardi.
       */
      void queryClient.invalidateQueries({ queryKey: ['boilers'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      void queryClient.invalidateQueries({ queryKey: ['districtRows'] });
      void queryClient.invalidateQueries({ queryKey: ['map'] });
      void queryClient.invalidateQueries({ queryKey: ['points'] });
      /*
       * ⚠️ Kalit qaytgan bo'lsa (server umumiy tokensiz), oyna YOPILMAYDI
       * — kalit faqat SHU javobda bor va keyin uni olib bo'lmaydi.
       */
      if (setup?.apiKey && setup.device) {
        setIssuedKey({ deviceId: setup.device.deviceId, apiKey: setup.apiKey });
        return;
      }
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (): void => {
    const nextErrors: Record<string, string> = {};
    if (!form.districtId) nextErrors.districtId = 'Tuman tanlanmagan';
    const count = Number(form.boilerCount);
    if (!Number.isInteger(count) || count < 1) {
      nextErrors.boilerCount = 'Kamida 1 bo‘lishi kerak';
    }
    /*
     * ⚠️ Koordinata IKKALASI ham bo'lishi yoki ikkalasi ham bo'sh
     * bo'lishi kerak. Faqat bittasi kiritilsa, server uni qabul
     * qilardi, lekin xaritada nuqta chizilmasdi — foydalanuvchi esa
     * «kiritdim, lekin ko'rinmayapti» deb o'ylardi.
     */
    if (Boolean(form.lat.trim()) !== Boolean(form.lng.trim())) {
      nextErrors.lat = 'Kenglik va uzunlik birga kiritiladi';
    }
    if (
      form.organizationId === NEW_ORGANIZATION &&
      form.newOrganizationName.trim().length < 2
    ) {
      nextErrors.newOrganizationName = 'Muassasa nomini kiriting';
    }
    if (form.deviceMode === 'existing' && !form.existingDeviceId) {
      nextErrors.existingDeviceId = 'Modulni tanlang';
    }
    if (form.deviceMode === 'new') {
      const value = form.newDeviceId.trim();
      // ⚠️ Server qoidasi bilan AYNI (`SetupDeviceDto.deviceId`).
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
        nextErrors.newDeviceId =
          'Faqat lotin harflari, raqamlar, «-» va «_» (masalan esp32-a4cf12e8b901)';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Kotyolni tahrirlash' : 'Yangi qozonxona'}
      description={
        isEdit
          ? boilerName(boiler?.organization?.name, boiler?.lotNumber)
          : 'Hujjat ma‘lumotlarini kiriting — holat telemetriyadan avtomatik to‘ladi'
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
      <div className="flex flex-col gap-6">
        <Section index={1} title="Hujjat ma‘lumotlari">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tuman / shahar" required error={errors.districtId}>
              {(id) => (
                <Select
                  id={id}
                  value={form.districtId}
                  onChange={(event) => {
                    const districtId = event.target.value;
                    /*
                     * ⚠️ Modul tanlovi tozalanadi: u avvalgi tuman moduli
                     * bo'lishi mumkin va server uni rad etardi.
                     */
                    setForm((prev) => ({
                      ...prev,
                      districtId,
                      existingDeviceId: '',
                    }));
                  }}
                  invalid={Boolean(errors.districtId)}
                  disabled={isOperator}
                  title={
                    isOperator
                      ? 'Tuman mas‘uli faqat o‘z tumaniga qo‘shadi'
                      : undefined
                  }
                >
                  <option value="">Tanlang…</option>
                  {(districts.data ?? []).map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {/* ⚠️ Ixtiyoriy: rasmiy ro'yxatlarda lot ko'pincha yo'q va
                o'ylab topilgan raqam haqiqiy xarid hujjati bilan adashardi. */}
            <Field
              label="Lot raqami"
              hint="Ixtiyoriy — bo‘lmasa bo‘sh qoldiring"
              error={errors.lotNumber}
            >
              {(id) => (
                <Input
                  id={id}
                  value={form.lotNumber}
                  onChange={(event) => set('lotNumber', event.target.value)}
                  placeholder="2026-LOT-0114"
                  invalid={Boolean(errors.lotNumber)}
                />
              )}
            </Field>

            <Field label="DXSH firma nomi">
              {(id) => (
                <Select
                  id={id}
                  value={form.firmId}
                  onChange={(event) => set('firmId', event.target.value)}
                >
                  <option value="">Tanlanmagan</option>
                  {(firms.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Tashkilot nomi">
              {(id) => (
                <Select
                  id={id}
                  value={form.organizationId}
                  onChange={(event) =>
                    set('organizationId', event.target.value)
                  }
                >
                  <option value="">Tanlanmagan</option>
                  {/*
                    ⚠️ Faqat YANGI kotyolda: tuman mas'ulida katalogni
                    boshqarish huquqi yo'q, lekin o'z binosi ro'yxatda
                    bo'lmasa, kotyolni qo'sha olmay qolardi.
                  */}
                  {!isEdit ? (
                    <option value={NEW_ORGANIZATION}>+ Yangi muassasa…</option>
                  ) : null}
                  {(organizations.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {form.organizationId === NEW_ORGANIZATION ? (
              <>
                <Field
                  label="Yangi muassasa nomi"
                  required
                  error={errors.newOrganizationName}
                  hint="Ro‘yxatda shunday nom bo‘lsa — o‘sha ishlatiladi, nusxa yaratilmaydi"
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={form.newOrganizationName}
                      maxLength={180}
                      placeholder="Masalan: 4-umumta‘lim maktabi"
                      onChange={(event) =>
                        set('newOrganizationName', event.target.value)
                      }
                      invalid={Boolean(errors.newOrganizationName)}
                    />
                  )}
                </Field>
                <Field label="Muassasa turi">
                  {(id) => (
                    <Select
                      id={id}
                      value={form.newOrganizationTypeId}
                      onChange={(event) =>
                        set('newOrganizationTypeId', event.target.value)
                      }
                    >
                      <option value="">Tanlanmagan</option>
                      {(objectTypes.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            ) : null}

            <Field label="Kotyol markasi">
              {(id) => (
                <Select
                  id={id}
                  value={form.brandId}
                  onChange={(event) => set('brandId', event.target.value)}
                >
                  <option value="">Tanlanmagan</option>
                  {(brands.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Kotyol soni" required error={errors.boilerCount}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  value={form.boilerCount}
                  onChange={(event) => set('boilerCount', event.target.value)}
                  invalid={Boolean(errors.boilerCount)}
                />
              )}
            </Field>

            <Field
              label="60 gradusda norma"
              hint="Hujjatdagi me‘yoriy ko‘rsatkich"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.normAt60}
                  onChange={(event) => set('normAt60', event.target.value)}
                  placeholder="1250.50"
                />
              )}
            </Field>

            <Field label="Yoqilg‘i turi">
              {(id) => (
                <Select
                  id={id}
                  value={form.fuelType}
                  onChange={(event) =>
                    set('fuelType', event.target.value as FuelType)
                  }
                >
                  {Object.entries(FUEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section index={2} title="Joylashuv">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Manzil" className="sm:col-span-2">
              {(id) => (
                <Input
                  id={id}
                  value={form.address}
                  onChange={(event) => set('address', event.target.value)}
                  placeholder="Jalaquduq tumani, Mustaqillik ko‘chasi 12"
                />
              )}
            </Field>

            <Field
              label="Kenglik (lat)"
              error={errors.lat}
              hint="Xaritada nuqta ko‘rinishi uchun"
            >
              {(id) => (
                <Input
                  id={id}
                  value={form.lat}
                  onChange={(event) => set('lat', event.target.value)}
                  placeholder="40.7644"
                  invalid={Boolean(errors.lat)}
                />
              )}
            </Field>

            <Field label="Uzunlik (lng)">
              {(id) => (
                <Input
                  id={id}
                  value={form.lng}
                  onChange={(event) => set('lng', event.target.value)}
                  placeholder="72.6381"
                  invalid={Boolean(errors.lat)}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section index={3} title="Qo‘shimcha">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quvvat, kVt">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.1"
                  value={form.capacityKw}
                  onChange={(event) => set('capacityKw', event.target.value)}
                />
              )}
            </Field>

            <Field label="O‘rnatilgan yil">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1950}
                  max={2100}
                  value={form.installedYear}
                  onChange={(event) => set('installedYear', event.target.value)}
                />
              )}
            </Field>

            <Field label="Mas‘ul shaxs">
              {(id) => (
                <Input
                  id={id}
                  value={form.responsibleName}
                  onChange={(event) =>
                    set('responsibleName', event.target.value)
                  }
                />
              )}
            </Field>

            <Field label="Telefon">
              {(id) => (
                <Input
                  id={id}
                  value={form.responsiblePhone}
                  onChange={(event) =>
                    set('responsiblePhone', event.target.value)
                  }
                  placeholder="+998 90 123 45 67"
                />
              )}
            </Field>

            <Field label="Izoh" className="sm:col-span-2">
              {(id) => (
                <Textarea
                  id={id}
                  value={form.note}
                  onChange={(event) => set('note', event.target.value)}
                  rows={2}
                />
              )}
            </Field>
          </div>
        </Section>

        {showDeviceSection ? (
          <Section index={4} title="ESP32 moduli">
            <div className="flex flex-col gap-3">
              <div
                role="radiogroup"
                aria-label="Modul"
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {(
                  [
                    { key: 'none', label: 'Hozircha modulsiz', allowed: true },
                    {
                      key: 'existing',
                      label: 'Ro‘yxatdagi moduldan',
                      allowed: canAttachDevice,
                    },
                    {
                      key: 'new',
                      label: 'Yangi modul',
                      allowed: canCreateDevice,
                    },
                  ] as const
                )
                  .filter((option) => option.allowed)
                  .map((option) => (
                    <label
                      key={option.key}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-tile px-3 py-2.5 text-ui ring-1 ring-inset',
                        'transition-[background-color,box-shadow,color,transform] duration-200 ease-out-quint active:scale-[0.98]',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400',
                        form.deviceMode === option.key
                          ? 'bg-brand-50 font-semibold text-brand-800 shadow-[inset_3px_0_0_var(--color-brand-500)] ring-brand-300 dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/30'
                          : 'bg-[var(--surface-sunken)] font-medium text-ink ring-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name="deviceMode"
                        value={option.key}
                        checked={form.deviceMode === option.key}
                        onChange={() => set('deviceMode', option.key)}
                        className="size-3.5 accent-brand-600"
                      />
                      {option.label}
                    </label>
                  ))}
              </div>

              {form.deviceMode === 'existing' ? (
                <Field
                  label="Qidirish"
                  hint="ID oxiri (masalan a4cf12) yoki montajchi platada yozgan muassasa nomi"
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={deviceSearch}
                      maxLength={64}
                      placeholder="a4cf12 yoki 12-maktab"
                      /*
                       * ⚠️ Brauzer avto-to'ldirishi O'CHIQ: aks holda u boshqa
                       * saytlarda yozilgan matnni taklif qilib, «bu qayerdan
                       * chiqdi?» degan chalkashlik tug'dirardi.
                       */
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setDeviceSearch(event.target.value);
                        // ⚠️ Tanlov tozalanadi: yangi natijada u bo'lmasligi mumkin.
                        set('existingDeviceId', '');
                      }}
                    />
                  )}
                </Field>
              ) : null}

              {form.deviceMode === 'existing' ? (
                <Field
                  label="Biriktirilmagan modul"
                  required
                  error={errors.existingDeviceId}
                  hint="Plata umumiy token bilan o‘zi ro‘yxatga tushgan. Muassasa ishorasi — montajchi platada kiritgan matn."
                >
                  {(id) => (
                    <Select
                      id={id}
                      value={form.existingDeviceId}
                      onChange={(event) =>
                        set('existingDeviceId', event.target.value)
                      }
                      invalid={Boolean(errors.existingDeviceId)}
                    >
                      <option value="">
                        {!form.districtId
                          ? 'Avval yuqorida tumanni tanlang'
                          : unassignedDevices.isFetching
                            ? 'Yuklanmoqda…'
                            : (unassignedDevices.data?.items.length ?? 0) === 0
                              ? debouncedDeviceSearch
                                ? 'Bu qidiruv bo‘yicha modul topilmadi'
                                : 'Biriktirilmagan modul yo‘q'
                              : 'Tanlang…'}
                      </option>
                      {(unassignedDevices.data?.items ?? []).map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.deviceId}
                          {(device.reported.institution ??
                          device.reported.institutionHint)
                            ? ` — «${device.reported.institution ?? device.reported.institutionHint}»`
                            : ''}
                          {/* Tumansiz eski plata — admin uchun belgi. */}
                          {!device.districtId ? ' · tuman yuborilmagan' : ''}
                          {device.lastSeenAt
                            ? ` · ${formatRelativeUz(device.lastSeenAt)}`
                            : ' · hali ulanmagan'}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}

              {/*
                ⚠️ Ro'yxat to'liq emasligi OCHIQ aytiladi: aks holda
                keraklisini ko'rmagan odam «modul ro'yxatga tushmagan» deb
                o'ylab, uni qaytadan «Yangi modul» qilib kiritishga urinardi.
              */}
              {form.deviceMode === 'existing' &&
              unassignedTotal > (unassignedDevices.data?.items.length ?? 0) ? (
                <p className="-mt-1 text-micro text-warn-700 dark:text-warn-300">
                  Jami {unassignedTotal} ta mos modul — birinchi{' '}
                  {unassignedDevices.data?.items.length} tasi ko‘rsatilmoqda.
                  Qidiruvni aniqlashtiring.
                </p>
              ) : null}

              {form.deviceMode === 'new' ? (
                <Field
                  label="Modul identifikatori"
                  required
                  error={errors.newDeviceId}
                  hint="Har platada o‘ziniki (chip MAC manzilidan). Wi-Fi sozlash sahifasining tepasida «Qurilma: esp32-…» deb yozilgan. Plata ulangan bo‘lsa, «Ro‘yxatdagi moduldan» ni tanlang — yozish shart emas."
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={form.newDeviceId}
                      maxLength={64}
                      placeholder="esp32-a4cf12e8b901"
                      // ⚠️ Brauzer boshqa saytlardagi matnni taklif qilmasin.
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      onChange={(event) =>
                        set('newDeviceId', event.target.value)
                      }
                      invalid={Boolean(errors.newDeviceId)}
                    />
                  )}
                </Field>
              ) : null}
            </div>
          </Section>
        ) : null}
      </div>

      {/*
        ⚠️ SHAXSIY KALIT — FAQAT BIR MARTA. Server umumiy tokensiz
        ishlaganda qaytadi; oyna yopilgandan keyin uni olib bo'lmaydi
        (bazada faqat hash). Umumiy token yoqilgan bo'lsa bu oyna
        umuman chiqmaydi.
      */}
      <Modal
        open={Boolean(issuedKey)}
        onClose={() => {
          setIssuedKey(null);
          onClose();
        }}
        size="sm"
        title="Modul kaliti — faqat bir marta"
        description={issuedKey ? `Modul: ${issuedKey.deviceId}` : undefined}
      >
        {issuedKey ? (
          <div className="flex flex-col gap-3">
            <p className="text-meta text-muted">
              Bu kalitni ESP32 proshivkasiga yozing. Oyna yopilgandan keyin uni
              qayta ko‘rib bo‘lmaydi — faqat yangisini yaratish mumkin.
            </p>
            <code className="block rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5 font-mono text-meta break-all text-strong ring-1 ring-[var(--border-subtle)] select-all ring-inset">
              {issuedKey.apiKey}
            </code>
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard
                  .writeText(issuedKey.apiKey)
                  .then(() => toast.success('Nusxalandi'))
                  .catch(() =>
                    toast.error('Nusxalab bo‘lmadi — qo‘lda belgilang'),
                  );
              }}
            >
              Nusxalash
            </Button>
          </div>
        ) : null}
      </Modal>
    </Modal>
  );
}

/**
 * Forma bo'limi — raqamli yorliq va ingichka chiziq.
 *
 * ⚠️ Raqam (01, 02…) — uzun formada «qayerdaman» degan belgi: oyna
 * suriladi va sarlavhasiz bo'lim boshqasiga qo'shilib ketgandek ko'rinardi.
 */
function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="font-mono text-[10.5px] font-semibold text-brand-600 tabular-nums dark:text-brand-300">
          {String(index).padStart(2, '0')}
        </span>
        <h3 className="label-eyebrow text-[color:var(--ink-muted)]">{title}</h3>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  );
}

/**
 * ⚠️⚠️ BO'SH MAYDON `null` bo'lib yuboriladi, `undefined` EMAS.
 *
 * Farq foydalanuvchi uchun KO'RINADI: server `undefined` ni
 * «tegilmasin», `null` ni esa «TOZALANSIN» deb o'qiydi. Agar bo'sh
 * maydon `undefined` bo'lib ketsa, kotyolga biriktirilgan firmani
 * olib tashlab bo'lmasdi — «Tanlanmagan» ni tanlagan odam saqlardi,
 * lekin eski firma joyida qolaverardi va u buni XATO deb o'qirdi.
 *
 * ⚠️ `districtId`, `lotNumber`, `boilerCount` va `fuelType` — majburiy
 * maydonlar, ular hech qachon `null` bo'lmaydi.
 */
function buildPayload(form: FormState): Record<string, unknown> {
  const text = (value: string): string | null =>
    value.trim() === '' ? null : value.trim();
  const num = (value: string): number | null =>
    value.trim() === '' ? null : Number(value);

  return {
    districtId: form.districtId,
    lotNumber: form.lotNumber.trim() || null,
    firmId: text(form.firmId),
    organizationId: text(form.organizationId),
    brandId: text(form.brandId),
    boilerCount: Number(form.boilerCount),
    normAt60: num(form.normAt60),
    fuelType: form.fuelType,
    capacityKw: num(form.capacityKw),
    installedYear: num(form.installedYear),
    address: text(form.address),
    lat: num(form.lat),
    lng: num(form.lng),
    responsibleName: text(form.responsibleName),
    responsiblePhone: text(form.responsiblePhone),
    note: text(form.note),
  };
}
