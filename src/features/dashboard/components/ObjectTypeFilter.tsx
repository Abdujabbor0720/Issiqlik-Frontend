import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown, Shapes, X } from 'lucide-react';
import { useObjectTypes } from '@/shared/hooks/useCatalogOptions';
import { cn } from '@/shared/utils/cn';

/**
 * OBYEKT TURI FILTRI — bir nechta tanlov (maktab, bog'cha, …).
 *
 * ⚠️ Bo'sh tanlov = «Barcha turlar» (parametr umuman yuborilmaydi). Ikki
 * xil «bo'sh» qiymat ishlatilmaydi — tuman filtridagi qoida bilan AYNI.
 */
export function ObjectTypeFilter({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const { data: types = [] } = useObjectTypes();
  const selectedNames = types
    .filter((item) => value.includes(item.id))
    .map((item) => item.name);

  const label =
    selectedNames.length === 0
      ? 'Barcha obyekt turlari'
      : selectedNames.length <= 2
        ? selectedNames.join(', ')
        : `${selectedNames.length} ta obyekt turi`;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Listbox value={value} onChange={onChange} multiple>
        <div className="relative">
          {/* ⚠️ Tugma `Button secondary` bilan bir xil «material» (yuza +
              soya), yonidagi «Yangilash» bilan bitta qatorda turadi.
              Filtr yoqilganda BREND tusida va tanlovlar soni monoshriftda:
              «hozir hamma narsa ko'rinyaptimi» degan savolga javob tugmaning
              o'zida. */}
          <ListboxButton
            aria-label="Obyekt turi bo‘yicha"
            className={cn(
              'group inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-md px-3 text-meta font-semibold transition-[background-color,box-shadow,color] duration-200 ease-out-quint',
              value.length > 0
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25'
                : 'bg-[var(--surface)] text-ink shadow-[var(--shadow-card)] hover:bg-[var(--surface-muted)] hover:text-strong hover:shadow-[var(--shadow-raise)] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
            )}
          >
            <Shapes className="size-3.5 shrink-0 opacity-80" />
            <span className="truncate">{label}</span>
            {value.length > 0 ? (
              <span className="rounded-[4px] bg-brand-500/12 px-1 font-mono text-[10px] leading-4 tabular-nums">
                {value.length}
              </span>
            ) : null}
            <ChevronDown className="size-3.5 shrink-0 opacity-60 transition-transform duration-300 ease-out-expo group-data-open:rotate-180" />
          </ListboxButton>

          <ListboxOptions
            anchor="bottom end"
            transition
            className="z-40 max-h-72 w-64 origin-top-right overflow-y-auto rounded-xl [--anchor-gap:0.5rem] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)] transition duration-200 ease-out-expo focus:outline-none data-closed:scale-[0.97] data-closed:opacity-0"
          >
            <p className="label-eyebrow px-2.5 pt-1 pb-1.5">Obyekt turi</p>
            {types.length === 0 ? (
              <p className="px-2.5 py-4 text-center text-meta text-muted">
                Obyekt turlari yo‘q
              </p>
            ) : null}
            {types.map((type) => (
              <ListboxOption key={type.id} value={type.id}>
                {({ selected, focus }) => (
                  <div
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-meta transition-colors duration-150',
                      selected
                        ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-400/12 dark:text-brand-200'
                        : focus
                          ? 'bg-[var(--surface-sunken)] text-strong'
                          : 'text-ink',
                    )}
                  >
                    {/* Belgilash katagi — ko'p tanlovli ro'yxat ekanini
                        birinchi qarashda aytadi. */}
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-[4px] ring-1 ring-inset transition-colors duration-150',
                        selected
                          ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-500 dark:ring-brand-500'
                          : 'bg-[var(--surface)] ring-[var(--border-strong)]',
                      )}
                    >
                      {selected ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="truncate">{type.name}</span>
                  </div>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>

      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label="Obyekt turi filtrini tozalash"
          title="Tozalash"
          className="grid size-8 place-items-center rounded-md text-muted transition-[background-color,color,rotate] duration-300 ease-out-expo hover:rotate-90 hover:bg-[var(--surface-sunken)] hover:text-strong"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
