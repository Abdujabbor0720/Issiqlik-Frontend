import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, getPaged, put } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  Boiler,
  CatalogItem,
  DistrictOption,
  MonitoringScheduleRow,
  ScheduleScope,
} from '@/shared/api/types';
import { SCHEDULE_SCOPE_LABELS, WEEKDAYS } from '@/shared/constants/incident';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useDistrictCatalog } from '@/shared/hooks/useCatalogOptions';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';

type NewScope = Exclude<ScheduleScope, 'global'>;

const DEFAULTS = {
  mode: 'schedule' as 'always' | 'schedule',
  activeDays: [1, 2, 3, 4, 5, 6],
  heatingStart: '06:00',
  heatingEnd: '18:00',
  monitorStart: '07:00',
  monitorEnd: '18:00',
  minRoomTemperature: '',
  observeHolidays: true,
  note: '',
};

/**
 * JADVAL FORMASI — nishon bo'yicha saqlanadi (bitta nishonda bitta jadval).
 *
 * ⚠️ Mavjud jadvalni tahrirlashda NISHON o'zgarmaydi: boshqa obyektga
 * «ko'chirish» bitta jadvalni o'chirib, boshqasini yaratish degani va u
 * ikki alohida qaror sifatida qilinishi kerak.
 *
 * ⚠️ Minimal harorat bo'sh — tasdiqlangan umumiy sozlamadan («Sozlamalar»).
 */
export function ScheduleModal({
  open,
  schedule,
  onClose,
}: {
  open: boolean;
  schedule: MonitoringScheduleRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULTS);
  const [scope, setScope] = useState<NewScope>('boiler');
  const [targetId, setTargetId] = useState('');
  const [districtKey, setDistrictKey] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search);
  const creating = !schedule;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTargetId('');
    setSearch('');
    if (schedule) {
      setForm({
        mode: schedule.mode,
        activeDays: schedule.activeDays,
        heatingStart: schedule.heatingStart,
        heatingEnd: schedule.heatingEnd,
        monitorStart: schedule.monitorStart,
        monitorEnd: schedule.monitorEnd,
        minRoomTemperature:
          schedule.minRoomTemperature === null
            ? ''
            : String(schedule.minRoomTemperature),
        observeHolidays: schedule.observeHolidays,
        note: schedule.note ?? '',
      });
    } else {
      setForm(DEFAULTS);
    }
  }, [open, schedule]);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open && creating && scope === 'organization',
  });
  const organizations = useDistrictCatalog(
    'organizations',
    districtKey,
    open && creating && scope === 'organization',
  );
  const objectTypes = useQuery({
    queryKey: qk.catalog('object-types', 'schedule-form'),
    queryFn: () =>
      getPaged<CatalogItem>(API.catalogs.list('object-types'), {
        params: { limit: 200 },
      }),
    enabled: open && creating && scope === 'object_type',
  });
  const boilers = useQuery({
    queryKey: qk.boilers({ schedule: true, search: debouncedSearch }),
    queryFn: () =>
      getPaged<Boiler>(API.boilers.list, {
        params: { limit: 20, search: debouncedSearch || undefined },
      }),
    enabled: open && creating && scope === 'boiler',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const min = form.minRoomTemperature.trim().replace(',', '.');
      return put(API.monitoring.schedules, {
        scopeType: schedule?.scopeType ?? scope,
        scopeId: schedule ? schedule.scopeId : targetId,
        mode: form.mode,
        ...(form.mode === 'schedule'
          ? {
              activeDays: form.activeDays,
              heatingStart: form.heatingStart,
              heatingEnd: form.heatingEnd,
              monitorStart: form.monitorStart,
              monitorEnd: form.monitorEnd,
              observeHolidays: form.observeHolidays,
            }
          : {}),
        minRoomTemperature: min === '' ? null : Number(min),
        note: form.note.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Jadval saqlandi');
      void queryClient.invalidateQueries({ queryKey: qk.schedules });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) =>
    set(
      'activeDays',
      form.activeDays.includes(day)
        ? form.activeDays.filter((item) => item !== day)
        : [...form.activeDays, day].sort((a, b) => a - b),
    );

  const submit = () => {
    if (creating && !targetId) return setError('Nishon tanlanmagan');
    if (form.mode === 'schedule' && form.activeDays.length === 0) {
      return setError('Kamida bitta hafta kuni tanlang');
    }
    const min = form.minRoomTemperature.trim().replace(',', '.');
    if (
      min !== '' &&
      (Number.isNaN(Number(min)) || Number(min) < 0 || Number(min) > 40)
    ) {
      return setError('Minimal harorat 0…40 °C oralig‘ida bo‘lishi kerak');
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={creating ? 'Individual jadval' : 'Jadvalni tahrirlash'}
      description={schedule?.scopeLabel}
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
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {creating ? (
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-[var(--surface-sunken)] p-3 sm:grid-cols-2">
            <Field label="Daraja">
              {(id) => (
                <Select
                  id={id}
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value as NewScope);
                    setTargetId('');
                  }}
                >
                  {(['boiler', 'organization', 'object_type'] as const).map(
                    (value) => (
                      <option key={value} value={value}>
                        {SCHEDULE_SCOPE_LABELS[value]}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </Field>

            {scope === 'organization' ? (
              <Field label="Tuman">
                {(id) => (
                  <Select
                    id={id}
                    value={districtKey}
                    onChange={(event) => {
                      setDistrictKey(event.target.value);
                      setTargetId('');
                    }}
                  >
                    <option value="">Tanlang</option>
                    {(districts.data ?? []).map((district) => (
                      <option key={district.id} value={district.key}>
                        {district.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : scope === 'boiler' ? (
              <Field label="Qidirish">
                {(id) => (
                  <Input
                    id={id}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Lot raqami yoki muassasa…"
                  />
                )}
              </Field>
            ) : (
              <div />
            )}

            <Field label="Nishon" required className="sm:col-span-2">
              {(id) => (
                <Select
                  id={id}
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  <option value="">Tanlang</option>
                  {scope === 'object_type'
                    ? (objectTypes.data?.items ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))
                    : scope === 'organization'
                      ? (organizations.data ?? []).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))
                      : (boilers.data?.items ?? []).map((boiler) => (
                          <option key={boiler.id} value={boiler.id}>
                            {boilerName(
                              boiler.organization?.name,
                              boiler.lotNumber,
                            )}
                            {boiler.district
                              ? ` · ${boiler.district.shortName}`
                              : ''}
                          </option>
                        ))}
                </Select>
              )}
            </Field>
          </div>
        ) : null}

        <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5 self-start">
          {(
            [
              ['schedule', 'Jadval asosida'],
              ['always', '24/7 (uzluksiz)'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('mode', value)}
              className={
                form.mode === value
                  ? 'rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-meta font-semibold text-strong shadow-[var(--shadow-hair)]'
                  : 'rounded-full px-3.5 py-1.5 text-meta font-medium text-muted'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {form.mode === 'schedule' ? (
          <>
            <Field label="Faol hafta kunlari">
              {() => (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const on = form.activeDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        title={day.label}
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'h-9 w-11 rounded-lg text-meta font-semibold transition-colors',
                          on
                            ? 'bg-brand-600 text-white'
                            : 'bg-[var(--surface-sunken)] text-muted hover:text-strong',
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="XAVF monitoringi — boshlanishi"
                hint="Maktab/bog‘cha uchun odatda 07:00"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={form.monitorStart}
                    onChange={(event) =>
                      set('monitorStart', event.target.value)
                    }
                  />
                )}
              </Field>
              <Field label="Monitoring — tugashi">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={form.monitorEnd}
                    onChange={(event) => set('monitorEnd', event.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Isitish — boshlanishi"
                hint="Kotyol sovuqligi faqat shu oynada XAVF"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={form.heatingStart}
                    onChange={(event) =>
                      set('heatingStart', event.target.value)
                    }
                  />
                )}
              </Field>
              <Field label="Isitish — tugashi">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={form.heatingEnd}
                    onChange={(event) => set('heatingEnd', event.target.value)}
                  />
                )}
              </Field>
            </div>
            <p className="text-micro text-faint">
              Boshlanish = tugash — kun bo‘yi; boshlanish &gt; tugash — tun
              orqali (masalan 22:00–06:00).
            </p>

            <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-ink">
              <Switch
                checked={form.observeHolidays}
                onChange={(value) => set('observeHolidays', value)}
                label="Bayram kunlari monitoringdan chiqariladi"
              />
              <span>Bayram kunlari monitoringdan chiqariladi</span>
            </label>
          </>
        ) : null}

        <Field
          label="Minimal xona harorati, °C"
          hint="Bo‘sh — tasdiqlangan umumiy sozlamadan olinadi"
        >
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={form.minRoomTemperature}
              onChange={(event) =>
                set('minRoomTemperature', event.target.value)
              }
              placeholder="18"
            />
          )}
        </Field>

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
