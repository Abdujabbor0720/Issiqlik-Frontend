import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, CheckCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { http, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { NotificationsPage } from '@/shared/api/types';
import { INCIDENT_KIND } from '@/shared/constants/incident';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { useAuthStore } from '@/store/auth.store';

const PARAMS = { limit: 8 };

/**
 * SHAXSIY XAVF OGOHLANTIRISHLARI — yuqori paneldagi qo'ng'iroqcha.
 *
 * ⚠️ Bu — SHU FOYDALANUVCHIGA yuborilganlar (`incident_notifications`):
 * javobgar, tuman/tashkilot mas'uli, eskalatsiyada viloyat. Faqat soket
 * xabari bo'lsa, brauzeri yopiq turgan mas'ul hech narsa bilmasdi; bu
 * ro'yxat esa u kirganda «o'qilmagan» bo'lib kutadi.
 */
export function NotificationBell() {
  const can = useAuthStore((state) => state.can);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const enabled = can('incidents.view');

  const query = useQuery({
    queryKey: qk.notifications(PARAMS),
    queryFn: async (): Promise<NotificationsPage> => {
      // ⚠️ `getPaged` emas: `meta.unread` (o'qilmaganlar soni) kerak.
      const { data } = await http.get<{
        data: NotificationsPage['items'];
        meta: NotificationsPage['meta'];
      }>(API.incidents.myNotifications, { params: PARAMS });
      return { items: data.data, meta: data.meta };
    },
    enabled,
    refetchInterval: 60_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['incidentNotifications'] });

  const readOne = useMutation({
    mutationFn: (id: string) => post(API.incidents.readNotification(id)),
    onSuccess: () => void invalidate(),
  });
  const readAll = useMutation({
    mutationFn: () => post(API.incidents.readAllNotifications),
    onSuccess: () => void invalidate(),
  });

  if (!enabled) return null;
  const unread = query.data?.meta.unread ?? 0;
  const items = query.data?.items ?? [];

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={
          unread > 0
            ? `XAVF ogohlantirishlari, ${unread} ta o‘qilmagan`
            : 'XAVF ogohlantirishlari'
        }
        className="group relative grid size-9 place-items-center rounded-lg text-muted transition-colors outline-none hover:bg-[var(--surface-sunken)] hover:text-strong data-open:bg-[var(--surface-sunken)] data-open:text-strong"
      >
        {/* ⚠️ Qo'ng'iroq sichqoncha ostida bir marta «chayqaladi» — faqat
            `transform`, tinmay tebranib turmaydi (nazorat ekranida asabiy
            ko'rinardi). */}
        <Bell
          className={cn(
            'size-4 origin-top transition-transform duration-500 ease-out-expo group-hover:-rotate-12',
            unread > 0 && 'text-strong',
          )}
        />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex">
            {/* Jonli to'lqin — o'qilmagan bor ekanini ko'z qirrasi bilan.
                ⚠️ Nishondan KICHIK o'zakdan tarqaladi: `live-ping` 2.8×
                kattalashadi va to'liq o'lchamda qizil dog' bo'lib ketardi. */}
            <span aria-hidden className="absolute inset-[4px] opacity-70">
              <span className="live-ping absolute inset-0 rounded-md bg-danger-500" />
            </span>
            <span className="relative min-w-[18px] rounded-md bg-linear-to-b from-danger-400 to-danger-600 px-1 text-center font-mono text-[10px] leading-[18px] font-bold text-white tabular-nums shadow-[0_2px_6px_-1px_rgb(200_54_44/0.6)] ring-2 ring-[var(--surface)]">
              {unread > 99 ? '99+' : unread}
            </span>
          </span>
        ) : null}
      </PopoverButton>

      <PopoverPanel
        transition
        className="absolute right-0 z-40 mt-2 w-[23rem] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-card bg-[var(--surface)] shadow-[var(--shadow-pop)] transition duration-200 ease-out-expo focus:outline-none data-closed:-translate-y-1 data-closed:scale-95 data-closed:opacity-0"
      >
        {({ close }) => (
          <>
            <span
              aria-hidden
              className="thermal-line absolute inset-x-0 top-0 h-[2px]"
            />
            <div className="flex items-end justify-between gap-3 px-3.5 pt-3.5 pb-2.5">
              <div className="min-w-0">
                <p className="label-eyebrow">Shaxsiy ogohlantirishlar</p>
                <p className="mt-0.5 flex items-center gap-2 font-display text-[15px] font-[720] tracking-[-0.012em] text-strong [font-stretch:106%]">
                  XAVF
                  {unread > 0 ? (
                    <span className="rounded-md bg-danger-50 px-1.5 font-mono text-[10.5px] leading-5 font-bold text-danger-600 tabular-nums ring-1 ring-danger-200 ring-inset dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30">
                      {unread} o‘qilmagan
                    </span>
                  ) : null}
                </p>
              </div>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => readAll.mutate()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-micro font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-400/12"
                >
                  <CheckCheck className="size-3.5" />
                  Hammasi o‘qildi
                </button>
              ) : null}
            </div>
            <div className="h-px bg-line" />
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3.5 py-8 text-center">
                <span className="grid size-10 place-items-center rounded-lg bg-[var(--surface-sunken)] text-faint ring-1 ring-[var(--border-subtle)] ring-inset">
                  <Bell className="size-4" />
                </span>
                <p className="text-meta text-muted">
                  Hozircha ogohlantirish yo‘q
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto p-1.5">
                {items.map((item, index) => {
                  const Icon = INCIDENT_KIND[item.kind]?.icon ?? Bell;
                  const critical = item.severity === 'critical';
                  return (
                    <li
                      key={item.id}
                      className="reveal"
                      style={{ '--i': Math.min(index, 8) } as CSSProperties}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.readAt) readOne.mutate(item.id);
                          close();
                          navigate(`/incidents/${item.incidentId}`);
                        }}
                        className={cn(
                          'group/item flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200 hover:bg-[var(--surface-sunken)]',
                          !item.readAt &&
                            'bg-brand-50/60 shadow-[inset_2px_0_0_var(--color-brand-500)] dark:bg-brand-400/[0.07]',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover/item:scale-110',
                            critical
                              ? 'bg-danger-50 text-danger-600 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30'
                              : 'bg-warn-50 text-warn-600 ring-warn-200 dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'line-clamp-2 text-meta text-strong',
                              item.readAt ? 'font-medium' : 'font-semibold',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[10.5px] text-faint">
                            <span className="font-semibold text-muted">
                              №{item.number}
                            </span>
                            {item.level > 0 ? (
                              <span className="text-warn-600 dark:text-warn-300">
                                · eskalatsiya {item.level}-daraja
                              </span>
                            ) : null}
                            <span>· {formatRelativeUz(item.createdAt)}</span>
                          </span>
                        </span>
                        {!item.readAt ? (
                          <span
                            aria-hidden
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500 shadow-[0_0_8px_var(--color-brand-400)]"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="h-px bg-line" />
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/incidents');
              }}
              className="group/all flex w-full items-center justify-center gap-1.5 bg-[var(--surface-muted)] px-3.5 py-2.5 text-meta font-semibold text-brand-600 transition-colors hover:bg-[var(--surface-sunken)] dark:text-brand-300"
            >
              Barcha XAVF
              <ArrowRight className="size-3.5 transition-transform duration-300 ease-out-expo group-hover/all:translate-x-0.5" />
            </button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
