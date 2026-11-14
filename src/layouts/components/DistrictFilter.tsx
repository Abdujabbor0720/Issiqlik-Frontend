import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Globe2, MapPin, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { DistrictOption } from '@/shared/api/types';
import { cn } from '@/shared/utils/cn';
import { useFiltersStore } from '@/store/filters.store';

/** «Umumiy» variantining qiymati — `null` ni `Listbox` ga berish noqulay. */
const ALL = '__all__';

/**
 * TUMAN FILTRI — butun ilova uchun UMUMIY, BITTA tanlov.
 *
 * ⚠️⚠️ Yuqori panelda turadi, har sahifada alohida emas: filtr
 * xaritada, dashboard'da, kotyollar ro'yxatida va hisobotda BITTA
 * bo'lishi kerak. Foydalanuvchi xaritada Jalaquduqni tanlab, ro'yxatga
 * o'tganda butun viloyatni ko'rsa, buni tizim xatosi deb o'qiydi.
 *
 * ⚠️ BITTA tuman tanlanadi, ko'p emas (biznes qarori). Birinchi variant
 * — «Umumiy (butun viloyat)», u har doim ro'yxat BOSHIDA va ajratgich
 * bilan ajratilgan: «hammasini bekor qilish» eng ko'p ishlatiladigan
 * amal va u qidiruvsiz, bitta bosishda bajarilishi kerak.
 */
export function DistrictFilter({ className }: { className?: string }) {
  const districtId = useFiltersStore((state) => state.districtId);
  const setDistrict = useFiltersStore((state) => state.setDistrict);
  const [search, setSearch] = useState('');

  const { data: districts = [] } = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    // ⚠️ Tumanlar ro'yxati amalda o'zgarmaydi — bekorga qayta
    // so'ralmasin. 1 soat sessiyadan qisqa, lekin yetarlicha uzoq.
    staleTime: 60 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return districts;
    return districts.filter((item) => item.name.toLowerCase().includes(query));
  }, [districts, search]);

  const selected = districts.find((item) => item.id === districtId) ?? null;

  /*
   * ⚠️ Operatorga (tuman mas'uli) faqat BITTA tuman ko'rinadi — server
   * ro'yxatni allaqachon toraytirgan (`applyDistrictScope`). Bunday
   * holatda filtr BOSHQARUV emas, YORLIQ bo'lib qoladi: tanlashga
   * variant yo'q va ochiladigan ro'yxat faqat chalg'itardi.
   */
  const locked = districts.length === 1;

  if (locked) {
    return (
      <span
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-meta font-medium text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-500/25',
          className,
        )}
        title="Hisobingizga biriktirilgan tuman"
      >
        <MapPin className="size-3.5" />
        {districts[0].shortName}
      </span>
    );
  }

  return (
    <Listbox
      value={districtId ?? ALL}
      onChange={(value: string) => {
        setDistrict(value === ALL ? null : value);
        setSearch('');
      }}
    >
      <div className={cn('relative', className)}>
        <ListboxButton
          className={cn(
            'inline-flex h-8 w-full items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-colors',
            selected
              ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-500/25'
              : 'text-muted ring-1 ring-[var(--border-strong)] hover:text-strong',
          )}
        >
          {selected ? (
            <MapPin className="size-3.5 shrink-0" />
          ) : (
            <Globe2 className="size-3.5 shrink-0" />
          )}
          <span className="flex-1 truncate text-left">
            {selected ? selected.name : 'Umumiy — butun viloyat'}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </ListboxButton>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="opacity-0 -translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-card bg-[var(--surface)] shadow-[var(--shadow-pop)] focus:outline-none">
            {/* ⚠️ Qidiruv maydoni `ListboxOption` EMAS: aks holda
                strelka bilan yurganda u ham «variant» bo'lib
                tanlanardi. Klaviatura hodisalari to'xtatiladi —
                `Listbox` harf bosilishini «variantga sakrash» deb
                o'qib, maydondan fokusni olib qo'yardi. */}
            <div className="p-2.5" onKeyDown={(event) => event.stopPropagation()}>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tuman qidirish…"
                  className="h-8 w-full rounded-md bg-[var(--surface-sunken)] pr-2.5 pl-8 text-meta text-strong ring-1 ring-transparent placeholder:text-faint focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
              {/* «Umumiy» — har doim BIRINCHI va qidiruvga bog'liq emas. */}
              <Option value={ALL} icon={<Globe2 className="size-3.5" />}>
                Umumiy — butun viloyat
              </Option>

              <div className="my-1 h-px bg-line" />

              {filtered.map((district) => (
                <Option key={district.id} value={district.id}>
                  {district.name}
                </Option>
              ))}

              {filtered.length === 0 ? (
                <p className="px-2.5 py-6 text-center text-meta text-muted">
                  Topilmadi
                </p>
              ) : null}
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

function Option({
  value,
  children,
  icon,
}: {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <ListboxOption value={value}>
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
          <span className="flex min-w-0 items-center gap-1.5">
            {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
            <span className="truncate">{children}</span>
          </span>
          {selected ? <Check className="size-3.5 shrink-0" /> : null}
        </div>
      )}
    </ListboxOption>
  );
}
