import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Save, Settings as SettingsIcon, Thermometer } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, put } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { SystemSettings } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Skeleton,
} from '@/shared/ui';
import { formatDateTimeUz } from '@/shared/utils/date';
import { useAuthStore } from '@/store/auth.store';

interface FormState {
  activeMinC: string;
  mediumMinC: string;
  criticalMinC: string;
  overheatC: string;
  offlineAfterMinutes: string;
  normTemperature: string;
  retentionDays: string;
  seasonLabel: string;
}

/**
 * TIZIM SOZLAMALARI.
 *
 * ⚠️⚠️ Chegaralar bu yerdan o'zgartiriladi, `.env` dan EMAS. `.env`
 * dagi qiymatlar faqat BOSHLANG'ICH: qishda chegarani to'g'rilash
 * uchun serverni to'xtatish kerak bo'lmasligi shart — bu bir necha
 * soatlik uzilish degani.
 *
 * ⚠️ O'zgarish FAQAT kelajakdagi o'lchovlarga ta'sir qiladi. O'tgan
 * telemetriya qatorlariga holat MUHRLANGAN va qayta baholanmaydi:
 * «o'tgan hafta 40 ta faol edi» degan hisobot chegara o'zgarishi
 * bilan jimgina boshqa raqamga aylanib qolmasligi kerak.
 */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const editable = can('settings.update');

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.settings,
    queryFn: () => get<SystemSettings>(API.settings),
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      activeMinC: String(query.data.activeMinC),
      mediumMinC: String(query.data.mediumMinC),
      criticalMinC: String(query.data.criticalMinC),
      overheatC: String(query.data.overheatC),
      offlineAfterMinutes: String(query.data.offlineAfterMinutes),
      normTemperature: String(query.data.normTemperature),
      retentionDays: String(query.data.retentionDays),
      seasonLabel: query.data.seasonLabel ?? '',
    });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) =>
      put<SystemSettings>(API.settings, {
        activeMinC: Number(payload.activeMinC),
        mediumMinC: Number(payload.mediumMinC),
        criticalMinC: Number(payload.criticalMinC),
        overheatC: Number(payload.overheatC),
        offlineAfterMinutes: Number(payload.offlineAfterMinutes),
        normTemperature: Number(payload.normTemperature),
        retentionDays: Number(payload.retentionDays),
        seasonLabel: payload.seasonLabel.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Sozlamalar saqlandi — darhol kuchga kirdi');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      /* ⚠️ Dashboard va xarita ham yangilanadi: chegara o'zgarishi
         bilan kotyollar boshqa holatga o'tadi va eski raqamlar
         ekranda qolib ketardi. */
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      void queryClient.invalidateQueries({ queryKey: ['districtRows'] });
      void queryClient.invalidateQueries({ queryKey: ['map'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (query.isLoading || !form) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <ErrorState
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  const set = (key: keyof FormState, value: string): void =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = (): void => {
    const active = Number(form.activeMinC);
    const medium = Number(form.mediumMinC);
    const critical = Number(form.criticalMinC);

    /*
     * ⚠️ Tartib FRONTENDDA ham tekshiriladi, serverda ham, bazada
     * ham (CHECK constraint). Uchta qavat ortiqcha emas: `faol < o'rta`
     * bo'lib qolsa, HAR BIR kotyol bir vaqtda ikki holatga tushardi
     * va dashboard'dagi yig'indi jami songa teng bo'lmay qolardi.
     */
    if (!(active > medium && medium > critical)) {
      setError(
        'Chegaralar kamayish tartibida bo‘lishi kerak: «Faol» > «O‘rta» > «Kritik»',
      );
      return;
    }
    setError(null);
    mutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <h1 className="text-sub font-semibold tracking-tight text-strong">
          Tizim sozlamalari
        </h1>
        <p className="text-meta text-muted">
          Oxirgi o‘zgarish: {formatDateTimeUz(query.data?.updatedAt)}
        </p>
      </div>

      {/* ───── Holat chegaralari ───── */}
      <Card>
        <CardHeader
          icon={<Thermometer className="size-4" />}
          eyebrow="Asosiy qoida"
          title="Kotyol holati chegaralari"
          subtitle="Chiqish harorati shu chegaralar bilan solishtiriladi"
        />
        <CardBody className="flex flex-col gap-5">
          {/* Vizual shkala — chegaralarning ma'nosini bir qarashda
              ko'rsatadi. */}
          <div className="flex overflow-hidden rounded-lg text-center text-micro font-semibold text-white">
            <ScaleBlock
              color={BOILER_STATUS.offline.hex}
              label="Aloqa yo‘q / sovuq"
              range={`< ${form.criticalMinC} °C`}
            />
            <ScaleBlock
              color={BOILER_STATUS.inactive.hex}
              label="Ishlamayotgan"
              range={`${form.criticalMinC}–${form.mediumMinC} °C`}
            />
            <ScaleBlock
              color={BOILER_STATUS.medium.hex}
              label="O‘rta ishlayotgan"
              range={`${form.mediumMinC}–${form.activeMinC} °C`}
            />
            <ScaleBlock
              color={BOILER_STATUS.active.hex}
              label="Faol ishlayotgan"
              range={`≥ ${form.activeMinC} °C`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="«Faol» chegarasi, °C" hint="Shundan yuqorisi — faol">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  value={form.activeMinC}
                  disabled={!editable}
                  onChange={(event) => set('activeMinC', event.target.value)}
                />
              )}
            </Field>

            <Field label="«O‘rta» chegarasi, °C" hint="Faol bilan oraliq">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  value={form.mediumMinC}
                  disabled={!editable}
                  onChange={(event) => set('mediumMinC', event.target.value)}
                />
              )}
            </Field>

            <Field label="Kritik chegara, °C" hint="Bundan past — sovuq">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  value={form.criticalMinC}
                  disabled={!editable}
                  onChange={(event) => set('criticalMinC', event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Ortiqcha qizish, °C"
              hint="Shundan yuqorisi — avariya signali"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  value={form.overheatC}
                  disabled={!editable}
                  onChange={(event) => set('overheatC', event.target.value)}
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ───── Aloqa va saqlash ───── */}
      <Card>
        <CardHeader
          icon={<Gauge className="size-4" />}
          eyebrow="Telemetriya"
          title="Aloqa va ma‘lumot saqlash"
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="«Aloqa yo‘q», daqiqa"
              hint="Signal kelmasa shuncha vaqtdan so‘ng"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  value={form.offlineAfterMinutes}
                  disabled={!editable}
                  onChange={(event) =>
                    set('offlineAfterMinutes', event.target.value)
                  }
                />
              )}
            </Field>

            <Field
              label="Me‘yoriy harorat, °C"
              hint="Hujjatdagi me‘yor — kartalarda taqqoslanadi"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.5"
                  value={form.normTemperature}
                  disabled={!editable}
                  onChange={(event) =>
                    set('normTemperature', event.target.value)
                  }
                />
              )}
            </Field>

            <Field
              label="Saqlash muddati, kun"
              hint="Eski o‘lchovlar tungi tozalashda o‘chiriladi"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={7}
                  value={form.retentionDays}
                  disabled={!editable}
                  onChange={(event) => set('retentionDays', event.target.value)}
                />
              )}
            </Field>

            <Field label="Mavsum yorlig‘i" hint="Hisobot sarlavhasida">
              {(id) => (
                <Input
                  id={id}
                  value={form.seasonLabel}
                  disabled={!editable}
                  onChange={(event) => set('seasonLabel', event.target.value)}
                  placeholder="2026–2027"
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <div className="rounded-card bg-danger-50 px-4 py-3 text-meta font-medium text-danger-700 ring-1 ring-danger-200 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/25">
          {error}
        </div>
      ) : null}

      {editable ? (
        <div className="flex justify-end px-1">
          <Button
            variant="primary"
            icon={<Save className="size-4" />}
            loading={mutation.isPending}
            onClick={handleSave}
          >
            Sozlamalarni saqlash
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-card bg-[var(--surface)] px-4 py-3 text-meta text-muted shadow-[var(--shadow-card)]">
          <SettingsIcon className="size-4 shrink-0" />
          Sozlamalarni o‘zgartirish uchun ruxsatingiz yo‘q — faqat ko‘rish.
        </div>
      )}
    </div>
  );
}

function ScaleBlock({
  color,
  label,
  range,
}: {
  color: string;
  label: string;
  range: string;
}) {
  return (
    <div
      className="flex-1 px-2 py-2.5 leading-tight"
      style={{ backgroundColor: color }}
    >
      <div className="truncate">{label}</div>
      <div className="mt-0.5 text-nano font-normal opacity-80" data-numeric>
        {range}
      </div>
    </div>
  );
}
