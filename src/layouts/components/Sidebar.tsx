import { useQuery } from '@tanstack/react-query';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { getPaged } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { Alert } from '@/shared/api/types';
import { BRAND } from '@/shared/constants/brand';
import {
  NAV_GROUP_LABELS,
  NAV_ITEMS,
  type NavItem,
} from '@/shared/constants/nav';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { Logo } from './Logo';

/**
 * CHAP YON PANEL.
 *
 * ⚠️⚠️ To'q ko'k («rail»), oq EMAS. Kontent maydoni och kulrang va
 * oq kartalardan iborat; yon panel ham oq bo'lsa, u kontentga singib
 * ketib, «qayergacha menyu, qayerdan sahifa» degan chegara
 * yo'qolardi. To'q panel esa ekranni ikki aniq zonaga bo'ladi va
 * login sahifasining chap paneli bilan bitta brendda qoladi.
 *
 * ⚠️ YIG'ILGAN holatda faqat ikonka qoladi (68 px) va har biriga
 * `title` qo'yiladi — usiz yig'ilgan menyu «nimaga bosayotganini
 * bilmaydigan» ikonkalar qatoriga aylanardi.
 */
export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const can = useAuthStore((state) => state.can);
  const collapsed = useUiStore((state) => state.railCollapsed);
  const toggleRail = useUiStore((state) => state.toggleRail);

  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );
  const groups: Array<NavItem['group']> = ['main', 'manage'];

  /*
   * ⚠️ Ochiq ogohlantirishlar soni MENYUDA ko'rsatiladi. Faqat
   * «Ogohlantirishlar» sahifasida bo'lsa, operator u yerga
   * kirmaguncha muammodan bexabar qolardi — holbuki tizimning butun
   * maqsadi aynan shu xabarni yetkazish.
   */
  const { data: alerts } = useQuery({
    queryKey: qk.alerts({ badge: true }),
    queryFn: () =>
      getPaged<Alert>(API.alerts.list, {
        params: { limit: 1, states: 'open' },
      }),
    enabled: can('alerts.view'),
    refetchInterval: 60_000,
  });
  const openAlerts = alerts?.meta.total ?? 0;

  return (
    <>
      {/* Mobil qoplama */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Menyuni yopish"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-neutral-950/50 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-rail-900 transition-[width,transform] duration-200',
          collapsed ? 'w-rail-tight' : 'w-rail',
          // ⚠️ Mobilda panel SURILIB chiqadi; `hidden` ishlatilmaydi,
          // chunki `hidden` da o'tish animatsiyasi bo'lmaydi va menyu
          // «sakrab» paydo bo'lardi.
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ───── Logotip ───── */}
        <div
          className={cn(
            'flex h-topbar shrink-0 items-center gap-2 border-b border-white/8',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <NavLink to="/" onClick={onCloseMobile} className="min-w-0">
            {collapsed ? <Logo size="sm" withText={false} /> : <RailLogo />}
          </NavLink>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Yopish"
            className="ml-auto grid size-8 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ───── Menyu ───── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {groups.map((group) => {
            const items = visible.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className="mb-4 last:mb-0">
                {/* ⚠️ Guruh sarlavhasi yig'ilgan holatda YOZILMAYDI,
                    o'rniga nozik chiziq qoladi: 68 px ga «BOSHQARUV»
                    so'zi sig'maydi va u kesilib ko'rinardi. */}
                {collapsed ? (
                  <div className="mx-2 mb-2 h-px bg-white/8" />
                ) : (
                  <p className="mb-1.5 px-2.5 text-nano font-semibold tracking-wider text-white/35 uppercase">
                    {NAV_GROUP_LABELS[group]}
                  </p>
                )}

                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center rounded-lg text-meta font-medium transition-colors',
                            collapsed
                              ? 'h-10 justify-center'
                              : 'h-9.5 gap-2.5 px-2.5',
                            isActive
                              ? 'bg-brand-600 text-white shadow-[var(--shadow-brand)]'
                              : 'text-white/65 hover:bg-white/8 hover:text-white',
                          )
                        }
                      >
                        <item.icon
                          className="size-4 shrink-0"
                          strokeWidth={2}
                        />
                        {!collapsed ? (
                          <span className="flex-1 truncate">{item.label}</span>
                        ) : null}

                        {item.to === '/alerts' && openAlerts > 0 ? (
                          <span
                            className={cn(
                              'grid min-w-[18px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] leading-[18px] font-semibold text-white',
                              // Yig'ilgan holatda belgi ikonka ustida
                              collapsed &&
                                'absolute top-1 right-1 min-w-[16px] leading-4',
                            )}
                          >
                            {openAlerts > 99 ? '99+' : openAlerts}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ───── Yig'ish tugmasi ───── */}
        <div className="shrink-0 border-t border-white/8 p-2">
          <button
            type="button"
            onClick={toggleRail}
            aria-label={collapsed ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            title={collapsed ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            className={cn(
              'hidden h-9 w-full items-center rounded-lg text-meta font-medium text-white/55 transition-colors hover:bg-white/8 hover:text-white lg:flex',
              collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
            )}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" />
                Menyuni yig‘ish
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

/** To'q fon uchun logotip — matn oq. */
function RailLogo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-white/10 ring-1 ring-white/15">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path
            d="M12 3c.5 2.6-.9 3.7-2.1 4.9C8.6 9.1 7.4 10.3 7.4 12.6A4.6 4.6 0 0 0 12 17.2a4.6 4.6 0 0 0 4.6-4.6c0-1.8-.7-2.9-1.5-4-.2.8-.7 1.4-1.4 1.7.3-2.7-.8-4.8-3.3-6.4"
            fill="#ffb454"
            transform="translate(1 1) scale(0.92)"
          />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-lede font-semibold tracking-tight text-white">
          {BRAND.short}
        </span>
        <span className="mt-0.5 truncate text-nano font-medium tracking-wide text-white/45 uppercase">
          {BRAND.scope}
        </span>
      </span>
    </span>
  );
}
