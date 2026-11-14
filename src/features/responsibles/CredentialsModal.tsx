import { Check, Copy, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
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
        'Issiqlik — qozonxonalar monitoring tizimi',
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
        <div className="flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-meta text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/10 dark:text-warn-300 dark:ring-warn-400/25">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Tizim parolning faqat hash‘ini saqlaydi. Oyna yopilgandan so‘ng uni
            qayta ko‘rish mumkin emas — faqat yangisini generatsiya qilish
            mumkin («Parolni almashtirish»).
          </span>
        </div>

        <dl className="overflow-hidden rounded-lg ring-1 ring-[var(--border-subtle)]">
          <Row label="Tuman" value={value?.districtName ?? ''} />
          <Row label="Mas‘ul" value={value?.fullName ?? ''} />
          <Row label="Login" value={value?.login ?? ''} mono />
          <Row label="Parol" value={value?.password ?? ''} mono strong last />
        </dl>

        <Button
          variant={copied ? 'subtle' : 'secondary'}
          icon={
            copied ? <Check className="size-4" /> : <Copy className="size-4" />
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
        'flex items-center justify-between gap-4 bg-[var(--surface)] px-3 py-2.5',
        !last && 'border-b border-[var(--border-cell)]',
      )}
    >
      <dt className="shrink-0 text-meta text-muted">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right',
          mono && 'font-mono',
          strong
            ? 'text-head font-semibold text-strong'
            : 'text-ui text-strong',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
