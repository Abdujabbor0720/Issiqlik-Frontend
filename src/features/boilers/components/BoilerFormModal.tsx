import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, patch, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  Boiler,
  CatalogItem,
  DistrictOption,
  FuelType,
} from '@/shared/api/types';
import { FUEL_LABELS } from '@/shared/constants/status';
import { Button, Field, Input, Modal, Select, Textarea } from '@/shared/ui';

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
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = Boolean(boiler);

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
        lotNumber: boiler.lotNumber,
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
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, boiler]);

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
      get<CatalogItem[]>(API.catalogs.list('firms'), { params: { limit: 200 } }),
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

  const brands = useQuery({
    queryKey: qk.catalog('brands', 'form'),
    queryFn: () =>
      get<CatalogItem[]>(API.catalogs.list('brands'), { params: { limit: 200 } }),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Boiler> => {
      const payload = buildPayload(form);
      return boiler
        ? patch<Boiler>(API.boilers.one(boiler.id), payload)
        : post<Boiler>(API.boilers.list, payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Kotyol yangilandi' : 'Kotyol qo‘shildi');
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
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (): void => {
    const nextErrors: Record<string, string> = {};
    if (!form.districtId) nextErrors.districtId = 'Tuman tanlanmagan';
    if (!form.lotNumber.trim()) nextErrors.lotNumber = 'Lot raqami kiritilmagan';
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
          ? `Lot ${boiler?.lotNumber}`
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
      <div className="flex flex-col gap-5">
        <Section title="Hujjat ma‘lumotlari">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tuman / shahar" required error={errors.districtId}>
              {(id) => (
                <Select
                  id={id}
                  value={form.districtId}
                  onChange={(event) => set('districtId', event.target.value)}
                  invalid={Boolean(errors.districtId)}
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

            <Field label="Lot raqami" required error={errors.lotNumber}>
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
                  onChange={(event) => set('organizationId', event.target.value)}
                >
                  <option value="">Tanlanmagan</option>
                  {(organizations.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

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

        <Section title="Joylashuv">
          <div className="grid gap-4 sm:grid-cols-2">
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

        <Section title="Qo‘shimcha">
          <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="label-eyebrow mb-3">{title}</h3>
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
    lotNumber: form.lotNumber.trim(),
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
