import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DoorOpen,
  EyeOff,
  Pencil,
  Snowflake,
  Thermometer,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { del, errorMessage, get, patch } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { BoilerRooms, Room, RoomHistorySeries } from '@/shared/api/types';
import { ROOM_CONDITION, ROOM_STALE } from '@/shared/constants/status';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmModal,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  Switch,
} from '@/shared/ui';
import { cn } from '@/shared/utils/cn';
import {
  formatAxisLabel,
  formatDateTimeUz,
  formatRelativeUz,
  formatTimeUz,
} from '@/shared/utils/date';
import { formatTemperature } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

/**
 * XONALAR STATISTIKASI — FAQAT NAZORATDAGI VA DOLZARB O'LCHOVLILAR.
 *
 * ⚠️ Serverdagi qoida bilan AYNI (`RoomsService.summary`): datchigi
 * uzilgan xona oxirgi «22 °C» bilan o'rtachani ko'tarib, «hamma xona
 * iliq» degan yolg'on manzara bermasligi kerak.
 */
export function summarizeRooms(rooms: Room[]): {
  count: number;
  avg: number | null;
  min: number | null;
  cold: number;
} {
  const live = rooms.filter(
    (room) => room.isMonitored && room.isFresh && room.temperature !== null,
  );
  if (live.length === 0) return { count: 0, avg: null, min: null, cold: 0 };
  const values = live.map((room) => room.temperature as number);
  return {
    count: live.length,
    avg:
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    min: Math.min(...values),
    cold: live.filter((room) => room.condition === 'cold').length,
  };
}

/**
 * XONALAR RO'YXATI — kotyol sahifasi va xarita oynasi uchun BITTA
 * komponent: ikki joyda ikki xil ko'rinish bo'lsa, xaritada «sovuq»,
 * kotyol sahifasida «me'yordan past» deb turib qolardi.
 */
export function RoomList({
  rooms,
  onEdit,
  onDelete,
  compact = false,
  seriesColor,
}: {
  rooms: Room[];
  onEdit?: (room: Room) => void;
  onDelete?: (room: Room) => void;
  compact?: boolean;
  /**
   * ⚠️⚠️ Grafik yonida — nuqta XONA rangida (grafik chizig'i bilan AYNI),
   * holat rangida EMAS. Aks holda bitta kartada «2-sinf» ro'yxatda ko'k
   * (sovuq), grafikda to'q sariq bo'lib, ko'z ularni boshqa-boshqa xona
   * deb o'qirdi. Holat baribir yo'qolmaydi: matn («Sovuq») va harorat
   * rangi uni aytadi.
   */
  seriesColor?: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-[var(--border-subtle)]">
      {rooms.map((room) => {
        const meta = room.condition ? ROOM_CONDITION[room.condition] : null;
        return (
          <li
            key={room.id}
            className={cn(
              'flex items-center gap-3',
              compact ? 'py-1.5' : 'py-2.5',
              !room.isMonitored && 'opacity-60',
            )}
          >
            {seriesColor ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: seriesColor.get(room.id) }}
                aria-hidden
              />
            ) : (
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  meta?.dot ?? ROOM_STALE.dot,
                )}
                aria-hidden
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-ui font-medium text-strong">
                <span className="truncate">{room.name}</span>
                {room.isAutoCreated && !compact ? (
                  <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-200">
                    yangi — nomlang
                  </Badge>
                ) : null}
                {!room.isMonitored ? (
                  <Badge className="bg-[var(--surface-sunken)] text-faint">
                    <EyeOff className="mr-1 inline size-3" aria-hidden />
                    nazoratda emas
                  </Badge>
                ) : null}
              </p>
              {!compact ? (
                <p className="text-micro text-faint">
                  {/*
                    ⚠️ Holat RANG BILAN EMAS, matn bilan ham aytiladi:
                    rang ko'rmaydiganlar (va oq-qora chop etish) uchun.
                  */}
                  {meta ? meta.label : ROOM_STALE.label}
                  {room.lastReadingAt
                    ? ` · ${formatRelativeUz(room.lastReadingAt)}`
                    : ' · hali o‘lchov kelmagan'}
                  {room.note ? ` · ${room.note}` : ''}
                </p>
              ) : null}
            </div>

            <span
              className={cn(
                'shrink-0 font-semibold tabular-nums',
                compact ? 'text-ui' : 'text-lede',
                meta?.text ?? ROOM_STALE.text,
              )}
              data-numeric
              title={meta ? meta.label : ROOM_STALE.label}
            >
              {formatTemperature(room.temperature)}
            </span>

            {onEdit || onDelete ? (
              <span className="flex shrink-0 items-center gap-0.5">
                {onEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`«${room.name}» xonasini tahrirlash`}
                    title="Tahrirlash"
                    onClick={() => onEdit(room)}
                    icon={<Pencil className="size-3.5" />}
                  />
                ) : null}
                {onDelete ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`«${room.name}» xonasini o‘chirish`}
                    title="O‘chirish"
                    onClick={() => onDelete(room)}
                    icon={<Trash2 className="size-3.5" />}
                  />
                ) : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** KOTYOL SAHIFASIDAGI «XONALAR HARORATI» KARTASI. */
export function RoomsPanel({ boilerId }: { boilerId: string }) {
  const can = useAuthStore((state) => state.can);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Room | null>(null);
  const [removing, setRemoving] = useState<Room | null>(null);

  const roomsQuery = useQuery({
    queryKey: qk.rooms(boilerId),
    queryFn: () => get<BoilerRooms>(API.rooms.byBoiler(boilerId)),
    /*
     * ⚠️ Daqiqada bir yangilanadi: qurilma ham shunday yuboradi. Tezroq
     * so'rash yangi ma'lumot bermaydi, faqat serverni yuklaydi.
     */
    refetchInterval: 60_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: qk.rooms(boilerId) });
    void queryClient.invalidateQueries({ queryKey: ['roomHistory', boilerId] });
    void queryClient.invalidateQueries({ queryKey: ['points'] });
    void queryClient.invalidateQueries({ queryKey: ['roomsSummary'] });
  };

  const removeMutation = useMutation({
    mutationFn: (room: Room) => del(API.rooms.one(room.id)),
    onSuccess: () => {
      toast.success('Xona o‘chirildi');
      setRemoving(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const dark = useUiStore((state) => state.theme === 'dark');
  const rooms = useMemo(() => roomsQuery.data?.rooms ?? [], [roomsQuery.data]);
  const thresholds = roomsQuery.data?.thresholds;
  const stats = summarizeRooms(rooms);
  const canEdit = can('boilers.update');

  /*
   * ⚠️ Rang xaritasi BIR JOYDA — ro'yxat ham, grafik ham shuni oladi.
   * Rang XONAGA tartib raqami bo'yicha biriktiriladi (saralangan
   * o'rniga emas): grafikda xona yashirilganda qolganlarining rangi
   * O'ZGARMAYDI.
   */
  const seriesColor = useMemo(() => {
    const palette = dark ? SERIES_DARK : SERIES_LIGHT;
    const map = new Map<string, string>();
    rooms.forEach((room, index) => {
      map.set(room.id, palette[index] ?? OVERFLOW_HEX);
    });
    return map;
  }, [rooms, dark]);

  return (
    <Card>
      <CardHeader
        icon={<DoorOpen className="size-4" />}
        eyebrow="Bino ichi"
        title="Xonalar harorati"
        subtitle={
          thresholds
            ? `Me‘yor ${thresholds.normC} °C · eng past ruxsat ${thresholds.minC} °C. ` +
              'Yangi havo datchigi ulansa, xona o‘zi paydo bo‘ladi — uni shu yerda nomlang.'
            : undefined
        }
      />
      <CardBody>
        {roomsQuery.isLoading ? (
          <Skeleton className="h-32" />
        ) : roomsQuery.isError ? (
          <ErrorState
            message={errorMessage(roomsQuery.error)}
            onRetry={() => void roomsQuery.refetch()}
          />
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Thermometer className="size-6 text-faint" aria-hidden />
            <p className="text-ui font-medium text-strong">
              Xona harorati hali kelmagan
            </p>
            <p className="max-w-md text-meta text-muted">
              ESP32 moduli havo datchiklari qiymatini yubora boshlaganda xonalar
              shu yerda avtomatik paydo bo‘ladi. Modul ulanmagan bo‘lsa, avval
              uni kotyolga biriktiring.
            </p>
          </div>
        ) : (
          <>
            <dl className="mb-3 grid grid-cols-3 gap-2">
              <Stat label="O‘rtacha" value={formatTemperature(stats.avg)} />
              <Stat label="Eng past" value={formatTemperature(stats.min)} />
              <Stat
                label="Sovuq xonalar"
                value={stats.count ? `${stats.cold} / ${stats.count}` : '—'}
                tone={stats.cold > 0 ? 'cold' : undefined}
              />
            </dl>

            <RoomList
              rooms={rooms}
              seriesColor={seriesColor}
              onEdit={canEdit ? setEditing : undefined}
              onDelete={canEdit ? setRemoving : undefined}
            />

            {thresholds ? (
              <RoomsChart
                boilerId={boilerId}
                rooms={rooms}
                thresholds={thresholds}
                colorOf={seriesColor}
              />
            ) : null}
          </>
        )}
      </CardBody>

      <RoomEditModal
        room={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          invalidate();
        }}
      />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeMutation.mutate(removing)}
        loading={removeMutation.isPending}
        tone="danger"
        title="Xonani o‘chirish"
        confirmLabel="O‘chirish"
        message={
          <>
            <strong>«{removing?.name}»</strong> xonasi va uning butun tarixi
            o‘chiriladi. Datchik hali ulangan bo‘lsa, xona keyingi signalda{' '}
            <strong>yana paydo bo‘ladi</strong> (nomsiz). Datchikni vaqtincha
            yashirish uchun «Nazoratda» belgisini o‘chiring.
          </>
        }
      />
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'cold';
}) {
  return (
    <div className="rounded-tile bg-[var(--surface-sunken)] px-3 py-2">
      <dt className="text-micro text-muted">{label}</dt>
      <dd
        className={cn(
          'text-lede font-semibold text-strong tabular-nums',
          tone === 'cold' && ROOM_CONDITION.cold.text,
        )}
        data-numeric
      >
        {tone === 'cold' ? (
          <Snowflake className="mr-1 inline size-4 align-[-2px]" aria-hidden />
        ) : null}
        {value}
      </dd>
    </div>
  );
}

/** XONANI TAHRIRLASH — nom, izoh, tartib, nazorat. */
function RoomEditModal({
  room,
  onClose,
  onSaved,
}: {
  room: Room | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal
      open={Boolean(room)}
      onClose={onClose}
      title="Xonani tahrirlash"
      description={
        room ? `Datchik: ${room.sensorKey} — bu manzil o‘zgarmaydi` : undefined
      }
      size="sm"
    >
      {/*
        ⚠️ Forma `key` bilan qayta yaratiladi: boshqa xona ochilganda
        oldingi xonaning yozilgan, saqlanmagan nomi ko'chib o'tmasligi
        uchun.
      */}
      {room ? (
        <RoomEditForm key={room.id} room={room} onSaved={onSaved} />
      ) : null}
    </Modal>
  );
}

function RoomEditForm({ room, onSaved }: { room: Room; onSaved: () => void }) {
  const [name, setName] = useState(room.name);
  const [note, setNote] = useState(room.note ?? '');
  const [sortOrder, setSortOrder] = useState(String(room.sortOrder));
  const [isMonitored, setIsMonitored] = useState(room.isMonitored);

  const mutation = useMutation({
    mutationFn: () =>
      patch<Room>(API.rooms.one(room.id), {
        name: name.trim(),
        note: note.trim(),
        sortOrder: Number(sortOrder) || 0,
        isMonitored,
      }),
    onSuccess: () => {
      toast.success('Saqlandi');
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const nameError = name.trim() ? null : 'Xona nomini kiriting';

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!nameError) mutation.mutate();
      }}
    >
      <Field label="Nomi" required error={nameError}>
        {(id) => (
          <Input
            id={id}
            value={name}
            maxLength={120}
            autoFocus
            placeholder="1-sinf, Direktor xonasi, Sport zali…"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field label="Izoh" hint="Masalan: 2-qavat, chap tomon">
        {(id) => (
          <Input
            id={id}
            value={note}
            maxLength={400}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>
      <Field label="Ro‘yxatdagi tartibi" hint="Kichigi yuqorida">
        {(id) => (
          <Input
            id={id}
            type="number"
            min={0}
            max={10000}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        )}
      </Field>
      <div className="flex items-start justify-between gap-3 rounded-tile bg-[var(--surface-sunken)] px-3 py-2.5">
        <div>
          <p className="text-ui font-medium text-strong">Nazoratda</p>
          <p className="text-micro text-muted">
            O‘chirilsa — xona ko‘rinadi, lekin o‘rtacha haroratga va
            ogohlantirishlarga kirmaydi (qozonxona xonasi, ta‘mirdagi xona).
          </p>
        </div>
        <Switch
          checked={isMonitored}
          onChange={setIsMonitored}
          label="Nazoratda"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="submit"
          variant="primary"
          loading={mutation.isPending}
          disabled={Boolean(nameError)}
        >
          Saqlash
        </Button>
      </div>
    </form>
  );
}

/**
 * TOIFALI PALITRA — `dataviz` skilli bilan tekshirilgan (validate_palette.js):
 * yorug' fon #ffffff va qorong'i fon #151d27 da BARCHA tekshiruvlar o'tdi
 * (CVD ΔE ≥ 8.4, oddiy ko'rish ΔE ≥ 19.3).
 *
 * ⚠️ Yorug' rejimda 3 rang (yashil-moviy, sariq, pushti) fonga nisbatan
 * 3:1 dan past — shuning uchun grafik YONIDA har xona nomi va qiymati
 * matn bilan turadi (yuqoridagi ro'yxat = jadval ko'rinishi) va afsona
 * nomlar bilan. Rang yagona belgi EMAS.
 *
 * ⚠️ Rang XONAGA biriktiriladi (tartib raqami bo'yicha), saralangan
 * o'rinniga emas: filtr o'zgarganda xonalar rangini almashtirmasligi
 * kerak. 8 tadan keyingilari — kulrang (rang aylantirib qayta
 * ishlatilmaydi: ikkita xona bir xil rangda bo'lib qolardi).
 */
const SERIES_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];
const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#0ca30c',
  '#9085e9',
  '#e66767',
];
const OVERFLOW_HEX = '#97a5b7';

const RANGES = { 24: '24 soat', 168: '7 kun' } as const;
type RangeHours = keyof typeof RANGES;

/**
 * XONALAR GRAFIGI.
 *
 * ⚠️ BITTA o'q (°C) — hamma xona bir o'lchovda. Me'yor va minimum —
 * NEYTRAL punktir chiziqlar YORLIG'I bilan: holat ranglari (yashil /
 * qizil) seriya ranglari bilan to'qnashmasligi uchun.
 */
function RoomsChart({
  boilerId,
  rooms,
  thresholds,
  colorOf,
}: {
  boilerId: string;
  rooms: Room[];
  thresholds: { minC: number; normC: number };
  colorOf: Map<string, string>;
}) {
  const dark = useUiStore((state) => state.theme === 'dark');
  const [hours, setHours] = useState<RangeHours>(24);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const historyQuery = useQuery({
    queryKey: qk.roomHistory(boilerId, hours),
    queryFn: () =>
      get<RoomHistorySeries[]>(API.rooms.history(boilerId), {
        params: { hours },
      }),
    refetchInterval: 5 * 60_000,
  });

  /*
   * ⚠️ Nuqtalar DAQIQAGACHA yaxlitlanib birlashtiriladi: bitta signalda
   * kelgan xonalar bir xil vaqtda yoziladi, lekin keyin qo'shilgan xona
   * boshqa fazada bo'ladi. Birlashtirilmasa, har nuqtada faqat bitta
   * xona bo'lib, chiziqlar uzilib-uzilib chiqardi.
   */
  const { data, series } = useMemo(() => {
    const rows = new Map<number, Record<string, number | string>>();
    const list = historyQuery.data ?? [];
    for (const item of list) {
      for (const point of item.points) {
        const ts = Math.floor(new Date(point.at).getTime() / 60_000) * 60_000;
        const row = rows.get(ts) ?? { ts };
        row[item.roomId] = point.t;
        rows.set(ts, row);
      }
    }
    return {
      data: [...rows.values()].sort((a, b) => Number(a.ts) - Number(b.ts)),
      series: list.filter((item) => item.points.length > 0),
    };
  }, [historyQuery.data]);

  const nameOf = (roomId: string): string =>
    rooms.find((room) => room.id === roomId)?.name ?? '—';

  const toggle = (roomId: string): void => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const tick = { fontSize: 11, fill: dark ? '#8da0b5' : '#97a5b7' };
  const refStroke = dark ? '#8da0b5' : '#637386';

  return (
    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-ui font-medium text-strong">Harorat tarixi</p>
        <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
          {(Object.keys(RANGES) as unknown as RangeHours[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setHours(Number(key) as RangeHours)}
              className={
                Number(hours) === Number(key)
                  ? 'rounded-full bg-[var(--surface)] px-2.5 py-1 text-micro font-semibold text-strong shadow-[var(--shadow-hair)]'
                  : 'rounded-full px-2.5 py-1 text-micro font-medium text-muted transition-colors hover:text-strong'
              }
            >
              {RANGES[key]}
            </button>
          ))}
        </div>
      </div>

      {historyQuery.isLoading ? (
        <Skeleton className="h-[240px]" />
      ) : data.length === 0 ? (
        <div className="grid h-[160px] place-items-center text-meta text-muted">
          Bu davr uchun xona tarixi yo‘q
        </div>
      ) : (
        <>
          {/* AFSONA — nom bilan, bosilsa chiziq yashiriladi. */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {series.map((item) => {
              const off = hidden.has(item.roomId);
              return (
                <button
                  key={item.roomId}
                  type="button"
                  onClick={() => toggle(item.roomId)}
                  aria-pressed={!off}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-medium ring-1 ring-[var(--border-subtle)] transition-opacity',
                    off ? 'text-faint opacity-50' : 'text-ink',
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: colorOf.get(item.roomId) }}
                    aria-hidden
                  />
                  {nameOf(item.roomId)}
                </button>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <CartesianGrid
                stroke={dark ? 'rgba(255,255,255,.07)' : 'rgba(20,45,80,.08)'}
                vertical={false}
              />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tick={tick}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                /*
                 * ⚠️ Sana QO'LDA yig'ilmaydi (`dates.md`): 24 soatda —
                 * aniq vaqt (`HH:mm`), 7 kunda — kun (`21-noy`).
                 */
                tickFormatter={(value: number) =>
                  hours === 24
                    ? formatTimeUz(new Date(value))
                    : formatAxisLabel(new Date(value).toISOString(), 'day')
                }
              />
              <YAxis
                tick={tick}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={[
                  (min: number) =>
                    Math.floor(Math.min(min, thresholds.minC) - 2),
                  (max: number) =>
                    Math.ceil(Math.max(max, thresholds.normC) + 2),
                ]}
                tickFormatter={(value: number) => `${value}°`}
              />
              <ReferenceLine
                y={thresholds.normC}
                stroke={refStroke}
                strokeDasharray="4 4"
                label={{
                  value: `me‘yor ${thresholds.normC}°`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: refStroke,
                }}
              />
              <ReferenceLine
                y={thresholds.minC}
                stroke={refStroke}
                strokeDasharray="2 4"
                label={{
                  value: `eng past ${thresholds.minC}°`,
                  position: 'insideBottomRight',
                  fontSize: 11,
                  fill: refStroke,
                }}
              />
              <Tooltip
                cursor={{ stroke: refStroke, strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const items = [...payload]
                    .filter((entry) => typeof entry.value === 'number')
                    .sort((a, b) => Number(b.value) - Number(a.value));
                  return (
                    <div className="rounded-lg bg-neutral-900 px-3 py-2 text-micro text-white shadow-[var(--shadow-pop)]">
                      <p className="mb-1 font-semibold">
                        {formatDateTimeUz(new Date(Number(label)))}
                      </p>
                      {items.map((entry) => (
                        <p
                          key={String(entry.dataKey)}
                          className="flex items-center gap-1.5"
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ background: entry.color }}
                            aria-hidden
                          />
                          {nameOf(String(entry.dataKey))}:{' '}
                          <strong>
                            {formatTemperature(Number(entry.value))}
                          </strong>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {series.map((item) => (
                <Line
                  key={item.roomId}
                  type="monotone"
                  dataKey={item.roomId}
                  stroke={colorOf.get(item.roomId)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: dark ? '#151d27' : '#ffffff',
                  }}
                  connectNulls
                  hide={hidden.has(item.roomId)}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
