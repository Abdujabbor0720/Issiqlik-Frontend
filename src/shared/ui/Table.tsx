import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * JADVAL — sodda, uslubli qobiq.
 *
 * ⚠️ «Universal jadval komponenti» (ustun ta'riflari, generiklar,
 * renderer'lar) ATAYLAB yozilmadi. Bu loyihada beshta jadval bor va
 * ularning har biri boshqacha: biri holat nuqtasi bilan, biri
 * progress chizig'i bilan, biri ichma-ich tugmalar bilan. Universal
 * komponent ularning hammasini qamrab olish uchun o'nta `prop` olardi
 * va uni o'qish oddiy `<td>` dan qiyinroq bo'lardi.
 */
export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    /* ⚠️ Gorizontal aylantirish O'RAM da: `overflow-x` to'g'ridan-to'g'ri
       `<table>` ga qo'yilsa, sarlavha yopishib turishi (`sticky`)
       ishlamay qoladi. */
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[720px] border-collapse text-ui">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      className={cn(
        /* ⚠️ Sarlavha YOPISHIB turadi (`sticky`): uzun ro'yxatda
           pastga tushganda ustun nomlari ko'rinmay qolsa, raqamlar
           ma'nosini yo'qotadi. */
        'th-mono sticky top-0 z-10 bg-[var(--surface-muted)] px-3 py-2.5 whitespace-nowrap text-muted shadow-[inset_0_-1px_0_var(--border-subtle)]',
        'first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
  colSpan,
  style,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
  /** ⚠️ Faqat DINAMIK rang uchun (holat hex'i): Tailwind sinfini
   *  shablondan yig'ib bo'lmaydi — u CSS ga tushmaydi. */
  style?: CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      style={style}
      className={cn(
        'px-3 py-2.5 align-middle text-body first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-t border-[var(--border-cell)] transition-[background-color,box-shadow] duration-150',
        onClick &&
          'cursor-pointer hover:bg-[var(--surface-muted)] hover:shadow-[inset_3px_0_0_var(--color-brand-500)] dark:hover:bg-white/[0.025]',
        className,
      )}
    >
      {children}
    </tr>
  );
}
