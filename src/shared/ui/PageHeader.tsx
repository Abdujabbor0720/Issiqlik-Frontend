import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_GROUP_LABELS, NAV_ITEMS } from '@/shared/constants/nav';
import { cn } from '@/shared/utils/cn';

/**
 * SAHIFA SARLAVHASI — har bo'limning «muhri».
 *
 * ⚠️ BITTA komponent, har sahifada qo'lda yozilgan `<h1>` EMAS: ilgari
 * 17 ta sahifada sarlavha 17 marta nusxalangan edi va bittasida o'lcham
 * o'zgarsa, bo'limlar orasida yurganda sarlavha «sakrab» turardi.
 *
 * ⚠️ Sahifadagi YAGONA `<h1>` shu yerda. Yuqori panel sarlavha emas,
 * yo'l ko'rsatkichi (breadcrumb) chiqaradi — ekran o'quvchisi uchun
 * bitta sahifada ikkita h1 bo'lmasligi kerak.
 *
 * Yorliq (eyebrow) berilmasa — menyu guruhi va bo'lim raqami
 * («KUZATUV · 05»): operator qaysi bo'limda turganini ko'z qirrasi
 * bilan ko'radi.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  leading,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Sarlavha chapidagi element — masalan «orqaga» tugmasi. */
  leading?: ReactNode;
  className?: string;
}) {
  const { pathname } = useLocation();

  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0 pt-5">{leading}</div> : null}
        <div className="min-w-0">
          <div className="label-eyebrow flex items-center gap-2.5">
            <span
              aria-hidden
              className="thermal-line h-[3px] w-6 shrink-0 rounded-full"
            />
            <span className="truncate">
              {eyebrow ?? defaultEyebrow(pathname)}
            </span>
          </div>
          <h1 className="title-display mt-2 text-[25px] break-words sm:text-title">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-1.5 text-meta text-muted">{subtitle}</div>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

function defaultEyebrow(pathname: string): string {
  const matches = NAV_ITEMS.map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
    )
    .sort((a, b) => b.item.to.length - a.item.to.length);
  const hit = matches[0];
  if (!hit) return 'Andijon viloyati';
  return `${NAV_GROUP_LABELS[hit.item.group]} · ${String(hit.index + 1).padStart(2, '0')}`;
}
