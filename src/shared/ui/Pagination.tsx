import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/shared/api/types';
import { formatNumber } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';

/**
 * SAHIFALASH.
 *
 * ⚠️ Raqamli tugmalar ro'yxati YO'Q («1 2 3 … 47»). Bu ro'yxatlar
 * holat bo'yicha filtrlanadi va foydalanuvchi 23-sahifaga aniq
 * sakramaydi — u «keyingisi» bosadi yoki filtrni toraytiradi.
 * Raqamli tugmalar esa tor ekranda ikkinchi qatorga tushib,
 * jadval pastida ikki qavatli boshqaruv hosil qilardi.
 */
export function Pagination({
  meta,
  onPage,
  className,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
  className?: string;
}) {
  if (meta.total === 0) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-[var(--border-cell)] px-5 py-3',
        className,
      )}
    >
      <p className="mono text-micro text-muted" data-numeric>
        {formatNumber(from)}–{formatNumber(to)} / {formatNumber(meta.total)} ta
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(meta.page - 1)}
          disabled={!meta.hasPrev}
          aria-label="Oldingi sahifa"
          className="grid size-8 place-items-center rounded-md text-muted ring-1 ring-[var(--border-subtle)] ring-inset transition-[background-color,color,transform] hover:bg-[var(--surface-sunken)] hover:text-strong active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="mono px-2 text-micro font-semibold text-strong" data-numeric>
          {meta.page} / {meta.totalPages || 1}
        </span>

        <button
          type="button"
          onClick={() => onPage(meta.page + 1)}
          disabled={!meta.hasNext}
          aria-label="Keyingi sahifa"
          className="grid size-8 place-items-center rounded-md text-muted ring-1 ring-[var(--border-subtle)] ring-inset transition-[background-color,color,transform] hover:bg-[var(--surface-sunken)] hover:text-strong active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
