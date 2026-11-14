import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dices, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, patch, post } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type { DistrictResponsible, User } from '@/shared/api/types';
import { Button, Field, Input, Modal, Switch } from '@/shared/ui';
import { generatePassword, suggestLogin } from './password';

export interface IssuedCredentials {
  districtName: string;
  fullName: string;
  login: string;
  password: string;
}

/**
 * TUMAN MAS'ULI FORMASI.
 *
 * ⚠️ Tuman maydoni YO'Q va bu ataylab: mas'ul har doim ANIQ bir tuman
 * qatoridan qo'shiladi, ya'ni tuman allaqachon ma'lum. Ro'yxat
 * qo'yilsa, foydalanuvchi «Jalaquduq» qatoridagi tugmani bosib,
 * formada tasodifan «Asaka» ni tanlab yuborishi mumkin edi — va
 * xatoni faqat mas'ul tizimga kirgandan keyin sezilardi.
 *
 * ⚠️ Rol ham tanlanmaydi: bu ekran FAQAT tuman mas'ullari uchun
 * (`operator`). Boshqa rollar «Foydalanuvchilar» bo'limida.
 */
export function ResponsibleFormModal({
  open,
  onClose,
  district,
  user,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  district: DistrictResponsible | null;
  /** `null` — yangi mas'ul, aks holda tahrirlash. */
  user: User | null;
  onIssued: (credentials: IssuedCredentials) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);

  const [form, setForm] = useState({
    login: '',
    password: '',
    fullName: '',
    position: '',
    phone: '',
    email: '',
    isActive: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      login: user?.login ?? (district ? suggestLogin(district.code) : ''),
      /*
       * ⚠️ Yangi mas'ul uchun parol DARHOL generatsiya qilinadi.
       * Bo'sh qoldirilsa, admin o'zi «123456789» kabi parol yozib
       * qo'yardi — 16 ta tuman uchun esa bu 16 ta zaif hisob degani.
       */
      password: user ? '' : generatePassword(),
      fullName: user?.fullName ?? '',
      position: user?.position ?? 'Tuman issiqlik ta‘minoti mas‘uli',
      phone: user?.phone ?? '',
      email: user?.email ?? '',
      isActive: user?.isActive ?? true,
    });
    setShowPassword(!user);
    setError(null);
  }, [open, user, district]);

  const mutation = useMutation({
    mutationFn: () => {
      const base = {
        login: form.login.trim(),
        fullName: form.fullName.trim(),
        position: form.position.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      };

      if (user) {
        return patch<User>(API.users.one(user.id), {
          ...base,
          isActive: form.isActive,
        });
      }
      return post<User>(API.users.list, {
        ...base,
        password: form.password,
        role: 'operator',
        districtId: district?.districtId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['responsibles'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();

      if (user) {
        toast.success('Mas‘ul ma‘lumotlari yangilandi');
        return;
      }
      /*
       * ⚠️ Yaratilgandan keyin LOGIN + PAROL oynasi ochiladi. Oddiy
       * «saqlandi» xabari yetarli emas: admin bu ma'lumotni mas'ulga
       * TOPSHIRISHI kerak va parol boshqa hech qayerda ko'rinmaydi
       * (serverda faqat hash bor).
       */
      onIssued({
        districtName: district?.name ?? '',
        fullName: form.fullName.trim(),
        login: form.login.trim(),
        password: form.password,
      });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ): void => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (): void => {
    if (!form.fullName.trim()) return setError('F.I.Sh kiritilmagan');
    if (!form.login.trim()) return setError('Login kiritilmagan');
    if (!/^[a-zA-Z0-9._-]+$/.test(form.login.trim())) {
      return setError(
        'Loginda faqat lotin harflari, raqamlar va «. - _» bo‘lishi mumkin',
      );
    }
    if (!isEdit && form.password.length < 8) {
      return setError('Parol kamida 8 belgi bo‘lishi kerak');
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Mas‘ulni tahrirlash' : 'Tuman mas‘ulini biriktirish'}
      description={
        district
          ? `${district.name} — bu hisob faqat shu tuman ma‘lumotlarini ko‘radi`
          : undefined
      }
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="F.I.Sh" required className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              placeholder="Akmal Tursunov"
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Login"
          required
          hint="Mas‘ul shu login bilan tizimga kiradi"
        >
          {(id) => (
            <Input
              id={id}
              value={form.login}
              onChange={(event) => set('login', event.target.value)}
              className="font-mono"
            />
          )}
        </Field>

        {!isEdit ? (
          <Field label="Parol" required hint="Kamida 8 belgi">
            {(id) => (
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => set('password', event.target.value)}
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                    }
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-faint transition-colors hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <Button
                  size="md"
                  variant="secondary"
                  icon={<Dices className="size-4" />}
                  onClick={() => {
                    set('password', generatePassword());
                    setShowPassword(true);
                  }}
                  title="Yangi parol generatsiya qilish"
                  aria-label="Yangi parol generatsiya qilish"
                />
              </div>
            )}
          </Field>
        ) : (
          <Field
            label="Hisob holati"
            hint="Faolsizlantirilsa mas‘ul tizimga kira olmaydi"
          >
            {() => (
              <div className="flex h-9.5 items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onChange={(value) => set('isActive', value)}
                  label="Hisob faol"
                />
                <span className="text-ui text-ink">
                  {form.isActive ? 'Faol' : 'Faolsiz'}
                </span>
              </div>
            )}
          </Field>
        )}

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
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 sm:col-span-2 dark:bg-danger-500/10 dark:text-danger-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
