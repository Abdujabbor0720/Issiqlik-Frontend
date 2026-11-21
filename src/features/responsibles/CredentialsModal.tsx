import { Check, Copy, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BRAND } from '@/shared/constants/brand';
import { Button, Modal } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import type { IssuedCredentials } from './ResponsibleFormModal';

/**
 * LOGIN VA PAROL — BIR MARTA ko'rsatiladigan oyna.
 *
 * ⚠️⚠️ Parol serverda faqat HASH holida saqlanadi: oyna yopilgandan
 * keyin uni tizimdan qayta olib bo'lmaydi, faqat YANGISINI
 * generatsiya qilish mumkin. Shuning uchun oyna aniq ogohlantiradi va
 * nusxalash tugmasi beradi — aks holda admin uni oddiy «saqlandi»
 * xabari deb yopib yuborardi va mas'ul tizimga kira olmasdi.
 *
 * ⚠️ Qiymat FAQAT xotirada: u hech qayerga yozilmaydi, keshlanmaydi
 * va so'rov bilan yuborilmaydi. Oyna yopilishi bilan yo'qoladi.
 */
export function CredentialsModal({
  value,
  onClose,
}: {
  value: IssuedCredentials | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const text = value
    ? [
        BRAND.full,
        `Tuman: ${value.districtName}`,
        `Mas‘ul: ${value.fullName}`,
        `Login: ${value.login}`,
        `Parol: ${value.password}`,
        '',
        'Birinchi kirishdan so‘ng parolni o‘zgartiring:',
        'Profil → Parolni o‘zgartirish',
      ].join('\n')
    : '';

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Nusxalandi');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Nusxalab bo‘lmadi — matnni qo‘lda belgilang');
    }
  };

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      size="md"
      title="Hisob ma‘lumotlari"
      description="Login va parolni mas‘ulga topshiring — parol boshqa ko‘rsatilmaydi"
      footer={
        <Button variant="primary" onClick={onClose}>
          Topshirdim, yopish
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-lg bg-warn-50 px-3 py-2.5 text-meta text-warn-700 shadow-[inset_3px_0_0_var(--color-warn-400)] ring-1 ring-warn-200 ring-inset dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Tizim parolning faqat hash‘ini saqlaydi. Oyna yopilgandan so‘ng uni
            qayta ko‘rish mumkin emas — faqat yangisini generatsiya qilish
            mumkin («Parolni almashtirish»).
          </span>
        </div>

        {/* ⚠️ Hisob ma'lumotlari CHUQUR plastinkada, monoshriftda: login va
            parolni og'zaki yoki qog'ozda topshirishda har bir belgi aniq
            ko'rinishi kerak (mono kenglikda `rn` va `m` chalkashmaydi). */}
        <div className="relative overflow-hidden rounded-card bg-[var(--surface-sunken)] ring-1 ring-[var(--border-subtle)] ring-inset">
          <span
            aria-hidden
            className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(90deg,transparent,#000_70%)]"
          />
          <dl className="relative">
            <Row label="Tuman" value={value?.districtName ?? ''} />
            <Row label="Mas‘ul" value={value?.fullName ?? ''} />
            <Row label="Login" value={value?.login ?? ''} mono />
            <Row label="Parol" value={value?.password ?? ''} mono strong last />
          </dl>
        </div>

        <Button
          variant={copied ? 'subtle' : 'secondary'}
          icon={
            copied ? (
              <Check className="size-4 text-ok-600 dark:text-ok-300" />
            ) : (
              <Copy className="size-4" />
            )
          }
          onClick={() => void copy()}
          className="justify-center"
        >
          {copied ? 'Nusxalandi' : 'Hammasini nusxalash'}
        </Button>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-3.5 py-2.5',
        !last && 'border-b border-[var(--border-subtle)]',
        strong && 'bg-[var(--surface)]/60 py-3 dark:bg-white/[0.03]',
      )}
    >
      <dt className="label-eyebrow shrink-0">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right',
          mono && 'font-mono',
          strong
            ? 'text-[19px] font-bold tracking-[0.06em] text-strong select-all'
            : mono
              ? 'text-ui font-semibold text-strong select-all'
              : 'text-ui font-medium text-strong',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
