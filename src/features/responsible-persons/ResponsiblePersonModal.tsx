import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, getPaged, patch, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DistrictOption,
  ResponsiblePerson,
  User,
} from '@/shared/api/types';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from '@/shared/ui';
import { useAuthStore } from '@/store/auth.store';

const EMPTY = {
  fullName: '',
  position: '',
  employer: '',
  phone: '',
  email: '',
  districtId: '',
  userId: '',
  note: '',
  isActive: true,
};

/**
 * JAVOBGAR SHAXS FORMASI.
 *
 * ⚠️ Tuman mas'uli uchun tuman MAJBURAN o'zi (server ham shuni qiladi):
 * tanlov ko'rsatilmaydi — boshqa tumanni tanlab, 403 olish chalg'itardi.
 *
 * ⚠️ «Panel hisobi» — faqat `Obyekt javobgari` rolidagi foydalanuvchi.
 * Ro'yxat `users.view` ruxsati bilan keladi; ruxsat yo'q bo'lsa maydon
 * ko'rsatilmaydi (bog'lashni administrator qiladi).
 */
export function ResponsiblePersonModal({
  open,
  person,
  onClose,
}: {
  open: boolean;
  person: ResponsiblePerson | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const can = useAuthStore((state) => state.can);
  const isOperator = user?.role === 'operator';
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      person
        ? {
            fullName: person.fullName,
            position: person.position,
            employer: person.employer ?? '',
            // ⚠️ Niqoblangan raqam formaga TUSHMAYDI — saqlanganda raqam buzilardi.
            phone: person.contactsMasked ? '' : person.phone,
            email: person.contactsMasked ? '' : (person.email ?? ''),
            districtId: person.district?.id ?? '',
            userId: person.user?.id ?? '',
            note: person.note ?? '',
            isActive: person.isActive,
          }
        : EMPTY,
    );
    setError(null);
  }, [open, person]);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open && !isOperator,
  });

  const accounts = useQuery({
    queryKey: qk.users({ role: 'responsible', limit: 200 }),
    queryFn: () =>
      getPaged<User>(API.users.list, {
        params: { role: 'responsible', limit: 200, isActive: true },
      }),
    enabled: open && can('users.view'),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        position: form.position.trim(),
        employer: form.employer.trim() || null,
        note: form.note.trim() || null,
      };
      // ⚠️ Niqoblangan yozuvda bo'sh telefon/email — «tegilmasin».
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.email.trim() || !person?.contactsMasked) {
        body.email = form.email.trim() || null;
      }
      if (!isOperator) body.districtId = form.districtId || null;
      if (can('users.view')) body.userId = form.userId || null;
      if (person) body.isActive = form.isActive;

      return person
        ? patch(API.responsiblePersons.one(person.id), body)
        : post(API.responsiblePersons.list, body);
    },
    onSuccess: () => {
      toast.success(person ? 'Saqlandi' : 'Javobgar qo‘shildi');
      void queryClient.invalidateQueries({ queryKey: ['responsiblePersons'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!form.fullName.trim()) return setError('F.I.Sh. kiritilmagan');
    if (!form.position.trim()) return setError('Lavozimi kiritilmagan');
    if (!person && !form.phone.trim()) {
      return setError('Xizmat telefoni kiritilmagan');
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? 'Javobgarni tahrirlash' : 'Yangi javobgar shaxs'}
      description="Direktor, xo‘jalik ishlari bo‘yicha mas‘ul yoki isitish texnigi"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={submit}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="F.I.Sh." required className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              placeholder="Karimov Anvar Tohirovich"
            />
          )}
        </Field>
        <Field label="Lavozimi" required>
          {(id) => (
            <Input
              id={id}
              value={form.position}
              onChange={(event) => set('position', event.target.value)}
              placeholder="Xo‘jalik ishlari bo‘yicha mas‘ul"
            />
          )}
        </Field>
        <Field label="Tashkiloti">
          {(id) => (
            <Input
              id={id}
              value={form.employer}
              onChange={(event) => set('employer', event.target.value)}
              placeholder="4-sonli maktab"
            />
          )}
        </Field>
        <Field
          label="Xizmat telefoni"
          required={!person}
          hint={
            person?.contactsMasked
              ? 'Raqamni ko‘rish huquqi yo‘q — bo‘sh qoldirsangiz o‘zgarmaydi'
              : undefined
          }
        >
          {(id) => (
            <Input
              id={id}
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              placeholder="+998 90 123 45 67"
            />
          )}
        </Field>
        <Field label="Xizmat email (ixtiyoriy)">
          {(id) => (
            <Input
              id={id}
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>

        {!isOperator ? (
          <Field
            label="Tuman"
            hint="Bo‘sh — viloyat darajasi (bir nechta tumanga javob beradi)"
          >
            {(id) => (
              <Select
                id={id}
                value={form.districtId}
                onChange={(event) => set('districtId', event.target.value)}
              >
                <option value="">Viloyat darajasi</option>
                {(districts.data ?? []).map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {can('users.view') ? (
          <Field
            label="Panel hisobi"
            hint="«Obyekt javobgari» rolidagi foydalanuvchi — o‘z XAVF larini panelda ko‘radi"
          >
            {(id) => (
              <Select
                id={id}
                value={form.userId}
                onChange={(event) => set('userId', event.target.value)}
              >
                <option value="">Bog‘lanmagan</option>
                {(accounts.data?.items ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.fullName} ({account.login})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        <Field label="Izoh" className="sm:col-span-2">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.note}
              onChange={(event) => set('note', event.target.value)}
            />
          )}
        </Field>

        {person ? (
          <div className="sm:col-span-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-ink">
              <Switch
                checked={form.isActive}
                onChange={(value) => set('isActive', value)}
                label="Faol (o‘chirilmaydi — faolsizlantiriladi, tarix saqlanadi)"
              />
              <span>
                Faol (o‘chirilmaydi — faolsizlantiriladi, tarix saqlanadi)
              </span>
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
