import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Fragment } from 'react';
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
        className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors outline-none hover:bg-[var(--surface-sunken)] hover:text-strong"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 min-w-4 rounded-full bg-danger-500 px-1 text-[10px] leading-4 font-bold text-white tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <PopoverPanel className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-card bg-[var(--surface)] shadow-[var(--shadow-pop)]">
          {({ close }) => (
            <>
              <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
                <p className="text-ui font-semibold text-strong">
                  XAVF ogohlantirishlari
                </p>
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => readAll.mutate()}
                    className="inline-flex items-center gap-1 text-micro font-medium text-brand-600"
                  >
                    <CheckCheck className="size-3.5" />
                    Hammasi o‘qildi
                  </button>
                ) : null}
              </div>
              <div className="h-px bg-line" />
              {items.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-meta text-muted">
                  Hozircha ogohlantirish yo‘q
                </p>
              ) : (
                <ul className="max-h-96 overflow-y-auto py-1">
                  {items.map((item) => {
                    const Icon = INCIDENT_KIND[item.kind]?.icon ?? Bell;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.readAt) readOne.mutate(item.id);
                            close();
                            navigate(`/incidents/${item.incidentId}`);
                          }}
                          className={cn(
                            'flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]',
                            !item.readAt &&
                              'bg-brand-50/50 dark:bg-brand-500/6',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
                              item.severity === 'critical'
                                ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/12'
                                : 'bg-warn-50 text-warn-600 dark:bg-warn-400/12',
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-meta font-medium text-strong">
                              {item.title}
                            </span>
                            <span className="text-micro text-faint">
                              №{item.number}
                              {item.level > 0
                                ? ` · eskalatsiya ${item.level}-daraja`
                                : ''}{' '}
                              · {formatRelativeUz(item.createdAt)}
                            </span>
                          </span>
                          {!item.readAt ? (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
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
                className="w-full px-3.5 py-2.5 text-center text-meta font-medium text-brand-600 hover:bg-[var(--surface-sunken)]"
              >
                Barcha XAVF →
              </button>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
