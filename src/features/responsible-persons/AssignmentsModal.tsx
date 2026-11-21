import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  Boiler,
  DistrictOption,
  ResponsibilityType,
  ResponsiblePerson,
} from '@/shared/api/types';
import { RESPONSIBILITY_LABELS } from '@/shared/constants/incident';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useDistrictCatalog } from '@/shared/hooks/useCatalogOptions';
import {
  Button,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Switch,
} from '@/shared/ui';
import { boilerName } from '@/shared/utils/boiler';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/store/auth.store';

/**
 * BIRIKTIRISHLAR — «shu shaxs shu muassasa (yoki aniq qozonxona) uchun
 * shu turdagi javobgar».
 *
 * ⚠️ Odatda MUASSASAGA biriktiriladi (barcha qozonxonalariga o'tadi);
 * aniq OBYEKTGA — katta shifoxonada har qozonxonaning o'z texnigi bo'lsa.
 *
 * ⚠️ «Asosiy» belgilansa, nishondagi eski asosiy javobgar server
 * tomonidan qo'shimchaga o'tkaziladi (bitta nishonda bitta asosiy).
 */
export function AssignmentsModal({
  person,
  onClose,
}: {
  person: ResponsiblePerson | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [target, setTarget] = useState<'organization' | 'boiler'>(
    'organization',
  );
  const [districtKey, setDistrictKey] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [boilerSearch, setBoilerSearch] = useState('');
  const [boilerId, setBoilerId] = useState('');
  const [type, setType] = useState<ResponsibilityType>('facilities');
  const [isPrimary, setIsPrimary] = useState(false);
  const debouncedSearch = useDebounce(boilerSearch);
  const open = Boolean(person);

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setOrganizationId('');
    setBoilerId('');
    setBoilerSearch('');
    setIsPrimary(false);
    // ⚠️ Tuman mas'uli — o'z tumani; boshqasida — shaxsning uy tumani.
    const own = districts.data?.find((item) => item.id === user?.districtId);
    const home = districts.data?.find(
      (item) => item.id === person?.district?.id,
    );
    setDistrictKey(own?.key ?? home?.key ?? '');
  }, [
    open,
    person?.id,
    districts.data,
    user?.districtId,
    person?.district?.id,
  ]);

  const organizations = useDistrictCatalog(
    'organizations',
    districtKey,
    open && target === 'organization',
  );

  const boilers = useQuery({
    queryKey: qk.boilers({ assign: true, search: debouncedSearch }),
    queryFn: () =>
      getPaged<Boiler>(API.boilers.list, {
        params: { limit: 20, search: debouncedSearch || undefined },
      }),
    enabled: open && target === 'boiler',
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['responsiblePersons'] });

  const add = useMutation({
    mutationFn: () =>
      post(API.responsiblePersons.assignments(person?.id ?? ''), {
        ...(target === 'organization' ? { organizationId } : { boilerId }),
        responsibilityType: type,
        isPrimary,
      }),
    onSuccess: () => {
      toast.success('Biriktirildi');
      setOrganizationId('');
      setBoilerId('');
      setIsPrimary(false);
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const makePrimary = useMutation({
    mutationFn: (assignmentId: string) =>
      patch(API.responsiblePersons.assignment(assignmentId), {
        isPrimary: true,
      }),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (assignmentId: string) =>
      del(API.responsiblePersons.assignment(assignmentId)),
    onSuccess: () => {
      toast.success('Biriktirishdan olindi');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const canAdd = target === 'organization' ? !!organizationId : !!boilerId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Obyektlarga biriktirish"
      description={
        person ? `${person.fullName} · ${person.position}` : undefined
      }
      footer={
        <Button variant="ghost" onClick={onClose}>
          Yopish
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <p className="label-eyebrow flex items-center gap-2">
            Joriy biriktirishlar
            {person?.assignments.length ? (
              <span className="rounded-[4px] bg-[var(--surface-sunken)] px-1 text-[10px] leading-4 text-muted tabular-nums">
                {person.assignments.length}
              </span>
            ) : null}
          </p>
          {person?.assignments.length ? (
            person.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-[var(--border-subtle)] transition-[background-color] duration-200 ring-inset hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.025]',
                  assignment.isPrimary &&
                    'shadow-[inset_3px_0_0_var(--color-warn-400)]',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-semibold text-strong">
                    {assignment.organization?.name ?? assignment.boiler?.label}
                    <span className="font-mono text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">
                      {' '}
                      · {assignment.organization ? 'muassasa' : 'obyekt'}
                    </span>
                  </p>
                  <p className="text-micro text-muted">
                    {assignment.responsibilityLabel}
                  </p>
                </div>
                {assignment.isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warn-50 px-2 py-0.5 text-micro font-semibold text-warn-700 ring-1 ring-warn-200 ring-inset dark:bg-warn-400/12 dark:text-warn-300 dark:ring-warn-400/25">
                    <Star className="size-3 fill-current" /> Asosiy
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={makePrimary.isPending}
                    onClick={() => makePrimary.mutate(assignment.id)}
                  >
                    Asosiy qilish
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Biriktirishdan olish"
                  onClick={() => remove.mutate(assignment.id)}
                >
                  <Trash2 className="size-4 text-danger-500" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-meta text-muted">
              Hali hech qayerga biriktirilmagan.
            </p>
          )}
        </section>

        {/* ⚠️ Bo'lim foni `surface-muted`, `sunken` EMAS: segmentning o'z
            izi `sunken` — bir xil fonda u ko'rinmay qolardi. */}
        <section className="flex flex-col gap-3 rounded-lg bg-[var(--surface-muted)] p-3.5 ring-1 ring-[var(--border-subtle)] ring-inset">
          <p className="label-eyebrow">Yangi biriktirish</p>
          <Segmented
            size="md"
            ariaLabel="Biriktirish nishoni"
            className="self-start"
            value={target}
            onChange={setTarget}
            options={[
              { value: 'organization', label: 'Muassasaga' },
              { value: 'boiler', label: 'Aniq obyektga' },
            ]}
          />

          {target === 'organization' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tuman">
                {(id) => (
                  <Select
                    id={id}
                    value={districtKey}
                    onChange={(event) => {
                      setDistrictKey(event.target.value);
                      setOrganizationId('');
                    }}
                  >
                    <option value="">Tanlang</option>
                    {(districts.data ?? []).map((district) => (
                      <option key={district.id} value={district.key}>
                        {district.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Muassasa" required>
                {(id) => (
                  <Select
                    id={id}
                    value={organizationId}
                    disabled={!districtKey}
                    onChange={(event) => setOrganizationId(event.target.value)}
                  >
                    <option value="">Tanlang</option>
                    {(organizations.data ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Qidirish">
                {(id) => (
                  <Input
                    id={id}
                    value={boilerSearch}
                    onChange={(event) => setBoilerSearch(event.target.value)}
                    placeholder="Lot raqami yoki muassasa…"
                  />
                )}
              </Field>
              <Field label="Obyekt (qozonxona)" required>
                {(id) => (
                  <Select
                    id={id}
                    value={boilerId}
                    onChange={(event) => setBoilerId(event.target.value)}
                  >
                    <option value="">Tanlang</option>
                    {(boilers.data?.items ?? []).map((boiler) => (
                      <option key={boiler.id} value={boiler.id}>
                        {boilerName(
                          boiler.organization?.name,
                          boiler.lotNumber,
                        )}
                        {boiler.district
                          ? ` · ${boiler.district.shortName}`
                          : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Javobgarlik turi">
              {(id) => (
                <Select
                  id={id}
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as ResponsibilityType)
                  }
                >
                  {Object.entries(RESPONSIBILITY_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </Field>
            <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-ink">
              <Switch
                checked={isPrimary}
                onChange={setIsPrimary}
                label="Asosiy javobgar"
              />
              <span>Asosiy javobgar</span>
            </label>
          </div>

          <Button
            variant="primary"
            className="self-start"
            disabled={!canAdd}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Biriktirish
          </Button>
        </section>
      </div>
    </Modal>
  );
}
