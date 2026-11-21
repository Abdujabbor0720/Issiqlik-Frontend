import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  del,
  errorMessage,
  get,
  getPaged,
  patch,
  post,
} from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  CatalogItem,
  DistrictOption,
  User,
  UserRole,
} from '@/shared/api/types';
import { ROLE_LABELS } from '@/shared/constants/status';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { formatRelativeUz } from '@/shared/utils/date';
import { formatNumber, initials, orDash } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';

/* ⚠️ Rol yorlig'i ham HALQA (`ring-inset`) bilan: qorong'i rejimda och
   fon yo'qoladi va chegarasiz yorliq matnga qo'shilib ketardi. */
const ROLE_TONE: Record<UserRole, string> = {
  super_admin:
    'bg-brand-600 text-white ring-1 ring-brand-700 ring-inset shadow-[0_2px_8px_-3px_rgb(11_91_181/0.6)] dark:bg-brand-500 dark:ring-brand-400/40',
  admin:
    'bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25',
  operator:
    'bg-ok-50 text-ok-700 ring-1 ring-ok-200 ring-inset dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25',
  viewer:
    'bg-idle-100 text-idle-700 ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10',
  agency_officer:
    'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25',
  responsible:
    'bg-[var(--surface-sunken)] text-ink ring-1 ring-[var(--border-strong)] ring-inset',
};

/** Parol maydoni — chuqur fon, mono (nuqtalar teng oraliqda). */
const SECRET =
  'bg-[var(--surface-sunken)] font-mono tracking-[0.12em] placeholder:tracking-normal';

/**
 * FOYDALANUVCHILAR.
 *
 * ⚠️ Rol — RUXSATLAR to'plami uchun yorliq, tuman esa MA'LUMOT
 * CHEGARASI. Shuning uchun «Tuman operatori» tanlanganda tuman
 * maydoni MAJBURIY bo'lib qoladi: tumansiz operator amalda butun
 * viloyatni tahrirlay oladigan administratorga aylanardi.
 */
export function UsersPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const currentUser = useAuthStore((state) => state.user);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);

  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
    }),
    [page, debouncedSearch, roleFilter],
  );

  const query = useQuery({
    queryKey: qk.users(params),
    queryFn: () => getPaged<User>(API.users.list, { params }),
    placeholderData: (previous) => previous,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => del(API.users.one(id)),
    onSuccess: () => {
      toast.success('Foydalanuvchi ro‘yxatdan chiqarildi');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setRemoving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Foydalanuvchilar"
        subtitle={
          query.data ? (
            <span className="inline-flex items-baseline gap-1.5">
              <AnimatedNumber
                value={formatNumber(query.data.meta.total)}
                className="font-mono text-[12.5px] font-bold text-strong"
              />
              ta hisob
            </span>
          ) : (
            'Yuklanmoqda…'
          )
        }
        actions={
          can('users.create') ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Yangi foydalanuvchi
            </Button>
          ) : null
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 py-3">
          <span className="label-eyebrow mr-1 hidden md:inline">Filtr</span>
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="F.I.Sh, login yoki telefon…"
              leading={<Search className="size-4" />}
            />
          </div>

          <div className="w-52">
            <Select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as UserRole | '');
                setPage(1);
              }}
            >
              <option value="">Barcha rollar</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <CardBody>
            <Skeleton className="h-72" />
          </CardBody>
        ) : query.isError ? (
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Foydalanuvchi topilmadi"
            description="Filtrlarni o‘zgartiring yoki yangi hisob yarating."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Foydalanuvchi</Th>
                  <Th>Rol</Th>
                  <Th>Tuman / tashkilot</Th>
                  <Th>Lavozim</Th>
                  <Th align="right">Oxirgi kirish</Th>
                  <Th>Holati</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((user) => {
                  const isMe = user.id === currentUser?.id;
                  return (
                    <Tr
                      key={user.id}
                      className={cn(
                        'group/row hover:bg-[var(--surface-muted)] hover:shadow-[inset_3px_0_0_var(--color-brand-500)] dark:hover:bg-white/[0.025]',
                        !user.isActive && 'opacity-60 hover:opacity-90',
                        isMe && 'bg-brand-50/40 dark:bg-brand-400/[0.04]',
                      )}
                    >
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'relative grid size-8 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold tracking-wide text-white transition-transform duration-300 ease-out-expo group-hover/row:scale-105',
                              user.isActive
                                ? 'bg-linear-to-br from-brand-500 to-brand-800 shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]'
                                : 'bg-linear-to-br from-idle-400 to-idle-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]',
                            )}
                          >
                            {initials(user.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center truncate font-semibold text-strong">
                              <span className="truncate">{user.fullName}</span>
                              {isMe ? (
                                <span className="ml-1.5 shrink-0 rounded-[4px] bg-brand-500/12 px-1 font-mono text-[9.5px] leading-4 font-bold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-200">
                                  siz
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate font-mono text-micro text-muted">
                              {user.login}
                            </p>
                          </div>
                        </div>
                      </Td>

                      <Td>
                        <Badge className={ROLE_TONE[user.role]}>
                          {user.role === 'super_admin' ? (
                            <ShieldCheck className="size-3" />
                          ) : null}
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </Td>

                      <Td className="text-muted">
                        {/* ⚠️ Tashkilot mas'ulining kesimi — tuman emas, idora. */}
                        {orDash(user.district?.shortName ?? user.agency?.name)}
                      </Td>
                      <Td className="max-w-[200px] truncate text-muted">
                        {orDash(user.position)}
                      </Td>
                      <Td
                        align="right"
                        className={cn(
                          'font-mono text-meta whitespace-nowrap',
                          user.lastLoginAt ? 'text-ink' : 'text-faint',
                        )}
                      >
                        {user.lastLoginAt
                          ? formatRelativeUz(user.lastLoginAt)
                          : 'hech qachon'}
                      </Td>

                      <Td>
                        {user.isActive ? (
                          <Badge
                            className="bg-ok-50 text-ok-700 ring-1 ring-ok-200 ring-inset dark:bg-ok-500/12 dark:text-ok-300 dark:ring-ok-400/25"
                            dot="bg-ok-500 shadow-[0_0_6px_var(--color-ok-400)]"
                          >
                            Faol
                          </Badge>
                        ) : (
                          <Badge
                            className="bg-idle-100 text-idle-700 ring-1 ring-idle-200 ring-inset dark:bg-white/[0.06] dark:text-idle-300 dark:ring-white/10"
                            dot="bg-idle-400"
                          >
                            Faolsiz
                          </Badge>
                        )}
                      </Td>

                      <Td align="right">
                        <span className="flex items-center justify-end gap-1">
                          {can('users.update') ? (
                            <>
                              <IconButton
                                label="Tahrirlash"
                                onClick={() => {
                                  setEditing(user);
                                  setFormOpen(true);
                                }}
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

                          {can('users.delete') &&
                          user.id !== currentUser?.id ? (
                            <IconButton
                              label="Ro‘yxatdan chiqarish"
                              danger
                              onClick={() => setRemoving(user)}
                            >
                              <Trash2 className="size-3.5" />
                            </IconButton>
                          ) : null}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>

            {query.data ? (
              <Pagination meta={query.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
      />

      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeMutation.mutate(removing.id)}
        loading={removeMutation.isPending}
        title="Foydalanuvchini ro‘yxatdan chiqarish"
        confirmLabel="Tasdiqlash"
        message={
          <>
            <strong>{removing?.fullName}</strong> ({removing?.login}) tizimga
            kira olmaydi.
            <br />
            <span className="text-muted">
              Audit jurnalidagi yozuvlar saqlanib qoladi — ularda kim nima
              qilgani matn ko‘rinishida ham yozilgan.
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

function UserFormModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    login: '',
    password: '',
    fullName: '',
    role: 'viewer' as UserRole,
    districtId: '',
    agencyId: '',
    email: '',
    phone: '',
    position: '',
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setForm({
      login: user?.login ?? '',
      password: '',
      fullName: user?.fullName ?? '',
      role: user?.role ?? 'viewer',
      districtId: user?.districtId ?? '',
      agencyId: user?.agencyId ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      position: user?.position ?? '',
      isActive: user?.isActive ?? true,
    });
    setError(null);
  }, [open, user]);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  const agencies = useQuery({
    queryKey: qk.catalog('agencies', 'user-form'),
    queryFn: () =>
      getPaged<CatalogItem>(API.catalogs.list('agencies'), {
        params: { limit: 200 },
      }),
    enabled: open && form.role === 'agency_officer',
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const base: Record<string, unknown> = {
        login: form.login.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        /* ⚠️ Tuman FAQAT operatorga yuboriladi: boshqa rolga
           yuborilsa, server «tuman faqat operatorga biriktiriladi»
           xatosini qaytaradi. */
        districtId: form.role === 'operator' ? form.districtId : undefined,
        /* ⚠️ Tashkilot FAQAT tashkilot mas'uliga (server boshqa rolga rad etadi). */
        agencyId: form.role === 'agency_officer' ? form.agencyId : undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        position: form.position.trim() || undefined,
      };

      if (user) {
        return patch(API.users.one(user.id), {
          ...base,
          isActive: form.isActive,
        });
      }
      return post(API.users.list, { ...base, password: form.password });
    },
    onSuccess: () => {
      toast.success(
        isEdit ? 'Foydalanuvchi yangilandi' : 'Foydalanuvchi yaratildi',
      );
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ): void => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (): void => {
    if (!form.login.trim()) return setError('Login kiritilmagan');
    if (!form.fullName.trim()) return setError('F.I.Sh kiritilmagan');
    if (!isEdit && form.password.length < 8) {
      return setError('Parol kamida 8 belgi bo‘lishi kerak');
    }
    if (form.role === 'operator' && !form.districtId) {
      return setError('Tuman operatori uchun tuman tanlanishi shart');
    }
    if (form.role === 'agency_officer' && !form.agencyId) {
      return setError('Tashkilot mas‘uli uchun tashkilot tanlanishi shart');
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
      description={isEdit ? user?.login : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
          >
            {isEdit ? 'Saqlash' : 'Yaratish'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Login" required>
          {(id) => (
            <Input
              id={id}
              value={form.login}
              onChange={(event) => set('login', event.target.value)}
              placeholder="operator.jalaquduq"
              className="font-mono font-medium"
            />
          )}
        </Field>

        {!isEdit ? (
          <Field label="Parol" required hint="Kamida 8 belgi">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={form.password}
                onChange={(event) => set('password', event.target.value)}
                autoComplete="new-password"
                className={SECRET}
              />
            )}
          </Field>
        ) : (
          <Field
            label="Hisob holati"
            hint="Faolsizlantirilsa sessiyalar yopiladi"
          >
            {() => (
              <div className="flex h-9.5 items-center gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3 ring-1 ring-[var(--border-subtle)] ring-inset">
                <Switch
                  checked={form.isActive}
                  onChange={(value) => set('isActive', value)}
                  label="Hisob faol"
                />
                <span
                  className={cn(
                    'font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-colors duration-200',
                    form.isActive
                      ? 'text-ok-600 dark:text-ok-300'
                      : 'text-idle-500 dark:text-idle-300',
                  )}
                >
                  {form.isActive ? 'Faol' : 'Faolsiz'}
                </span>
              </div>
            )}
          </Field>
        )}

        <Field label="F.I.Sh" required className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
            />
          )}
        </Field>

        <Field label="Rol" required>
          {(id) => (
            <Select
              id={id}
              value={form.role}
              onChange={(event) => set('role', event.target.value as UserRole)}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Tuman"
          required={form.role === 'operator'}
          hint={
            form.role === 'operator'
              ? 'Operator faqat shu tuman ma‘lumotlarini ko‘radi'
              : 'Faqat «Tuman operatori» roli uchun'
          }
        >
          {(id) => (
            <Select
              id={id}
              value={form.districtId}
              disabled={form.role !== 'operator'}
              onChange={(event) => set('districtId', event.target.value)}
            >
              <option value="">Tanlanmagan</option>
              {(districts.data ?? []).map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {form.role === 'agency_officer' ? (
          <Field
            label="Tashkilot (boshqarma)"
            required
            hint="Mas‘ul shu idoraga qarashli muassasalarning XAVF larini ko‘radi"
          >
            {(id) => (
              <Select
                id={id}
                value={form.agencyId}
                onChange={(event) => set('agencyId', event.target.value)}
              >
                <option value="">Tanlanmagan</option>
                {(agencies.data?.items ?? []).map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        <Field label="Lavozim">
          {(id) => (
            <Input
              id={id}
              value={form.position}
              onChange={(event) => set('position', event.target.value)}
            />
          )}
        </Field>

        <Field label="Telefon">
          {(id) => (
            <Input
              id={id}
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              placeholder="+998 90 123 45 67"
            />
          )}
        </Field>

        <Field label="Email" className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>

        {error ? (
          <p
            role="alert"
            className="reveal rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 shadow-[inset_3px_0_0_var(--color-danger-500)] ring-1 ring-danger-200 ring-inset sm:col-span-2 dark:bg-danger-500/14 dark:text-danger-300 dark:ring-danger-400/30"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPassword('');
      setError(null);
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      post(API.users.resetPassword(user!.id), { newPassword: password }),
    onSuccess: () => {
      toast.success('Parol almashtirildi — eski sessiyalar yopildi');
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      size="sm"
      title="Parolni almashtirish"
      description={user ? `${user.fullName} (${user.login})` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (password.length < 8) {
                setError('Parol kamida 8 belgi bo‘lishi kerak');
                return;
              }
              setError(null);
              mutation.mutate();
            }}
          >
            Almashtirish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 rounded-lg bg-warn-50 px-3 py-2.5 text-meta text-warn-700 shadow-[inset_3px_0_0_var(--color-warn-400)] ring-1 ring-warn-200 ring-inset dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25">
          <UserX className="mt-0.5 size-4 shrink-0" />
          <span>
            Parol almashgach foydalanuvchining BARCHA ochiq sessiyalari yopiladi
            — u qaytadan kirishi kerak bo‘ladi.
          </span>
        </div>

        <Field label="Yangi parol" required hint="Kamida 8 belgi" error={error}>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              invalid={Boolean(error)}
              className={SECRET}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
