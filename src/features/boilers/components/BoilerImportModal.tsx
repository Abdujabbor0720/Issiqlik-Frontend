import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, postForm } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { BoilerImportPlan, DistrictOption } from '@/shared/api/types';
import { AnimatedNumber, Button, Field, Modal, Select } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatDateUz } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { useFiltersStore } from '@/store/filters.store';

/** Server bilan AYNI chegara (`IMPORT_MAX_BYTES`). */
const MAX_BYTES = 5 * 1024 * 1024;

type Step = 'select' | 'preview' | 'done';

/**
 * EXCEL'DAN IMPORT — ta'lim boshqarmasining qozonxonalar jadvali.
 *
 * ⚠️⚠️ IKKI QADAM: avval «Tekshirish» (server faylni o'qib, nima
 * yozilishini ko'rsatadi — bazaga TEGMAYDI), keyin «Import qilish».
 * Yozishda fayl QAYTA yuboriladi va server rejani tranzaksiya ichida
 * yangidan tekshiradi — oraliqda kimdir muassasa qo'shgan bo'lsa,
 * takror yaratilmaydi.
 *
 * ⚠️ Tuman fayldan olinmaydi — u «Андижон шаҳар» kabi erkin matn va
 * taxmin qilish xato tumanga yozib yuborishi mumkin edi. Tuman mas'uli
 * faqat o'z tumanini tanlaydi (server ham tekshiradi).
 */
export function BoilerImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const filterDistrictId = useFiltersStore((state) => state.districtId);
  const isOperator = user?.role === 'operator';

  const [step, setStep] = useState<Step>('select');
  const [districtId, setDistrictId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [devices, setDevices] = useState<File | null>(null);
  const [plan, setPlan] = useState<BoilerImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Oyna har ochilganda — toza holat.
  useEffect(() => {
    if (!open) return;
    setStep('select');
    setDistrictId((isOperator ? user?.districtId : filterDistrictId) ?? '');
    setFile(null);
    setDevices(null);
    setPlan(null);
    setError(null);
  }, [open, isOperator, user?.districtId, filterDistrictId]);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  const send = async (url: string): Promise<BoilerImportPlan> => {
    if (!file) throw new Error('Qozonxonalar jadvalini tanlang');
    const form = new FormData();
    form.append('districtId', districtId);
    form.append('file', file);
    if (devices) form.append('devices', devices);
    return postForm<BoilerImportPlan>(url, form);
  };

  const preview = useMutation({
    mutationFn: () => send(API.boilers.importPreview),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      setPlan(result);
      setStep('preview');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const apply = useMutation({
    mutationFn: () => send(API.boilers.import),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      setPlan(result);
      setStep('done');
      const created = result.result;
      toast.success(
        `Qo‘shildi: ${formatNumber(created?.organizationsCreated ?? 0)} muassasa, ` +
          `${formatNumber(created?.boilersCreated ?? 0)} qozonxona`,
      );
      for (const key of [
        ['boilers'],
        ['gauges'],
        ['summary'],
        ['districtRows'],
        ['map'],
        ['points'],
        ['catalogs'],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const busy = preview.isPending || apply.isPending;
  const nothingToWrite =
    plan !== null &&
    plan.totals.boilers === 0 &&
    plan.totals.newOrganizations === 0;

  const footer =
    step === 'select' ? (
      <>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Bekor qilish
        </Button>
        <Button
          variant="primary"
          icon={<FileSpreadsheet className="size-4" />}
          onClick={() => preview.mutate()}
          loading={preview.isPending}
          disabled={!file || !districtId}
        >
          Tekshirish
        </Button>
      </>
    ) : step === 'preview' ? (
      <>
        <Button
          variant="ghost"
          onClick={() => {
            setStep('select');
            setError(null);
          }}
          disabled={busy}
        >
          Orqaga
        </Button>
        <Button
          variant="primary"
          icon={<Upload className="size-4" />}
          onClick={() => apply.mutate()}
          loading={apply.isPending}
          disabled={nothingToWrite}
        >
          Import qilish
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose}>
        Yopish
      </Button>
    );

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      size="lg"
      title="Excel'dan import"
      description="Ta’lim boshqarmasining qozonxonalar jadvali (.xlsx) — avval tekshiriladi, keyin yoziladi"
      footer={footer}
    >
      <StepTrack step={step} />

      {step === 'select' ? (
        <div className="flex flex-col gap-4">
          <Field label="Tuman / shahar" required>
            {(id) => (
              <Select
                id={id}
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value)}
                disabled={isOperator}
                title={
                  isOperator
                    ? 'Tuman mas‘uli faqat o‘z tumaniga import qiladi'
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

          <FilePicker
            label="Qozonxonalar jadvali"
            hint="«Ҳудудлар ва таълим муассасалари номи … қозонхоналар сони» shaklidagi .xlsx"
            required
            file={file}
            onChange={setFile}
            onError={setError}
          />
          <FilePicker
            label="Eski tizim qurilmalari"
            hint="Ixtiyoriy — «Qurilmalar_….xlsx»: plata seriyasi qozonxona izohiga yoziladi"
            file={devices}
            onChange={setDevices}
            onError={setError}
          />

          <ul className="list-disc space-y-1 pl-5 text-micro text-muted">
            <li>Lot raqami yozilmaydi — keyin qo‘lda kiritish mumkin.</li>
            <li>
              Markazlashgan isitishdagi va rekonstruksiyadagi muassasalar uchun
              qozonxona yaratilmaydi.
            </li>
            <li>
              Mavjud muassasa qayta yaratilmaydi; qozonxonasi bor muassasaga
              tegilmaydi.
            </li>
          </ul>
        </div>
      ) : null}

      {step !== 'select' && plan ? (
        <PlanView plan={plan} done={step === 'done'} />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-meta text-danger-700 ring-1 ring-danger-200 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/25"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </Modal>
  );
}

const STEPS: ReadonlyArray<{ key: Step; label: string }> = [
  { key: 'select', label: 'Fayl' },
  { key: 'preview', label: 'Tekshirish' },
  { key: 'done', label: 'Natija' },
];

/**
 * Qadamlar chizig'i — «hozir qaysi bosqichdaman».
 *
 * ⚠️ Faqat KO'RSATKICH, tugma emas: qadamlar orasida yurish faqat oyna
 * pastidagi «Tekshirish» / «Orqaga» orqali — aks holda tekshirilmagan
 * fayl bilan to'g'ridan-to'g'ri «Natija» ga o'tib bo'lardi.
 */
function StepTrack({ step }: { step: Step }) {
  const current = STEPS.findIndex((item) => item.key === step);
  return (
    <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Import bosqichlari">
      {STEPS.map((item, index) => {
        const state =
          index < current ? 'done' : index === current ? 'current' : 'next';
        return (
          <li
            key={item.key}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex flex-col gap-1.5"
          >
            <span className="relative h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <span
                className={cn(
                  'absolute inset-0 origin-left transition-transform duration-500 ease-out-expo',
                  state === 'next' ? 'scale-x-0' : 'scale-x-100',
                  state === 'current' ? 'thermal-line' : 'bg-brand-500',
                )}
              />
            </span>
            <span
              className={cn(
                'font-mono text-[10.5px] font-semibold tracking-[0.1em] uppercase',
                state === 'next' ? 'text-faint' : 'text-strong',
              )}
            >
              <span className="text-faint">
                {String(index + 1).padStart(2, '0')}
              </span>{' '}
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FilePicker({
  label,
  hint,
  required,
  file,
  onChange,
  onError,
}: {
  label: string;
  hint: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (picked: File | undefined): void => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.xlsx')) {
      onError(`${label}: faqat .xlsx (Excel) fayl`);
      return;
    }
    if (picked.size > MAX_BYTES) {
      onError(`${label}: fayl juda katta (5 MB dan oshmasin)`);
      return;
    }
    onError(null);
    onChange(picked);
  };

  return (
    <Field label={label} required={required} hint={hint}>
      {(id) => (
        /* ⚠️ Chegara HAR DOIM 1px (faqat uslubi o'zgaradi: punktir →
           yaxlit): fayl tanlanganda qalinlik o'zgarsa, forma sakrardi. */
        <div
          className={cn(
            'group flex items-center gap-3 rounded-tile border px-3 py-3 transition-[background-color,border-color] duration-200',
            'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400',
            file
              ? 'border-brand-300 bg-brand-50/60 dark:border-brand-400/35 dark:bg-brand-400/10'
              : 'border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] hover:border-brand-400 hover:bg-[var(--surface)] dark:hover:border-brand-400/60',
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            pick(event.dataTransfer.files[0]);
          }}
        >
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-md ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover:-translate-y-0.5',
              file
                ? 'bg-brand-600 text-white ring-brand-700 shadow-[var(--shadow-brand)] dark:ring-brand-400/40'
                : 'bg-[var(--surface)] text-faint ring-[var(--border-subtle)]',
            )}
          >
            <FileSpreadsheet className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {file ? (
              <>
                <p className="truncate text-meta font-semibold text-strong">
                  {file.name}
                </p>
                <p className="font-mono text-[10.5px] text-muted tabular-nums">
                  {formatNumber(Math.max(1, Math.round(file.size / 1024)))} KB
                </p>
              </>
            ) : (
              <p className="text-meta text-muted">
                Faylni shu yerga tashlang yoki tanlang
              </p>
            )}
          </div>
          {file ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              aria-label={`${label} — olib tashlash`}
              className="group/x grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
            >
              <X className="size-4 transition-transform duration-300 ease-out-expo group-hover/x:rotate-90" />
            </button>
          ) : null}
          <label
            htmlFor={id}
            className="inline-flex h-8 cursor-pointer items-center rounded-md bg-[var(--surface)] px-3 text-micro font-semibold text-brand-600 shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:shadow-[var(--shadow-raise)] active:scale-[0.97] dark:bg-white/[0.05] dark:text-brand-300"
          >
            Tanlash
          </label>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </div>
      )}
    </Field>
  );
}

function PlanView({ plan, done }: { plan: BoilerImportPlan; done: boolean }) {
  const t = plan.totals;
  return (
    <div className="flex flex-col gap-3">
      {done && plan.result ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-ok-50 px-3 py-2.5 text-meta text-ok-700 ring-1 ring-ok-200 dark:bg-ok-500/10 dark:text-ok-300 dark:ring-ok-500/25">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Import tugadi: {formatNumber(plan.result.organizationsCreated)} ta
            muassasa va {formatNumber(plan.result.boilersCreated)} ta qozonxona
            qo‘shildi.
            {plan.archived && plan.archived.length > 0
              ? ` Asl ${plan.archived.length === 1 ? 'fayl' : 'fayllar'} arxivga saqlandi.`
              : ''}
          </span>
        </div>
      ) : null}

      <p className="text-meta text-muted">
        <span className="font-medium text-strong">{plan.fileName}</span>
        {plan.date ? ` · ${formatDateUz(plan.date)}` : ''} ·{' '}
        {plan.district.name}
      </p>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          index={0}
          label="Muassasa"
          value={formatNumber(t.institutions)}
          hint={`yangi ${formatNumber(t.newOrganizations)} · mavjud ${formatNumber(t.existingOrganizations)}`}
        />
        <Tile
          index={1}
          label="Qozonxona"
          value={formatNumber(t.boilers)}
          hint={done ? 'rejada edi' : 'yaratiladi'}
        />
        <Tile
          index={2}
          label="Kotyol"
          value={formatNumber(t.units)}
          hint="jami"
        />
        <Tile
          index={3}
          label="Qozonxonasiz"
          value={formatNumber(t.withoutBoiler)}
          hint="markazlashgan va b."
        />
      </dl>

      {plan.warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2 text-micro text-warn-700 ring-1 ring-warn-200 dark:bg-warn-500/10 dark:text-warn-300 dark:ring-warn-500/25"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      <div className="max-h-[320px] overflow-auto rounded-tile ring-1 ring-[var(--border-subtle)]">
        <table className="w-full text-left text-micro">
          <thead className="sticky top-0 z-10 bg-[var(--surface-muted)] text-muted shadow-[inset_0_-1px_0_var(--border-subtle)]">
            <tr>
              <th className="th-mono px-3 py-2">Muassasa</th>
              <th className="th-mono px-3 py-2">Natija</th>
              <th className="th-mono px-3 py-2">Plata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-cell)]">
            {plan.rows.map((row) => (
              <tr
                key={row.excelRow}
                className="transition-colors duration-150 hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]"
              >
                <td className="px-3 py-1.5">
                  <span className="font-medium text-strong">{row.name}</span>
                  {row.organizationId ? (
                    <span className="ml-1.5 rounded-[4px] bg-[var(--surface-sunken)] px-1.5 py-px align-middle font-mono text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase ring-1 ring-[var(--border-subtle)] ring-inset">
                      mavjud
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
                  {row.skipReason ? (
                    <span className="text-muted">{row.skipReason}</span>
                  ) : (
                    <span className="text-strong tabular-nums">
                      {row.boilerCounts.length} qozonxona · kotyol{' '}
                      {row.boilerCounts.join(' + ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 font-mono text-muted">
                  {row.serial ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  /** Ketma-ket paydo bo'lish tartibi. */
  index: number;
}) {
  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className="reveal rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)] ring-inset"
    >
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-1.5">
        <AnimatedNumber value={value} className="figure-display text-[24px]" />
      </dd>
      <dd className="mt-1 truncate text-nano text-faint">{hint}</dd>
    </div>
  );
}
