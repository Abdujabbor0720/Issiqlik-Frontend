import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleAlert,
  KeyRound,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import toast from 'react-hot-toast';
import { del, errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { DistrictResponsible, User } from '@/shared/api/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmModal,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { initials, orDash } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { CredentialsModal } from './CredentialsModal';
import {
  ResponsibleFormModal,
  type IssuedCredentials,
} from './ResponsibleFormModal';
import { ResetResponsiblePasswordModal } from './ResetResponsiblePasswordModal';

/**
 * TUMAN MAS'ULLARI.
 *
 * ⚠️⚠️ Ro'yxat TUMANLARDAN boshlanadi, foydalanuvchilardan EMAS.
 * Foydalanuvchilar ro'yxati bo'lsa, MAS'ULI YO'Q tuman umuman
 * ko'rinmasdi — holbuki bu ekranning butun maqsadi aynan shu
 * bo'shliqni ko'rsatish: «16 ta tumandan 3 tasida mas'ul yo'q».
 *
 * ⚠️ Mas'ulsiz tumanlar YUQORIDA turadi va ajratib ko'rsatiladi.
 * Alifbo tartibi bo'lsa, ular ro'yxat o'rtasida yo'qolib ketardi.
 */
export function ResponsiblesPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);

  const [formFor, setFormFor] = useState<{
    district: DistrictResponsible;
    user: User | null;
  } | null>(null);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [removing, setRemoving] = useState<{
    user: User;
    districtName: string;
  } | null>(null);

  const query = useQuery({
    queryKey: qk.responsibles,
    queryFn: () => get<DistrictResponsible[]>(API.users.districtResponsibles),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => del(API.users.one(id)),
    onSuccess: () => {
      toast.success('Mas‘ul hisobi o‘chirildi');
      void queryClient.invalidateQueries({ queryKey: ['responsibles'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setRemoving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = query.data ?? [];

  const stats = useMemo(() => {
    const withResponsible = rows.filter((r) => r.responsibles.length > 0);
    const activeCount = rows.reduce(
      (sum, r) => sum + r.responsibles.filter((u) => u.isActive).length,
      0,
    );
    return {
      districts: rows.length,
      covered: withResponsible.length,
      uncovered: rows.length - withResponsible.length,
      accounts: rows.reduce((sum, r) => sum + r.responsibles.length, 0),
      active: activeCount,
    };
  }, [rows]);

  /*
   * ⚠️ Saralash: avval MAS'ULSIZ tumanlar, keyin qolganlari (alifbo
   * bo'yicha). Bu ekran «kimni biriktirish kerak» degan savolga javob
   * beradi va javob ro'yxatning TEPASIDA turishi kerak.
   */
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aEmpty = a.responsibles.length === 0 ? 0 : 1;
        const bEmpty = b.responsibles.length === 0 ? 0 : 1;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;
        return a.name.localeCompare(b.name, 'uz');
      }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Tuman mas‘ullari"
        subtitle="Har bir tuman uchun alohida hisob — mas‘ul faqat o‘z tumanining kotyollari, modullari va ogohlantirishlarini ko‘radi"
      />

      {/* ───── Ko'rsatkichlar ───── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          index={0}
          label="Tumanlar"
          value={String(stats.districts)}
          icon={UserCog}
          tone="brand"
        />
        <StatCard
          index={1}
          label="Mas‘ul biriktirilgan"
          value={String(stats.covered)}
          icon={ShieldCheck}
          tone="ok"
          share={
            stats.districts > 0 ? (stats.covered / stats.districts) * 100 : 0
          }
        />
        <StatCard
          index={2}
          label="Mas‘ul yo‘q"
          value={String(stats.uncovered)}
          icon={CircleAlert}
          tone={stats.uncovered > 0 ? 'danger' : 'idle'}
          hint={
            stats.uncovered > 0 ? 'biriktirish kerak' : 'hammasi qamrab olingan'
          }
        />
        <StatCard
          index={3}
          label="Faol hisoblar"
          value={`${stats.active} / ${stats.accounts}`}
          icon={UserPlus}
          tone="neutral"
        />
      </div>

      {/* ───── Tumanlar ───── */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<UserCog className="size-4" />}
          eyebrow="Hududiy javobgarlik"
          title="Tumanlar bo‘yicha mas‘ullar"
          subtitle="Mas‘ul yo‘q tumanlar ro‘yxat boshida"
        />

        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-96" />
          </CardBody>
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <ul className="flex flex-col">
            {sorted.map((district, index) => {
              const empty = district.responsibles.length === 0;
              return (
                <li
                  key={district.districtId}
                  className="reveal"
                  style={{ '--i': Math.min(index, 12) } as CSSProperties}
                >
                  {index > 0 ? <div className="h-px bg-line" /> : null}
                  {/* ⚠️ Mas'ulsiz tuman CHAP CHETIDAGI qizil chiziq bilan
                      ajraladi (faqat och fon emas): uzun ro'yxatda ko'z
                      fon farqini sezmasdi, chiziq esa ustun bo'lib turadi. */}
                  <div
                    className={cn(
                      'group/row flex flex-wrap items-start gap-3 px-5 py-3.5 transition-[background-color,box-shadow] duration-200',
                      empty
                        ? 'bg-danger-50/50 shadow-[inset_3px_0_0_var(--color-danger-500)] dark:bg-danger-500/[0.06]'
                        : 'hover:bg-[var(--surface-muted)] hover:shadow-[inset_3px_0_0_var(--color-brand-500)] dark:hover:bg-white/[0.02]',
                    )}
                  >
                    {/* Tuman */}
                    <div className="flex min-w-[180px] items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-tile font-mono text-ui font-bold tabular-nums ring-1 ring-inset transition-transform duration-300 ease-out-expo group-hover/row:scale-105',
                          empty
                            ? 'bg-danger-100 text-danger-700 ring-danger-200 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30'
                            : 'bg-ok-50 text-ok-700 ring-ok-200 dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25',
                        )}
                      >
                        {empty ? (
                          <CircleAlert className="size-4" />
                        ) : (
                          district.responsibles.length
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-[14.5px] font-[720] tracking-[-0.01em] text-strong [font-stretch:106%]">
                          {district.name}
                        </p>
                        <p
                          className={cn(
                            'font-mono text-[10.5px] tracking-wide uppercase',
                            empty
                              ? 'font-semibold text-danger-600 dark:text-danger-300'
                              : 'text-faint',
                          )}
                        >
                          {empty
                            ? 'mas‘ul biriktirilmagan'
                            : `${district.responsibles.length} ta hisob`}
                        </p>
                      </div>
                    </div>

                    {/* Mas'ullar */}
                    <div className="min-w-[260px] flex-1">
                      {empty ? (
                        <p className="flex items-center gap-2 py-2 text-meta font-medium text-danger-600 dark:text-danger-300">
                          <span className="relative flex size-1.5" aria-hidden>
                            <span className="live-ping absolute inset-0 rounded-full bg-danger-500" />
                            <span className="relative size-1.5 rounded-full bg-danger-500" />
                          </span>
                          Bu tumanning ma‘lumotlarini hech kim kuzatmayapti.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {district.responsibles.map((user) => (
                            <div
                              key={user.id}
                              className={cn(
                                'flex flex-wrap items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-2 ring-1 ring-[var(--border-subtle)] transition-[background-color,box-shadow] duration-200 ring-inset hover:bg-[var(--surface-muted)] hover:ring-[var(--border-strong)]',
                                !user.isActive && 'opacity-75',
                              )}
                            >
                              <span
                                className={cn(
                                  'relative grid size-8 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold tracking-wide text-white',
                                  user.isActive
                                    ? 'bg-linear-to-br from-brand-500 to-brand-800 shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]'
                                    : 'bg-linear-to-br from-idle-400 to-idle-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]',
                                )}
                              >
                                {initials(user.fullName)}
                                <span
                                  aria-hidden
                                  className={cn(
                                    'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[var(--surface-sunken)]',
                                    user.isActive ? 'bg-ok-400' : 'bg-idle-300',
                                  )}
                                />
                              </span>

                              <div className="min-w-[160px] flex-1">
                                <p className="flex items-center truncate text-ui font-semibold text-strong">
                                  <span className="truncate">
                                    {user.fullName}
                                  </span>
                                  {!user.isActive ? (
                                    <Badge className="ml-1.5 bg-idle-100 font-mono text-[10px] tracking-wide text-idle-600 uppercase ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10">
                                      faolsiz
                                    </Badge>
                                  ) : null}
                                </p>
                                <p className="truncate font-mono text-micro text-muted">
                                  {user.login}
                                </p>
                              </div>

                              <div className="hidden min-w-[150px] text-micro text-muted sm:block">
                                <p className="truncate">
                                  {orDash(user.position)}
                                </p>
                                <p className="flex items-center gap-1 truncate font-mono text-[10.5px]">
                                  {user.phone ? (
                                    <>
                                      <Phone className="size-3 opacity-70" />
                                      {user.phone}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </p>
                              </div>

                              <div className="hidden text-right lg:block">
                                <p className="label-eyebrow">Oxirgi kirish</p>
                                <p className="text-meta font-medium text-ink">
                                  {user.lastLoginAt
                                    ? formatRelativeUz(user.lastLoginAt)
                                    : 'hech qachon'}
                                </p>
                              </div>

                              {/* Amallar */}
                              <div className="flex shrink-0 items-center gap-1">
                                {can('users.update') ? (
                                  <>
                                    <IconButton
                                      label="Tahrirlash"
                                      onClick={() =>
                                        setFormFor({ district, user })
                                      }
                                    >
                                      <Pencil className="size-3.5" />
                                    </IconButton>
                                    <IconButton
                                      label="Parolni almashtirish"
                                      onClick={() => setResetting(user)}
                                    >
                                      <KeyRound className="size-3.5" />
                                    </IconButton>
                                  </>
                                ) : null}
                                {can('users.delete') ? (
                                  <IconButton
                                    label="O‘chirish"
                                    danger
                                    onClick={() =>
                                      setRemoving({
                                        user,
                                        districtName: district.name,
                                      })
                                    }
                                  >
                                    <Trash2 className="size-3.5" />
                                  </IconButton>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Biriktirish */}
                    {can('users.create') ? (
                      <Button
                        size="sm"
                        variant={empty ? 'primary' : 'secondary'}
                        icon={<Plus className="size-3.5" />}
                        onClick={() => setFormFor({ district, user: null })}
                      >
                        {empty ? 'Mas‘ul biriktirish' : 'Yana qo‘shish'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ───── Oynalar ───── */}
      <ResponsibleFormModal
        open={Boolean(formFor)}
        onClose={() => setFormFor(null)}
        district={formFor?.district ?? null}
        user={formFor?.user ?? null}
        onIssued={setIssued}
      />

      <CredentialsModal value={issued} onClose={() => setIssued(null)} />

      <ResetResponsiblePasswordModal
        user={resetting}
        onClose={() => setResetting(null)}
        onIssued={setIssued}
      />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeMutation.mutate(removing.user.id)}
        loading={removeMutation.isPending}
        title="Mas‘ul hisobini o‘chirish"
        confirmLabel="O‘chirish"
        message={
          <>
            <strong>{removing?.user.fullName}</strong> ({removing?.user.login})
            — {removing?.districtName}.
            <br />
            <span className="text-muted">
              Hisob butunlay o‘chiriladi va mas‘ul tizimga kira olmaydi. Agar u
              vaqtincha ishlamayotgan bo‘lsa, o‘chirish o‘rniga «Tahrirlash →
              Hisob holati» dan faolsizlantiring — shunda audit jurnalidagi
              yozuvlari o‘z nomi bilan qoladi.
            </span>
          </>
        }
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid size-7 place-items-center rounded-md text-muted transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95',
        danger
          ? 'hover:bg-danger-50 hover:text-danger-600 hover:shadow-[inset_0_0_0_1px_var(--color-danger-200)] dark:hover:bg-danger-500/14 dark:hover:text-danger-300 dark:hover:shadow-[inset_0_0_0_1px_rgb(226_89_79/0.3)]'
          : 'hover:bg-[var(--surface)] hover:text-strong hover:shadow-[var(--shadow-hair)]',
      )}
    >
      {children}
    </button>
  );
}
