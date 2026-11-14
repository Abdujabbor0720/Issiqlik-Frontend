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
import { useMemo, useState } from 'react';
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
    queryFn: () =>
      get<DistrictResponsible[]>(API.users.districtResponsibles),
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
      <div className="px-1">
        <h1 className="text-sub font-semibold tracking-tight text-strong">
          Tuman mas‘ullari
        </h1>
        <p className="text-meta text-muted">
          Har bir tuman uchun alohida hisob — mas‘ul faqat o‘z tumanining
          kotyollari, modullari va ogohlantirishlarini ko‘radi
        </p>
      </div>

      {/* ───── Ko'rsatkichlar ───── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Tumanlar"
          value={String(stats.districts)}
          icon={UserCog}
          tone="brand"
        />
        <StatCard
          label="Mas‘ul biriktirilgan"
          value={String(stats.covered)}
          icon={ShieldCheck}
          tone="ok"
          share={
            stats.districts > 0 ? (stats.covered / stats.districts) * 100 : 0
          }
        />
        <StatCard
          label="Mas‘ul yo‘q"
          value={String(stats.uncovered)}
          icon={CircleAlert}
          tone={stats.uncovered > 0 ? 'danger' : 'idle'}
          hint={stats.uncovered > 0 ? 'biriktirish kerak' : 'hammasi qamrab olingan'}
        />
        <StatCard
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
                <li key={district.districtId}>
                  {index > 0 ? <div className="h-px bg-line" /> : null}
                  <div
                    className={cn(
                      'flex flex-wrap items-start gap-3 px-5 py-3.5',
                      empty && 'bg-danger-50/40 dark:bg-danger-500/5',
                    )}
                  >
                    {/* Tuman */}
                    <div className="flex min-w-[180px] items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-tile text-micro font-semibold',
                          empty
                            ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300'
                            : 'bg-ok-50 text-ok-700 dark:bg-ok-500/12 dark:text-ok-300',
                        )}
                      >
                        {empty ? (
                          <CircleAlert className="size-4" />
                        ) : (
                          district.responsibles.length
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-ui font-semibold text-strong">
                          {district.name}
                        </p>
                        <p className="text-micro text-muted">
                          {empty
                            ? 'mas‘ul biriktirilmagan'
                            : `${district.responsibles.length} ta hisob`}
                        </p>
                      </div>
                    </div>

                    {/* Mas'ullar */}
                    <div className="min-w-[260px] flex-1">
                      {empty ? (
                        <p className="py-1.5 text-meta text-danger-600 dark:text-danger-400">
                          Bu tumanning ma‘lumotlarini hech kim kuzatmayapti.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {district.responsibles.map((user) => (
                            <div
                              key={user.id}
                              className="flex flex-wrap items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-2"
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-nano font-semibold text-white">
                                {initials(user.fullName)}
                              </span>

                              <div className="min-w-[160px] flex-1">
                                <p className="truncate text-ui font-medium text-strong">
                                  {user.fullName}
                                  {!user.isActive ? (
                                    <Badge className="ml-1.5 bg-[var(--surface)] text-faint">
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
                                <p className="flex items-center gap-1 truncate">
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

                              <div className="hidden text-right text-micro text-muted lg:block">
                                <p>Oxirgi kirish</p>
                                <p className="text-ui text-ink">
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
        onConfirm={() =>
          removing && removeMutation.mutate(removing.user.id)
        }
        loading={removeMutation.isPending}
        title="Mas‘ul hisobini o‘chirish"
        confirmLabel="O‘chirish"
        message={
          <>
            <strong>{removing?.user.fullName}</strong> ({removing?.user.login})
            — {removing?.districtName}.
            <br />
            <span className="text-muted">
              Hisob butunlay o‘chiriladi va mas‘ul tizimga kira olmaydi.
              Agar u vaqtincha ishlamayotgan bo‘lsa, o‘chirish o‘rniga
              «Tahrirlash → Hisob holati» dan faolsizlantiring — shunda
              audit jurnalidagi yozuvlari o‘z nomi bilan qoladi.
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
        'grid size-7 place-items-center rounded-md text-muted transition-colors',
        danger
          ? 'hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10'
          : 'hover:bg-[var(--surface)] hover:text-strong',
      )}
    >
      {children}
    </button>
  );
}
