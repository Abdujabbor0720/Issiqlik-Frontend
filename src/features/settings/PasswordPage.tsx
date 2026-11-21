import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, post } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import { Button, Card, CardBody, Field, Input, PageHeader } from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/store/auth.store';

/**
 * PAROLNI O'ZGARTIRISH.
 *
 * ⚠️ Muvaffaqiyatdan keyin foydalanuvchi TIZIMDAN CHIQARILADI.
 * Sabab: server parol almashganda BARCHA refresh tokenlarni bekor
 * qiladi (parolni almashtirishning asosiy sababi — «kimdir bilib
 * qolgan» degan shubha). Mijoz esa buni bilmasa, keyingi so'rovda
 * tushunarsiz 401 xatosini olardi va «tizim buzildi» degan xulosaga
 * kelardi. Aniq chiqarish — tushunarliroq.
 */
export function PasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    repeatPassword: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      post(API.auth.changePassword, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    onSuccess: async () => {
      toast.success('Parol o‘zgartirildi — qaytadan kiring');
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = (key: keyof typeof form, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (): void => {
    if (!form.currentPassword) return setError('Joriy parolni kiriting');
    if (form.newPassword.length < 8) {
      return setError('Yangi parol kamida 8 belgi bo‘lishi kerak');
    }
    if (form.newPassword !== form.repeatPassword) {
      return setError('Yangi parollar mos kelmadi');
    }
    if (form.newPassword === form.currentPassword) {
      return setError('Yangi parol eskisidan farq qilishi kerak');
    }
    setError(null);
    mutation.mutate();
  };

  const lengthShare = Math.min(form.newPassword.length / MIN_LENGTH, 1);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <Link
        to="/"
        className="group inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.08em] text-muted uppercase transition-colors hover:text-strong"
      >
        <ArrowLeft className="size-3.5 transition-transform duration-300 ease-out-expo group-hover:-translate-x-0.5" />
        Bosh sahifaga
      </Link>

      <PageHeader
        eyebrow="Xavfsizlik"
        title="Parolni o‘zgartirish"
        subtitle="Yangi parol kamida 8 belgidan iborat bo‘lishi kerak"
      />

      <Card className="overflow-hidden">
        {/* ⚠️ Qaysi hisob paroli o'zgarayotgani — CHUQUR plastinkada,
            monoshriftda: umumiy kompyuterda boshqa hisobdan kirib qolgan
            operator buni forma ustidayoq ko'radi. */}
        <div className="relative flex items-center gap-3 bg-[var(--surface-sunken)] px-5 py-3.5 shadow-[inset_0_-1px_0_var(--border-subtle)]">
          <span
            aria-hidden
            className="grid-bg pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(90deg,transparent,#000_80%)]"
          />
          <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]">
            <KeyRound className="size-4" />
          </span>
          <div className="relative min-w-0">
            <p className="label-eyebrow">Hisob</p>
            <p className="truncate font-mono text-ui font-semibold text-strong">
              {user?.login ?? '—'}
            </p>
          </div>
        </div>

        <CardBody className="flex flex-col gap-4 pt-4">
          <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 text-meta text-brand-700 shadow-[inset_3px_0_0_var(--color-brand-500)] ring-1 ring-brand-200 ring-inset dark:bg-brand-400/12 dark:text-brand-200 dark:ring-brand-400/25">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Parol almashgach barcha qurilmalardagi sessiyalar yopiladi va siz
              qaytadan kirishingiz kerak bo‘ladi.
            </span>
          </div>

          <Field label="Joriy parol" required>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={form.currentPassword}
                onChange={(event) => set('currentPassword', event.target.value)}
                autoComplete="current-password"
                autoFocus
                className={SECRET}
              />
            )}
          </Field>

          <div className="h-px bg-line" />

          <Field
            label="Yangi parol"
            required
            hint={
              /* ⚠️ Faqat «kamida 8 belgi» qoidasining KO'RINISHI — yangi
                 talab qo'shilmaydi, tekshiruv `handleSubmit` da. */
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="relative h-[3px] w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                >
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 w-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-out-expo',
                      lengthShare >= 1 ? 'bg-ok-500' : 'bg-brand-500',
                    )}
                    style={{ transform: `scaleX(${lengthShare})` }}
                  />
                </span>
                <span className="font-mono text-[10.5px] tabular-nums">
                  {form.newPassword.length}/{MIN_LENGTH}
                </span>
                Kamida 8 belgi
              </span>
            }
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                value={form.newPassword}
                onChange={(event) => set('newPassword', event.target.value)}
                autoComplete="new-password"
                className={SECRET}
              />
            )}
          </Field>

          <Field label="Yangi parolni takrorlang" required error={error}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={form.repeatPassword}
                onChange={(event) => set('repeatPassword', event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(error)}
                className={SECRET}
              />
            )}
          </Field>

          <Button
            variant="primary"
            size="lg"
            className="mt-1 w-full justify-center"
            icon={<KeyRound className="size-4" />}
            loading={mutation.isPending}
            onClick={handleSubmit}
          >
            Parolni o‘zgartirish
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

/** Parol maydonlari — chuqur fon, mono (nuqtalar teng oraliqda). */
const SECRET =
  'h-10.5 bg-[var(--surface-sunken)] font-mono tracking-[0.12em] placeholder:tracking-normal';

/** «Kamida 8 belgi» — `handleSubmit` dagi tekshiruv bilan AYNI son. */
const MIN_LENGTH = 8;
