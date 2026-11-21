import {
  Menu as MenuRoot,
  MenuButton,
  MenuItem,
  MenuItems,
} from '@headlessui/react';
import { ChevronDown, KeyRound, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  NAV_GROUP_LABELS,
  NAV_ITEMS,
  navTitleFor,
} from '@/shared/constants/nav';
import { ROLE_LABELS } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';
import { initials } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { DistrictFilter } from './DistrictFilter';
import { NotificationBell } from './NotificationBell';

/**
 * YUQORI PANEL.
 *
 * ⚠️ Menyu bu yerda EMAS — u chap yon panelda. Bu panel faqat
 * KONTEKSTNI ushlab turadi: qayerdaman (yo'l ko'rsatkichi), qaysi tuman
 * bo'yicha ko'ryapman (filtr), hozir soat nechchi va kimman (hisob).
 *
 * ⚠️ Sahifa nomi bu yerda `<h1>` EMAS: sarlavha sahifaning o'zida
 * (`PageHeader`). Ikkita h1 ekran o'quvchisini chalg'itardi.
 *
 * ⚠️ `sticky`: uzun jadvalda pastga tushilganda tuman filtri
 * ko'rinmay qolsa, foydalanuvchi qaysi kesimda turganini unutadi.
 *
 * ⚠️ Pastki chetidagi TERMAL chiziq — tizim imzosi; juda sekin oqadi
 * (9 s) va xira, diqqatni tortmaydi.
 */
export function TopBar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  const group = groupFor(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-5">
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-[var(--border-subtle)]"
      />
      <span
        aria-hidden
        className="thermal-line absolute bottom-0 left-0 h-px w-full opacity-50 dark:opacity-70"
      />

      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Menyu"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-[var(--border-subtle)] transition-colors ring-inset hover:bg-[var(--surface-sunken)] hover:text-strong lg:hidden"
      >
        <Menu className="size-4.5" />
      </button>

      {/*
        ⚠️ Telefonda yo'l ko'rsatkichi KO'RSATILMAYDI: sahifaning o'zida
        katta sarlavha bor, panelda esa u qisqarib, tuman filtrini siqardi.
      */}
      <nav
        aria-label="Joylashuv"
        className="hidden min-w-0 flex-1 items-center gap-2 sm:flex"
      >
        <span className="label-eyebrow hidden md:inline">Andijon</span>
        <span aria-hidden className="hidden text-faint md:inline">
          /
        </span>
        {group ? (
          <>
            <span className="label-eyebrow">{group}</span>
            <span aria-hidden className="text-faint">
              /
            </span>
          </>
        ) : null}
        {/* ⚠️ Sahifa nomi bu yerda MAYDA monoshriftda: katta sarlavha
            sahifaning o'zida (`PageHeader`), ikkalasi bir xil o'lchamda
            bo'lsa, nom 100 px ichida ikki marta «qichqirardi». */}
        <span className="label-eyebrow truncate !text-strong">
          {navTitleFor(pathname)}
        </span>
      </nav>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none">
        <LiveClock />

        {/* ⚠️ Tor ekranda filtr yashirilmaydi, faqat torayadi: u
            ko'rsatkichlarning MA'NOSINI belgilaydi. */}
        <DistrictFilter className="min-w-0 flex-1 sm:w-56 sm:flex-none" />

        <NotificationBell />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Yorug‘ rejim' : 'Qorong‘i rejim'}
          className="group relative grid size-9 place-items-center overflow-hidden rounded-lg text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
        >
          <Sun
            className={cn(
              'absolute size-4 transition-all duration-500 ease-out-expo',
              theme === 'dark'
                ? 'rotate-0 scale-100 opacity-100'
                : 'rotate-90 scale-50 opacity-0',
            )}
          />
          <Moon
            className={cn(
              'absolute size-4 transition-all duration-500 ease-out-expo',
              theme === 'dark'
                ? '-rotate-90 scale-50 opacity-0'
                : 'rotate-0 scale-100 opacity-100',
            )}
          />
        </button>

        <MenuRoot as="div" className="relative">
          <MenuButton className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-[var(--surface-sunken)] data-open:bg-[var(--surface-sunken)]">
            <span className="relative grid size-8 shrink-0 place-items-center rounded-md bg-linear-to-br from-brand-500 to-brand-800 font-mono text-[11px] font-bold tracking-wide text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]">
              {initials(user?.fullName ?? '?')}
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-ok-400 ring-2 ring-[var(--surface)]"
              />
            </span>
            <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
              <span className="max-w-[10rem] truncate text-meta font-semibold text-strong">
                {user?.fullName}
              </span>
              <span className="max-w-[10rem] truncate text-nano text-muted">
                {user ? ROLE_LABELS[user.role] : ''}
              </span>
            </span>
            <ChevronDown className="hidden size-3.5 shrink-0 text-faint transition-transform duration-300 ease-out-expo in-data-open:rotate-180 sm:block" />
          </MenuButton>

          <MenuItems
            transition
            className="absolute right-0 z-40 mt-2 w-64 origin-top-right overflow-hidden rounded-card bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)] transition duration-200 ease-out-expo focus:outline-none data-closed:-translate-y-1 data-closed:scale-95 data-closed:opacity-0"
          >
            <span
              aria-hidden
              className="thermal-line absolute inset-x-0 top-0 h-[2px]"
            />
            <div className="px-2.5 pt-2 pb-2.5">
              <p className="truncate text-ui font-semibold text-strong">
                {user?.fullName}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted">
                {user ? ROLE_LABELS[user.role] : ''} · {user?.login}
              </p>
            </div>
            <div className="my-1 h-px bg-line" />

            <MenuItem>
              <Link
                to="/settings/password"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-meta text-ink transition-colors data-focus:bg-[var(--surface-sunken)] data-focus:text-strong"
              >
                <KeyRound className="size-4 opacity-70" />
                Parolni o‘zgartirish
              </Link>
            </MenuItem>

            <MenuItem>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-meta font-semibold text-danger-600 transition-colors data-focus:bg-danger-50 dark:text-danger-300 dark:data-focus:bg-danger-500/10"
              >
                <LogOut className="size-4 opacity-80" />
                Chiqish
              </button>
            </MenuItem>
          </MenuItems>
        </MenuRoot>
      </div>
    </header>
  );
}

function groupFor(pathname: string): string | null {
  const hit = NAV_ITEMS.filter((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  ).sort((a, b) => b.to.length - a.to.length)[0];
  return hit ? NAV_GROUP_LABELS[hit.group] : null;
}

/**
 * TOSHKENT VAQTI — nazorat pulti soati.
 *
 * ⚠️ Toshkent (+5), brauzer mintaqasi EMAS: operator boshqa mintaqadagi
 * noutbukdan kirsa ham, ekrandagi «yangilandi 14:30» bilan soat bir
 * xil vaqt tizimida bo'lishi kerak. Faqat `HH:mm` (sana qoidasi),
 * ikki nuqta sekundiga bir «tepadi» — soat jonli ekani ko'rinadi.
 *
 * ⚠️ Holat har 15 soniyada yangilanadi (har soniyada emas): daqiqa
 * almashishini kechiktirmasdan, keraksiz renderlarni 15 baravar kamaytiradi.
 */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const hh = String(tashkent.getUTCHours()).padStart(2, '0');
  const mm = String(tashkent.getUTCMinutes()).padStart(2, '0');

  return (
    <div
      className="mr-1 hidden items-center gap-2 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1.5 ring-1 ring-[var(--border-subtle)] ring-inset xl:flex"
      title="Toshkent vaqti"
    >
      <span className="relative flex size-1.5" aria-hidden>
        <span className="live-ping absolute inset-0 rounded-full bg-ok-400" />
        <span className="relative size-1.5 rounded-full bg-ok-400" />
      </span>
      <time className="font-mono text-[12px] font-semibold text-strong tabular-nums">
        {hh}
        <span className="clock-colon">:</span>
        {mm}
      </time>
      <span className="label-eyebrow !tracking-[0.1em]">TSH</span>
    </div>
  );
}
