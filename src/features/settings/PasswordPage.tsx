import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, post } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import { Button, Card, CardBody, CardHeader, Field, Input } from '@/shared/ui';
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1.5 px-1 text-meta font-medium text-muted transition-colors hover:text-strong"
      >
        <ArrowLeft className="size-3.5" />
        Bosh sahifaga
      </Link>

      <Card>
        <CardHeader
          icon={<KeyRound className="size-4" />}
          eyebrow="Xavfsizlik"
          title="Parolni o‘zgartirish"
          subtitle="Yangi parol kamida 8 belgidan iborat bo‘lishi kerak"
        />
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-meta text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/25">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Parol almashgach barcha qurilmalardagi sessiyalar yopiladi va
              siz qaytadan kirishingiz kerak bo‘ladi.
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
              />
            )}
          </Field>

          <Field label="Yangi parol" required hint="Kamida 8 belgi">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={form.newPassword}
                onChange={(event) => set('newPassword', event.target.value)}
                autoComplete="new-password"
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
              />
            )}
          </Field>

          <Button
            variant="primary"
            size="lg"
            className="mt-1 w-full justify-center"
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
