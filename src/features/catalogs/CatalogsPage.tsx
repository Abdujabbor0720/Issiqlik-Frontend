import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Building2,
  Factory,
  Landmark,
  Library,
  MapPinned,
  Pencil,
  Plus,
  Search,
  Shapes,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { del, errorMessage, getPaged, patch, post } from '@/shared/api/client';
import { API, qk, type CatalogKind } from '@/shared/api/endpoints';
import type { CatalogItem, DistrictOption } from '@/shared/api/types';
import {
  useDistrictCatalog,
  useDistricts,
} from '@/shared/hooks/useCatalogOptions';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
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
  Pagination,
  Select,
  Skeleton,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import { orDash } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';

interface TabConfig {
  kind: CatalogKind;
  label: string;
  icon: typeof Library;
  /** Qo'shimcha ustunlar — har katalogda boshqacha. */
  extraColumns: Array<{ header: string; key: keyof CatalogItem }>;
  emptyHint: string;
  /** ⚠️ MFYda izoh ustuni yo'q — ustun ham, maydon ham ko'rsatilmaydi. */
  hasNote: boolean;
  /** Tumanga (kalit bilan) bog'langan katalog — ro'yxatda tuman filtri. */
  byDistrict: boolean;
}

/** Tumanga bog'langan kataloglar: muassasa va MFY. */
function isDistrictKind(kind: CatalogKind): boolean {
  return kind === 'organizations' || kind === 'mahallas';
}

/**
 * ⚠️ Uchala katalog BITTA sahifada, tablar bilan. Ular bir xil
 * qoidalarga bo'ysunadi (nom yagona, o'chirish o'rniga arxivlash) va
 * uchta alohida sahifa bo'lsa, foydalanuvchi ular orasida sakrab
 * yurardi — holbuki kotyol formasini to'ldirayotgan odam ko'pincha
 * ikkalasiga ham yangi yozuv qo'shishi kerak bo'ladi.
 */
const TABS: TabConfig[] = [
  {
    kind: 'brands',
    label: 'Kotyol markalari',
    icon: Library,
    extraColumns: [{ header: 'Davlat', key: 'country' }],
    emptyHint:
      'Marka qo‘shilsa, hisobotlarda «qaysi marka ishonchliroq» kesimi paydo bo‘ladi.',
    hasNote: true,
    byDistrict: false,
  },
  {
    kind: 'firms',
    label: 'DXSH firmalar',
    icon: Factory,
    extraColumns: [
      { header: 'STIR', key: 'tin' },
      { header: 'Rahbar', key: 'directorName' },
      { header: 'Telefon', key: 'phone' },
    ],
    emptyHint:
      'Xizmat ko‘rsatuvchi firmalar ro‘yxati — kotyol formasida tanlanadi.',
    hasNote: true,
    byDistrict: false,
  },
  {
    kind: 'organizations',
    label: 'Muassasalar',
    icon: Building2,
    extraColumns: [
      { header: 'Obyekt turi', key: 'objectType' },
      { header: 'Tuman', key: 'districtKey' },
      { header: 'MFY', key: 'mahalla' },
      { header: 'Tashkilot', key: 'agency' },
      { header: 'Telefon', key: 'phone' },
    ],
    emptyHint: 'Qozonxona o‘rnatilgan obyektlar: maktab, bog‘cha, shifoxona.',
    hasNote: true,
    byDistrict: true,
  },
  /*
   * ⚠️ TASHKILOT / BOSHQARMA — muassasa QARASHLI bo'lgan idora («MMTB
   * bo'limi», «Sog'liqni saqlash boshqarmasi»). XAVF tuman mas'uli bilan
   * birga shu idora mas'ullariga ham boradi. Obyekt turi bilan chalkashmasin:
   * tur — «bino nima», tashkilot — «kim javob beradi».
   */
  {
    kind: 'agencies',
    label: 'Tashkilotlar',
    icon: Landmark,
    extraColumns: [
      { header: 'Tuman', key: 'districtKey' },
      { header: 'Telefon', key: 'phone' },
    ],
    emptyHint:
      'Boshqarma va bo‘limlar — muassasa formasida tanlanadi, XAVF ularning mas‘ullariga ham boradi.',
    hasNote: true,
    byDistrict: false,
  },
  /*
   * ⚠️ MFY — tumanning birligi: muassasaning MFYsi uning o'z tumanidan
   * bo'lishi SHART (server tekshiradi). Shuning uchun MFY tuman bilan
   * birga yaratiladi va muassasa formasida faqat shu tuman MFYlari
   * ko'rinadi.
   */
  {
    kind: 'mahallas',
    label: 'MFYlar',
    icon: MapPinned,
    extraColumns: [{ header: 'Tuman', key: 'districtKey' }],
    emptyHint:
      'Mahalla fuqarolar yig‘inlari — muassasa formasida tuman bo‘yicha tanlanadi.',
    hasNote: false,
    byDistrict: true,
  },
  /*
   * ⚠️ OBYEKT TURI — alohida katalog. Ilgari u kodga qotirilgan
   * ro'yxat edi va yangi tur qo'shish uchun reliz kerak bo'lardi;
   * endi admin uni o'zi to'ldiradi va tashkilot formasi shu
   * ro'yxatdan tanlaydi.
   */
  {
    kind: 'object-types',
    label: 'Obyekt turlari',
    icon: Shapes,
    extraColumns: [{ header: 'Kalit', key: 'code' }],
    emptyHint:
      'Maktab, bog‘cha, shifoxona… — muassasa formasida shulardan tanlanadi.',
    hasNote: true,
    byDistrict: false,
  },
];

export function CatalogsPage() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);

  const [kind, setKind] = useState<CatalogKind>('brands');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  /** Tuman filtri — KALIT bo'yicha (muassasa va MFY tuman kalitiga bog'langan). */
  const [districtKey, setDistrictKey] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);

  const debouncedSearch = useDebounce(search);
  const tab = TABS.find((item) => item.kind === kind) ?? TABS[0];

  const districts = useDistricts();
  const districtByKey = useMemo(
    () =>
      new Map<string, DistrictOption>(
        (districts.data ?? []).map((item) => [item.key, item]),
      ),
    [districts.data],
  );

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(includeArchived ? { includeArchived: true } : {}),
      // ⚠️ Faqat tumanga bog'langan kataloglarda (muassasa, MFY).
      ...(isDistrictKind(kind) && districtKey ? { districtKey } : {}),
    }),
    [page, debouncedSearch, includeArchived, kind, districtKey],
  );

  const query = useQuery({
    queryKey: qk.catalog(kind, params),
    queryFn: () => getPaged<CatalogItem>(API.catalogs.list(kind), { params }),
    placeholderData: (previous) => previous,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      patch(API.catalogs.one(kind, id), { isArchived: archived }),
    onSuccess: (_result, variables) => {
      toast.success(variables.archived ? 'Arxivlandi' : 'Arxivdan qaytarildi');
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => del(API.catalogs.one(kind, id)),
    onSuccess: () => {
      toast.success('Yozuv o‘chirildi');
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setRemoving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Kataloglar
          </h1>
          <p className="text-meta text-muted">
            Marka, firma, muassasa va MFY ro‘yxatlari — kotyol formasida
            shulardan tanlanadi
          </p>
        </div>

        {can('catalogs.manage') ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="size-3.5" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Yangi yozuv
          </Button>
        ) : null}
      </div>

      {/* ───── Tablar ───── */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {TABS.map((item) => (
          <button
            key={item.kind}
            type="button"
            onClick={() => {
              setKind(item.kind);
              setPage(1);
              setSearch('');
            }}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-meta font-medium transition-colors',
              kind === item.kind
                ? 'bg-brand-600 text-white shadow-[var(--shadow-brand)]'
                : 'bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] hover:text-strong',
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nomi bo‘yicha qidirish…"
              leading={<Search className="size-4" />}
            />
          </div>

          {/* ⚠️ Tuman mas'uliga server o'z tumanini MAJBURLAYDI — bitta
              variantli filtr ma'nosiz, shuning uchun yashiriladi. */}
          {tab.byDistrict && (districts.data?.length ?? 0) > 1 ? (
            <Select
              aria-label="Tuman bo‘yicha"
              value={districtKey}
              onChange={(event) => {
                setDistrictKey(event.target.value);
                setPage(1);
              }}
              className="w-auto min-w-[180px]"
            >
              <option value="">Barcha tumanlar</option>
              {(districts.data ?? []).map((district) => (
                <option key={district.id} value={district.key}>
                  {district.name}
                </option>
              ))}
            </Select>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setIncludeArchived((value) => !value);
              setPage(1);
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-colors',
              includeArchived
                ? 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-200'
                : 'text-muted ring-1 ring-[var(--border-strong)] hover:text-strong',
            )}
          >
            <Archive className="size-3.5" />
            Arxivdagilar
          </button>
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
            icon={tab.icon}
            title="Yozuv topilmadi"
            description={tab.emptyHint}
            action={
              can('catalogs.manage') ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Qo‘shish
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Nomi</Th>
                  {tab.extraColumns.map((column) => (
                    <Th key={column.header}>{column.header}</Th>
                  ))}
                  {tab.hasNote ? <Th>Izoh</Th> : null}
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Tr
                    key={item.id}
                    className={cn(item.isArchived && 'opacity-60')}
                  >
                    <Td className="font-medium text-strong">
                      {item.name}
                      {item.isArchived ? (
                        <Badge className="ml-2 bg-[var(--surface-sunken)] text-faint">
                          arxiv
                        </Badge>
                      ) : null}
                    </Td>

                    {tab.extraColumns.map((column) => (
                      <Td key={column.header} className="text-muted">
                        {column.key === 'objectType' ? (
                          orDash(item.objectType?.name)
                        ) : column.key === 'mahalla' ? (
                          orDash(item.mahalla?.name)
                        ) : column.key === 'agency' ? (
                          orDash(item.agency?.name)
                        ) : column.key === 'districtKey' ? (
                          /* ⚠️ Kalit EMAS, tuman NOMI: kalit mashina qiymati.
                             Noma'lum kalit esa o'zicha ko'rinadi. */
                          orDash(
                            item.districtKey
                              ? (districtByKey.get(item.districtKey)?.name ??
                                  item.districtKey)
                              : null,
                          )
                        ) : column.key === 'code' ? (
                          /* Kalit — mashina qiymati, shuning uchun
                             monoshrift va «kod» ko'rinishida. */
                          <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-micro">
                            {orDash(item.code)}
                          </code>
                        ) : (
                          orDash(item[column.key] as string | null)
                        )}
                      </Td>
                    ))}

                    {tab.hasNote ? (
                      <Td className="max-w-[280px] truncate text-muted">
                        {orDash(item.note)}
                      </Td>
                    ) : null}

                    <Td align="right">
                      <span className="flex items-center justify-end gap-1">
                        {can('catalogs.manage') ? (
                          <>
                            <IconButton
                              label="Tahrirlash"
                              onClick={() => {
                                setEditing(item);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </IconButton>

                            <IconButton
                              label={
                                item.isArchived ? 'Qaytarish' : 'Arxivlash'
                              }
                              onClick={() =>
                                archiveMutation.mutate({
                                  id: item.id,
                                  archived: !item.isArchived,
                                })
                              }
                            >
                              {item.isArchived ? (
                                <ArchiveRestore className="size-3.5" />
                              ) : (
                                <Archive className="size-3.5" />
                              )}
                            </IconButton>

                            <IconButton
                              label="O‘chirish"
                              danger
                              onClick={() => setRemoving(item)}
                            >
                              <Trash2 className="size-3.5" />
                            </IconButton>
                          </>
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {query.data ? (
              <Pagination meta={query.data.meta} onPage={setPage} />
            ) : null}
          </>
        )}
      </Card>

      <CatalogFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        kind={kind}
        item={editing}
        districts={districts.data ?? []}
        defaultDistrictKey={districtKey}
      />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeMutation.mutate(removing.id)}
        loading={removeMutation.isPending}
        title="Yozuvni o‘chirish"
        confirmLabel="O‘chirish"
        message={
          <>
            <strong>{removing?.name}</strong> butunlay o‘chiriladi.
            <br />
            <span className="text-muted">
              Agar bu yozuv birorta kotyol yoki muassasada ishlatilgan bo‘lsa,
              server o‘chirishni rad etadi — bunday holatda arxivlang.
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
          : 'hover:bg-[var(--surface-sunken)] hover:text-strong',
      )}
    >
      {children}
    </button>
  );
}

function CatalogFormModal({
  open,
  onClose,
  kind,
  item,
  districts,
  defaultDistrictKey,
}: {
  open: boolean;
  onClose: () => void;
  kind: CatalogKind;
  item: CatalogItem | null;
  districts: DistrictOption[];
  /** Yangi yozuvda — ro'yxat filtridagi tuman (qulaylik uchun). */
  defaultDistrictKey: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    note: '',
    country: '',
    tin: '',
    phone: '',
    directorName: '',
    objectTypeId: '',
    code: '',
    districtKey: '',
    mahallaId: '',
    agencyId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const tab = TABS.find((entry) => entry.kind === kind);

  /*
   * ⚠️ MFY ro'yxati — faqat TANLANGAN TUMAN bo'yicha: boshqa tuman MFYsi
   * server tomonidan rad etiladi («MFY muassasa tumaniga tegishli emas»).
   */
  const mahallas = useDistrictCatalog(
    'mahallas',
    form.districtKey,
    open && kind === 'organizations',
  );

  /*
   * ⚠️ Turlar FAQAT tashkilot formasida so'raladi (`enabled`): marka
   * yoki firma qo'shayotganda bu so'rov bekorga ketardi.
   */
  const objectTypes = useQuery({
    queryKey: qk.catalog('object-types', 'form'),
    queryFn: () =>
      getPaged<CatalogItem>(API.catalogs.list('object-types'), {
        params: { limit: 200 },
      }),
    enabled: open && kind === 'organizations',
    staleTime: 10 * 60 * 1000,
  });

  const agencies = useQuery({
    queryKey: qk.catalog('agencies', 'form'),
    queryFn: () =>
      getPaged<CatalogItem>(API.catalogs.list('agencies'), {
        params: { limit: 200 },
      }),
    enabled: open && kind === 'organizations',
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: item?.name ?? '',
      note: item?.note ?? '',
      country: item?.country ?? '',
      tin: item?.tin ?? '',
      phone: item?.phone ?? '',
      directorName: item?.directorName ?? '',
      objectTypeId: item?.objectTypeId ?? '',
      code: item?.code ?? '',
      districtKey:
        item?.districtKey ??
        (item
          ? ''
          : defaultDistrictKey ||
            (districts.length === 1 ? districts[0].key : '')),
      mahallaId: item?.mahallaId ?? '',
      agencyId: item?.agencyId ?? '',
    });
    setError(null);
    // ⚠️ Faqat oyna OCHILGANDA tiklanadi: tumanlar ro'yxati keyinroq kelsa
    // foydalanuvchi kiritayotgan forma qayta yozilmasin.
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: () => {
      /*
       * ⚠️ Yuk KATALOG TURIGA qarab yig'iladi: `country` faqat
       * markada, `tin` faqat firmada bor. Hammasi yuborilsa, server
       * «bunday maydon kutilmagan» xatosini qaytarardi
       * (`forbidNonWhitelisted`).
       */
      const base: Record<string, unknown> = {
        name: form.name.trim(),
        ...(tab?.hasNote === false
          ? {}
          : { note: form.note.trim() || undefined }),
      };
      if (kind === 'brands') base.country = form.country.trim() || undefined;
      if (kind === 'firms') {
        base.tin = form.tin.trim() || undefined;
        base.phone = form.phone.trim() || undefined;
        base.directorName = form.directorName.trim() || undefined;
      }
      if (kind === 'organizations') {
        // ⚠️ Bo'sh tanlov `null` bo'lib ketadi («tozalash»), `undefined`
        // emas — aks holda biriktirilgan turni olib tashlab bo'lmasdi.
        base.objectTypeId = form.objectTypeId || null;
        base.phone = form.phone.trim() || undefined;
        /*
         * ⚠️ Tuman MFY bilan BIRGA yuboriladi: server MFY tumanini aynan
         * shu maydon bilan solishtiradi. Tumanni `null` ga tushirib
         * bo'lmaydi (server kalit kutadi) — bo'sh bo'lsa yuborilmaydi.
         */
        if (form.districtKey) base.districtKey = form.districtKey;
        base.mahallaId = form.mahallaId || null;
        // ⚠️ Bo'sh — «tozalash» (`null`): muassasa boshqarmadan ajratiladi.
        base.agencyId = form.agencyId || null;
      }
      if (kind === 'agencies') {
        base.phone = form.phone.trim() || undefined;
        // ⚠️ Bo'sh tuman — viloyat darajasidagi idora.
        base.districtKey = form.districtKey || null;
      }
      if (kind === 'mahallas') {
        base.districtKey = form.districtKey || undefined;
      }
      if (kind === 'object-types') {
        base.code = form.code.trim() || undefined;
      }

      return item
        ? patch(API.catalogs.one(kind, item.id), base)
        : post(API.catalogs.list(kind), base);
    },
    onSuccess: () => {
      toast.success(item ? 'Yangilandi' : 'Qo‘shildi');
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const set = (key: keyof typeof form, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={item ? 'Yozuvni tahrirlash' : 'Yangi yozuv'}
      description={TABS.find((tab) => tab.kind === kind)?.label}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!form.name.trim()) {
                setError('Nomi kiritilmagan');
                return;
              }
              if (kind === 'mahallas' && !form.districtKey) {
                setError('MFY uchun tuman tanlanishi shart');
                return;
              }
              setError(null);
              mutation.mutate();
            }}
          >
            {item ? 'Saqlash' : 'Qo‘shish'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nomi" required>
          {(id) => (
            <Input
              id={id}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              autoFocus
            />
          )}
        </Field>

        {kind === 'brands' ? (
          <Field label="Ishlab chiqaruvchi davlat">
            {(id) => (
              <Input
                id={id}
                value={form.country}
                onChange={(event) => set('country', event.target.value)}
                placeholder="Italiya"
              />
            )}
          </Field>
        ) : null}

        {kind === 'firms' ? (
          <>
            <Field label="STIR">
              {(id) => (
                <Input
                  id={id}
                  value={form.tin}
                  onChange={(event) => set('tin', event.target.value)}
                />
              )}
            </Field>
            <Field label="Rahbar F.I.Sh">
              {(id) => (
                <Input
                  id={id}
                  value={form.directorName}
                  onChange={(event) => set('directorName', event.target.value)}
                />
              )}
            </Field>
          </>
        ) : null}

        {kind === 'organizations' ||
        kind === 'mahallas' ||
        kind === 'agencies' ? (
          <Field
            label="Tuman"
            required={kind === 'mahallas'}
            hint={
              kind === 'organizations'
                ? 'MFY ro‘yxati shu tuman bo‘yicha'
                : kind === 'agencies'
                  ? 'Bo‘sh — viloyat darajasidagi idora'
                  : undefined
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.districtKey}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    districtKey: event.target.value,
                    // ⚠️ MFY tumanga tegishli — tuman o'zgarsa tozalanadi.
                    mahallaId: '',
                  }))
                }
              >
                {/* ⚠️ Tumani bor yozuvda bo'sh variant yo'q: server tumanni
                    tozalashni qabul qilmaydi, tanlov esa jim e'tiborsiz qolardi. */}
                <option
                  value=""
                  disabled={kind !== 'agencies' && Boolean(item?.districtKey)}
                >
                  Tanlanmagan
                </option>
                {districts.map((district) => (
                  <option key={district.id} value={district.key}>
                    {district.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {kind === 'organizations' ? (
          <Field
            label="MFY"
            hint={
              !form.districtKey
                ? 'Avval tumanni tanlang'
                : 'Ro‘yxat «MFYlar» katalogidan'
            }
          >
            {(id) => (
              <Select
                id={id}
                value={form.mahallaId}
                disabled={!form.districtKey}
                onChange={(event) => set('mahallaId', event.target.value)}
              >
                <option value="">
                  {mahallas.isFetching ? 'Yuklanmoqda…' : 'Tanlanmagan'}
                </option>
                {/* ⚠️ Joriy MFY ro'yxatda bo'lmasa ham (arxivlangan) qoladi. */}
                {item?.mahalla &&
                form.mahallaId === item.mahalla.id &&
                !(mahallas.data ?? []).some(
                  (entry) => entry.id === item.mahalla?.id,
                ) ? (
                  <option value={item.mahalla.id}>{item.mahalla.name}</option>
                ) : null}
                {(mahallas.data ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {kind === 'organizations' ? (
          <Field
            label="Obyekt turi"
            hint="Ro‘yxat «Obyekt turlari» katalogidan olinadi"
          >
            {(id) => (
              <Select
                id={id}
                value={form.objectTypeId}
                onChange={(event) => set('objectTypeId', event.target.value)}
              >
                <option value="">Tanlanmagan</option>
                {(objectTypes.data?.items ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {kind === 'object-types' ? (
          <Field
            label="Mashina kaliti"
            required={!item}
            hint={
              item
                ? '⚠️ Kalit o‘zgartirilmaydi — unga eski ma‘lumot bog‘langan'
                : 'Kichik lotin harflari, raqam va «_»: masalan sport_school'
            }
          >
            {(id) => (
              <Input
                id={id}
                value={form.code}
                onChange={(event) => set('code', event.target.value)}
                placeholder="sport_school"
                disabled={Boolean(item)}
                className="font-mono"
              />
            )}
          </Field>
        ) : null}

        {kind === 'organizations' ? (
          <Field
            label="Tashkilot (boshqarma)"
            hint="XAVF tuman mas‘uli bilan birga shu idora mas‘ullariga ham boradi"
          >
            {(id) => (
              <Select
                id={id}
                value={form.agencyId}
                onChange={(event) => set('agencyId', event.target.value)}
              >
                <option value="">Biriktirilmagan</option>
                {(agencies.data?.items ?? []).map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        {kind === 'firms' ||
        kind === 'organizations' ||
        kind === 'agencies' ? (
          <Field label="Telefon">
            {(id) => (
              <Input
                id={id}
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="+998 74 123 45 67"
              />
            )}
          </Field>
        ) : null}

        {tab?.hasNote === false ? null : (
          <Field label="Izoh">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={form.note}
                onChange={(event) => set('note', event.target.value)}
              />
            )}
          </Field>
        )}

        {error ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-meta font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
