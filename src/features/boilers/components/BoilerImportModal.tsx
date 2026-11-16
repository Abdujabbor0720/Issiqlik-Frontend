import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, postForm } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { BoilerImportPlan, DistrictOption } from '@/shared/api/types';
import { Button, Field, Modal, Select } from '@/shared/ui';
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
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 transition-colors ring-inset',
            file
              ? 'bg-brand-50/60 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
              : 'ring-[var(--border-strong)]',
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            pick(event.dataTransfer.files[0]);
          }}
        >
          <FileSpreadsheet
            className={cn(
              'size-5 shrink-0',
              file ? 'text-brand-600' : 'text-faint',
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {file ? (
              <>
                <p className="truncate text-meta font-medium text-strong">
                  {file.name}
                </p>
                <p className="text-micro text-muted">
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
              className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <label
            htmlFor={id}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-micro font-semibold text-brand-600 ring-1 ring-[var(--border-strong)] transition-colors ring-inset hover:bg-[var(--surface-sunken)]"
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
          label="Muassasa"
          value={formatNumber(t.institutions)}
          hint={`yangi ${formatNumber(t.newOrganizations)} · mavjud ${formatNumber(t.existingOrganizations)}`}
        />
        <Tile
          label="Qozonxona"
          value={formatNumber(t.boilers)}
          hint={done ? 'rejada edi' : 'yaratiladi'}
        />
        <Tile label="Kotyol" value={formatNumber(t.units)} hint="jami" />
        <Tile
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

      <div className="max-h-[320px] overflow-auto rounded-lg ring-1 ring-[var(--border-subtle)]">
        <table className="w-full text-left text-micro">
          <thead className="sticky top-0 bg-[var(--surface-sunken)] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Muassasa</th>
              <th className="px-3 py-2 font-medium">Natija</th>
              <th className="px-3 py-2 font-medium">Plata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {plan.rows.map((row) => (
              <tr key={row.excelRow}>
                <td className="px-3 py-1.5">
                  <span className="font-medium text-strong">{row.name}</span>
                  {row.organizationId ? (
                    <span className="ml-1.5 rounded bg-[var(--surface-sunken)] px-1 text-nano text-muted">
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
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-tile bg-[var(--surface-sunken)] px-3 py-2">
      <dt className="text-micro text-muted">{label}</dt>
      <dd className="text-lede font-semibold text-strong tabular-nums">
        {value}
      </dd>
      <dd className="truncate text-nano text-faint">{hint}</dd>
    </div>
  );
}
