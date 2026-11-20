import {
  Menu as MenuRoot,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react';
import { ChevronDown, KeyRound, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { navTitleFor } from '@/shared/constants/nav';
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
 * KONTEKSTNI ushlab turadi: qayerdaman (sarlavha), qaysi tuman
 * bo'yicha ko'ryapman (filtr) va kimman (hisob). Shu tufayli u ingichka
 * (58 px) qoladi va vertikal joyni yemaydi — ekranning qolgani
 * xaritaga va jadvalga tegishli.
 *
 * ⚠️ `sticky`: uzun jadvalda pastga tushilganda tuman filtri
 * ko'rinmay qolsa, foydalanuvchi qaysi kesimda turganini unutadi va
 * raqamlarni butun viloyatniki deb o'qiydi.
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

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)]/92 px-3 backdrop-blur-sm sm:px-5">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Menyu"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong lg:hidden"
      >
        <Menu className="size-4.5" />
      </button>

      {/*
        ⚠️ Telefonda sahifa nomi panelda KO'RSATILMAYDI: sahifaning o'zida katta
        sarlavha bor, panelda esa u «Umu…» bo'lib qisqarib, tuman filtrini
        siqib qo'yardi. Bo'shagan joyni filtr egallaydi.
      */}
      <h1 className="hidden min-w-0 flex-1 truncate text-head font-semibold tracking-tight text-strong sm:block">
        {navTitleFor(pathname)}
      </h1>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none">
        {/* ⚠️ Tor ekranda filtr yashirilmaydi, faqat torayadi: u
            ko'rsatkichlarning MA'NOSINI belgilaydi va yashirilsa,
            raqamlar qaysi kesimniki ekani bilinmay qolardi. */}
        <DistrictFilter className="min-w-0 flex-1 sm:w-56 sm:flex-none" />

        <NotificationBell />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Yorug‘ rejim' : 'Qorong‘i rejim'}
          className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
        >
          {theme === 'dark' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>

        <MenuRoot as="div" className="relative">
          <MenuButton className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-[var(--surface-sunken)]">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-micro font-semibold text-white">
              {initials(user?.fullName ?? '?')}
            </span>
            <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
              <span className="max-w-[10rem] truncate text-meta font-medium text-strong">
                {user?.fullName}
              </span>
              <span className="max-w-[10rem] truncate text-nano text-muted">
                {user ? ROLE_LABELS[user.role] : ''}
              </span>
            </span>
            <ChevronDown className="hidden size-3.5 shrink-0 text-faint sm:block" />
          </MenuButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <MenuItems className="absolute right-0 z-40 mt-2 w-60 rounded-card bg-[var(--surface)] p-1.5 shadow-[var(--shadow-pop)] focus:outline-none">
              <div className="px-2.5 pt-1 pb-2">
                <p className="truncate text-ui font-semibold text-strong">
                  {user?.fullName}
                </p>
                <p className="truncate text-micro text-muted">
                  {user ? ROLE_LABELS[user.role] : ''} · {user?.login}
                </p>
              </div>
              <div className="my-1 h-px bg-line" />

              <MenuItem>
                <Link
                  to="/settings/password"
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-meta text-ink transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <KeyRound className="size-4 opacity-70" />
                  Parolni o‘zgartirish
                </Link>
              </MenuItem>

              <MenuItem>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-meta font-medium text-danger-600 transition-colors',
                    'hover:bg-danger-50 dark:hover:bg-danger-500/10',
                  )}
                >
                  <LogOut className="size-4 opacity-80" />
                  Chiqish
                </button>
              </MenuItem>
            </MenuItems>
          </Transition>
        </MenuRoot>
      </div>
    </header>
  );
}
