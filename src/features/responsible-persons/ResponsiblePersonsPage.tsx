import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Contact,
  Link2,
  Pencil,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { errorMessage, get, getPaged } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type {
  DistrictOption,
  ResponsibleCoverage,
  ResponsiblePerson,
} from '@/shared/api/types';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { formatNumber } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { AssignmentsModal } from './AssignmentsModal';
import { ResponsiblePersonModal } from './ResponsiblePersonModal';

/**
 * JAVOBGAR SHAXSLAR REYESTRI — direktor, xo'jalik mudiri, isitish texnigi.
 *
 * ⚠️ «Tuman mas'ullari» bo'limi bilan CHALKASHTIRMANG: u — tizim hisoblari
 * (tuman operatorlari), bu esa obyektga javob beradigan shaxslar. Ularning
 * ko'pi tizimga umuman kirmaydi, lekin XAVF kartasida F.I.Sh., lavozimi
 * va xizmat telefoni turishi shart.
 *
 * ⚠️ Telefon `responsibles.contacts` ruxsatisiz niqoblangan keladi
 * (server niqoblaydi) — bu yerda qo'shimcha yashirish yo'q.
 */
export function ResponsiblePersonsPage() {
  const can = useAuthStore((state) => state.can);
  const canManage = can('responsibles.manage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<'all' | 'true' | 'false'>('true');
  const [editing, setEditing] = useState<ResponsiblePerson | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<ResponsiblePerson | null>(null);
  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(active === 'all' ? {} : { isActive: active }),
    }),
    [page, debouncedSearch, active],
  );

  const list = useQuery({
    queryKey: qk.responsiblePersons(params),
    queryFn: () =>
      getPaged<ResponsiblePerson>(API.responsiblePersons.list, { params }),
    placeholderData: (previous) => previous,
  });

  const coverage = useQuery({
    queryKey: qk.responsibleCoverage,
    queryFn: () => get<ResponsibleCoverage>(API.responsiblePersons.coverage),
  });

  const districts = useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
  });
  const districtByKey = new Map(
    (districts.data ?? []).map((item) => [item.key, item.name]),
  );

  const items = list.data?.items ?? [];
  // ⚠️ Modal ochiq turganda ro'yxat yangilansa — biriktirishlar ham yangilansin.
  const assigningFresh =
    items.find((item) => item.id === assigning?.id) ?? assigning;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Javobgar shaxslar
          </h1>
          <p className="text-meta text-muted">
            {list.data
              ? `${formatNumber(list.data.meta.total)} ta shaxs`
              : 'Yuklanmoqda…'}{' '}
            · XAVF kartasida ko‘rsatiladi
          </p>
        </div>
        {canManage ? (
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setCreating(true)}
          >
            Javobgar qo‘shish
          </Button>
        ) : null}
      </div>

      {coverage.data && coverage.data.withoutPrimary > 0 ? (
        <Card className="border border-warn-200 dark:border-warn-400/30">
          <CardHeader
            title={`${coverage.data.withoutPrimary} ta muassasada asosiy javobgar yo‘q`}
            subtitle={`Monitoringdagi ${coverage.data.total} ta muassasadan ${coverage.data.withPrimary} tasida bor. Bu yerdagi XAVF «hech kimga» qolmasligi uchun javobgar biriktiring.`}
            icon={<AlertTriangle className="size-4 text-warn-500" />}
          />
          <CardBody className="flex flex-wrap gap-1.5 pt-0">
            {coverage.data.missing.slice(0, 40).map((org) => (
              <Badge
                key={org.id}
                className="bg-warn-50 text-warn-800 ring-1 ring-warn-200 dark:bg-warn-400/10 dark:text-warn-200"
              >
                {org.name}
                {org.districtKey ? (
                  <span className="text-warn-600/80">
                    · {districtByKey.get(org.districtKey) ?? org.districtKey}
                  </span>
                ) : null}
              </Badge>
            ))}
            {coverage.data.missing.length > 40 ? (
              <span className="text-micro text-muted">
                va yana {coverage.data.missing.length - 40} ta
              </span>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_200px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="F.I.Sh., lavozim yoki tashkilot…"
            leading={<Search className="size-4" />}
          />
          <Select
            value={active}
            onChange={(event) => {
              setActive(event.target.value as typeof active);
              setPage(1);
            }}
          >
            <option value="true">Faollar</option>
            <option value="false">Faol emaslar</option>
            <option value="all">Hammasi</option>
          </Select>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {list.isLoading ? (
          <CardBody>
            <Skeleton className="h-72" />
          </CardBody>
        ) : list.isError ? (
          <ErrorState
            message={errorMessage(list.error)}
            onRetry={() => void list.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Contact}
            title="Javobgar shaxs topilmadi"
            description="Muassasa direktori, xo‘jalik mudiri va isitish texnigini qo‘shing — XAVF shu shaxslar bilan yuboriladi."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>F.I.Sh. / lavozim</Th>
                  <Th>Xizmat telefoni</Th>
                  <Th>Biriktirilgan obyektlar</Th>
                  <Th>Tuman</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {items.map((person) => (
                  <Tr key={person.id}>
                    <Td>
                      <p className="font-semibold text-strong">
                        {person.fullName}
                        {!person.isActive ? (
                          <Badge className="ml-2 bg-[var(--surface-sunken)] text-faint">
                            faol emas
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-meta text-muted">
                        {person.position}
                        {person.employer ? ` · ${person.employer}` : ''}
                      </p>
                      {person.user ? (
                        <p className="text-micro text-faint">
                          Panel hisobi: {person.user.login}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <p className="text-ink tabular-nums">{person.phone}</p>
                      {person.email ? (
                        <p className="text-micro text-faint">{person.email}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {person.assignments.length === 0 ? (
                          <span className="text-meta text-faint">—</span>
                        ) : (
                          person.assignments.map((assignment) => (
                            <Badge
                              key={assignment.id}
                              className={
                                assignment.isPrimary
                                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300'
                                  : 'bg-[var(--surface-sunken)] text-muted'
                              }
                            >
                              {assignment.isPrimary ? (
                                <Star className="size-3 fill-current" />
                              ) : null}
                              {assignment.organization?.name ??
                                assignment.boiler?.label}
                            </Badge>
                          ))
                        )}
                      </div>
                    </Td>
                    <Td className="text-muted">
                      {person.district?.name ?? 'Viloyat'}
                    </Td>
                    <Td align="right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Link2 className="size-3.5" />}
                            onClick={() => setAssigning(person)}
                          >
                            Biriktirish
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Tahrirlash"
                            onClick={() => setEditing(person)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {list.data ? (
              <Pagination meta={list.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <ResponsiblePersonModal
        open={creating || Boolean(editing)}
        person={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <AssignmentsModal
        person={assigningFresh}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}
