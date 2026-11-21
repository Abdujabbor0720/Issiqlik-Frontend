import type { ReactNode } from 'react';
import type { BoilerStatus } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';

export function Badge({
  children,
  className,
  dot,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-micro font-semibold whitespace-nowrap',
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', dot)} /> : null}
      {children}
    </span>
  );
}

/**
 * KOTYOL HOLATI YORLIG'I.
 *
 * ⚠️ Rang YOLG'IZ ishlatilmaydi — har doim MATN bilan birga. Rangni
 * ajrata olmaydigan foydalanuvchi (erkaklarning ~8%) uchun yashil va
 * qizil doira bir xil ko'rinadi va «ishlayapti / ishlamayapti» degan
 * eng muhim farq yo'qolardi.
 */
export function StatusBadge({
  status,
  short,
  className,
}: {
  status: BoilerStatus;
  short?: boolean;
  className?: string;
}) {
  const meta = BOILER_STATUS[status];
  return (
    <Badge className={cn(meta.chip, className)} dot={meta.dot}>
      {short ? meta.short : meta.label}
    </Badge>
  );
}

/** Holat nuqtasi — jadval katagi kabi tor joylar uchun. */
export function StatusDot({
  status,
  className,
}: {
  status: BoilerStatus;
  className?: string;
}) {
  const meta = BOILER_STATUS[status];
  return (
    <span
      title={meta.label}
      className={cn('inline-block size-2 shrink-0 rounded-full', meta.dot, className)}
    />
  );
}
