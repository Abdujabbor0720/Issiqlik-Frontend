import { useMutation } from '@tanstack/react-query';
import { Dices, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage, post } from '@/shared/api/client';
import { API } from '@/shared/api/endpoints';
import type { User } from '@/shared/api/types';
import { Button, Field, Input, Modal } from '@/shared/ui';
import { generatePassword } from './password';
import type { IssuedCredentials } from './ResponsibleFormModal';

/**
 * MAS'UL PAROLINI ALMASHTIRISH.
 *
 * ⚠️ «Foydalanuvchilar» bo'limidagi oynadan FARQI: muvaffaqiyatdan
 * keyin yangi parol TOPSHIRISH OYNASIGA uzatiladi. Mas'ulga parolni
 * yetkazish — amalning bir qismi; faqat «almashtirildi» deyilsa,
 * admin uni qayerdan olishini bilmasdi (serverda faqat hash bor).
 */
export function ResetResponsiblePasswordModal({
  user,
  onClose,
  onIssued,
}: {
  user: User | null;
  onClose: () => void;
  onIssued: (credentials: IssuedCredentials) => void;
}) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // ⚠️ Parol oyna ochilishi bilan generatsiya qilinadi — admin
    // «123456789» yozib qo'yishiga sabab qolmaydi.
    setPassword(generatePassword());
    setShow(true);
    setError(null);
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      post(API.users.resetPassword(user!.id), { newPassword: password }),
    onSuccess: () => {
      const issued: IssuedCredentials = {
        districtName: user?.district?.name ?? '',
        fullName: user?.fullName ?? '',
        login: user?.login ?? '',
        password,
      };
      onClose();
      onIssued(issued);
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
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Mas‘ulning BARCHA ochiq sessiyalari yopiladi — u yangi parol bilan
            qaytadan kirishi kerak bo‘ladi.
          </span>
        </div>

        <Field label="Yangi parol" required hint="Kamida 8 belgi" error={error}>
          {(id) => (
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                {/* ⚠️ Parol MONO va kengroq oraliqda: admin uni mas'ulga
                    o'qib beradi — har bir belgi alohida ko'rinishi kerak. */}
                <Input
                  id={id}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  invalid={Boolean(error)}
                  className="h-10.5 bg-[var(--surface-sunken)] pr-10 font-mono text-[15px] font-semibold tracking-[0.06em]"
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-faint transition-colors hover:text-strong"
                >
                  {show ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <Button
                size="md"
                variant="secondary"
                className="group h-10.5 px-3"
                icon={
                  <Dices className="size-4 transition-transform duration-500 ease-out-expo group-hover:rotate-180" />
                }
                onClick={() => {
                  setPassword(generatePassword());
                  setShow(true);
                }}
                title="Yangi parol generatsiya qilish"
                aria-label="Yangi parol generatsiya qilish"
              />
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}
