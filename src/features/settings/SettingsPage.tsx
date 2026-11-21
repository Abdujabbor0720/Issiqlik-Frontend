import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  DoorOpen,
  Gauge,
  Lock,
  Save,
  Settings as SettingsIcon,
  Thermometer,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, put } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { SystemSettings } from '@/shared/api/types';
import { BOILER_STATUS, ROOM_CONDITION } from '@/shared/constants/status';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateTimeUz } from '@/shared/utils/date';
import { useAuthStore } from '@/store/auth.store';

/* ⚠️ Son maydonlari MONO va tabular: chegaralar ustma-ust solishtiriladi
   («50» va «40,5») — proporsional shriftda raqamlar qalqib turardi. */
const NUMERIC = 'font-mono font-semibold tabular-nums';

interface FormState {
  activeMinC: string;
  mediumMinC: string;
  criticalMinC: string;
  overheatC: string;
  offlineAfterMinutes: string;
  normTemperature: string;
  roomMinC: string;
  roomNormC: string;
  roomSampleMinutes: string;
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
      roomMinC: String(query.data.roomMinC),
      roomNormC: String(query.data.roomNormC),
      roomSampleMinutes: String(query.data.roomSampleMinutes),
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
        roomMinC: Number(payload.roomMinC),
        roomNormC: Number(payload.roomNormC),
        roomSampleMinutes: Number(payload.roomSampleMinutes),
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
      // ⚠️ Xona holatlari (sovuq / me'yorda) ham yangi chegaradan.
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['roomsSummary'] });
      void queryClient.invalidateQueries({ queryKey: ['points'] });
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

    // ⚠️ Serverda ham, bazada ham (CHECK) — bu yerda faqat tezroq xabar.
    if (!(Number(form.roomMinC) < Number(form.roomNormC))) {
      setError(
        'Xona harorati: «Eng past» qiymati «Me‘yor» dan kichik bo‘lishi kerak',
      );
      return;
    }
    setError(null);
    mutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tizim sozlamalari"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="label-eyebrow">Oxirgi o‘zgarish</span>
            <span className="font-mono text-[11.5px] font-semibold text-ink tabular-nums">
              {formatDateTimeUz(query.data?.updatedAt)}
            </span>
          </span>
        }
        actions={
          editable ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-idle-100 px-2 py-1 font-mono text-[10.5px] font-semibold tracking-[0.08em] text-idle-600 uppercase ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10">
              <Lock className="size-3" />
              Faqat ko‘rish
            </span>
          )
        }
      />

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
          {/* ⚠️ Telefonda 2×2 to'r: to'rtta bo'lak bir qatorga sig'masdi va
              oxirgisi («Faol») ekrandan chiqib, kesilib qolardi. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-tile bg-[var(--surface)] text-center text-micro font-semibold text-white shadow-[var(--shadow-hair)] sm:flex">
            <ScaleBlock
              index={0}
              color={BOILER_STATUS.offline.hex}
              label="Aloqa yo‘q / sovuq"
              range={`< ${form.criticalMinC} °C`}
            />
            <ScaleBlock
              index={1}
              color={BOILER_STATUS.inactive.hex}
              label="Ishlamayotgan"
              range={`${form.criticalMinC}–${form.mediumMinC} °C`}
            />
            <ScaleBlock
              index={2}
              color={BOILER_STATUS.medium.hex}
              label="O‘rta ishlayotgan"
              range={`${form.mediumMinC}–${form.activeMinC} °C`}
            />
            <ScaleBlock
              index={3}
              color={BOILER_STATUS.active.hex}
              label="Faol ishlayotgan"
              range={`≥ ${form.activeMinC} °C`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="«Faol» chegarasi, °C" hint="Shundan yuqorisi — faol">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  className={NUMERIC}
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
                  className={NUMERIC}
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
                  className={NUMERIC}
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
                  className={NUMERIC}
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

      {/* ───── Xona (havo) harorati ───── */}
      <Card>
        <CardHeader
          icon={<DoorOpen className="size-4" />}
          eyebrow="Bino ichi"
          title="Xona harorati"
          subtitle="Maktab, bog‘cha va boshqa binolardagi xonalar havosi uchun"
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Me‘yor, °C"
              hint="Shundan boshlab xona yashil — «me‘yorda»"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  className={NUMERIC}
                  step="0.5"
                  min={-39}
                  max={70}
                  value={form.roomNormC}
                  disabled={!editable}
                  onChange={(event) => set('roomNormC', event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Eng past ruxsat, °C"
              hint="Bundan past — «xona sovuq» ogohlantirishi"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  className={NUMERIC}
                  step="0.5"
                  min={-40}
                  max={69}
                  value={form.roomMinC}
                  disabled={!editable}
                  onChange={(event) => set('roomMinC', event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Tarix qadami, daqiqa"
              hint="Grafik uchun necha daqiqada bir yoziladi (joriy qiymat har signalda)"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  className={NUMERIC}
                  min={1}
                  max={1440}
                  value={form.roomSampleMinutes}
                  disabled={!editable}
                  onChange={(event) =>
                    set('roomSampleMinutes', event.target.value)
                  }
                />
              )}
            </Field>
          </div>
          {/* ⚠️ Oraliq ma'nosi matnda: «me'yor» va «eng past» orasidagi
              sariq zona ogohlantirish OCHMAYDI — buni bilmagan admin
              chegarani noto'g'ri qo'yardi. */}
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-tile bg-[var(--border-subtle)] sm:grid-cols-3">
            <RoomZone
              dot={ROOM_CONDITION.cold.dot}
              label="Sovuq"
              range={`< ${form.roomMinC} °C`}
              note="ogohlantirish ochiladi"
            />
            <RoomZone
              dot={ROOM_CONDITION.cool.dot}
              label="Me‘yordan past"
              range={`${form.roomMinC}–${form.roomNormC} °C`}
              note="xaritada sariq, ogohlantirishsiz"
            />
            <RoomZone
              dot={ROOM_CONDITION.normal.dot}
              label="Me‘yorda"
              range={`≥ ${form.roomNormC} °C`}
              note="xona yashil"
            />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="«Aloqa yo‘q», daqiqa"
              hint="Signal kelmasa shuncha vaqtdan so‘ng"
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  className={NUMERIC}
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
                  className={NUMERIC}
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
                  className={NUMERIC}
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
        <div
          role="alert"
          className="reveal flex items-start gap-2.5 rounded-card bg-danger-50 px-4 py-3 text-meta font-medium text-danger-700 shadow-[inset_3px_0_0_var(--color-danger-500)] ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {editable ? (
        /* ⚠️ Saqlash paneli PASTDA yopishib turadi (`sticky`): uchta
           kartani o'qib chiqqan admin tugmani qidirib, sahifani oxirigacha
           aylantirmasin. */
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card bg-[color-mix(in_srgb,var(--surface)_97%,transparent)] px-4 py-2.5 shadow-[var(--shadow-raise)] backdrop-blur-md">
          <span className="flex items-center gap-2 text-meta text-muted">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="live-ping absolute inset-0 rounded-full bg-ok-400" />
              <span className="relative size-1.5 rounded-full bg-ok-400" />
            </span>
            O‘zgarish saqlangan zahoti kuchga kiradi
          </span>
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
        <div className="flex items-center gap-2.5 rounded-card bg-[var(--surface)] px-4 py-3 text-meta text-muted shadow-[var(--shadow-card)]">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--surface-sunken)] ring-1 ring-[var(--border-subtle)] ring-inset">
            <SettingsIcon className="size-3.5" />
          </span>
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
  index,
}: {
  color: string;
  label: string;
  range: string;
  index: number;
}) {
  return (
    <div
      /* ⚠️ `min-w-0` — usiz flex bo'lagi matnidan torroq bo'la olmaydi va
         `truncate` ishlamay, qator ekrandan chiqib ketardi.
         ⚠️ Pastki qorong'i gradient + matn soyasi: oq yozuv sariq
         («o'rta») bo'lak ustida ham o'qilsin. */
      className="reveal relative min-w-0 flex-1 overflow-hidden px-2.5 pt-3 pb-2.5 leading-tight [text-shadow:0_1px_1px_rgb(0_0_0/0.28)]"
      style={{ backgroundColor: color, '--i': index } as CSSProperties}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/22 to-transparent"
      />
      <div className="relative truncate font-mono text-[10px] font-semibold tracking-[0.08em] uppercase opacity-90">
        {label}
      </div>
      <div
        className="relative mt-1 font-display text-[17px] font-[760] tracking-[-0.02em] [font-stretch:108%]"
        data-numeric
      >
        {range}
      </div>
    </div>
  );
}

/** Xona harorati zonasi — chegaralarning ma'nosi (ogohlantirish bormi). */
function RoomZone({
  dot,
  label,
  range,
  note,
}: {
  dot: string;
  label: string;
  range: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-2.5 bg-[var(--surface-muted)] px-3 py-2.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot)} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-meta font-semibold text-strong">{label}</span>
          <span className="font-mono text-[11.5px] font-semibold text-ink tabular-nums">
            {range}
          </span>
        </p>
        <p className="text-micro text-muted">{note}</p>
      </div>
    </div>
  );
}
