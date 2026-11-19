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
          <ListboxButton
            aria-label="Obyekt turi bo‘yicha"
            className={cn(
              'inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-colors',
              value.length > 0
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-500/25'
                : 'text-muted ring-1 ring-[var(--border-strong)] hover:text-strong',
            )}
          >
            <Shapes className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </ListboxButton>

          <ListboxOptions
            anchor="bottom end"
            className="z-40 max-h-72 w-64 overflow-y-auto rounded-card [--anchor-gap:0.5rem] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)] focus:outline-none"
          >
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
                      'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-meta transition-colors',
                      selected
                        ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/12 dark:text-brand-300'
                        : focus
                          ? 'bg-[var(--surface-sunken)] text-strong'
                          : 'text-ink',
                    )}
                  >
                    <span className="truncate">{type.name}</span>
                    {selected ? <Check className="size-3.5 shrink-0" /> : null}
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
          className="grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
