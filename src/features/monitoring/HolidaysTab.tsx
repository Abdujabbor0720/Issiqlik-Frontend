import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { del, errorMessage, get, post } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { MonitoringHoliday } from '@/shared/api/types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@/shared/ui';
import { formatDateUz } from '@/shared/utils/date';
import { useAuthStore } from '@/store/auth.store';

/**
 * BAYRAM VA DAM OLISH KUNLARI — butun viloyat uchun.
 *
 * ⚠️ Faqat «bayramlar dam olinadi» belgilangan jadvallarga ta'sir qiladi:
 * shifoxona (24/7) bayramda ham nazoratda. Hayit sanalari har yili e'lon
 * qilinadi — ularni shu yerda qo'shish kerak.
 *
 * ⚠️ Sana `YYYY-MM-DD` satri — UTC yarim tuni sifatida formatlanadi, aks
 * holda brauzer mintaqasi kunni bir kunga siljitib yuborishi mumkin.
 */
export function HolidaysTab() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const canManage = can('schedules.manage');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [day, setDay] = useState('');
  const [name, setName] = useState('');

  const query = useQuery({
    queryKey: qk.holidays(year),
    queryFn: () =>
      get<MonitoringHoliday[]>(API.monitoring.holidays, { params: { year } }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['monitoring', 'holidays'] });

  const add = useMutation({
    mutationFn: () => post(API.monitoring.holidays, { day, name: name.trim() }),
    onSuccess: () => {
      toast.success('Bayram kuni qo‘shildi');
      setDay('');
      setName('');
      void invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(API.monitoring.holiday(id)),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Bayram va dam olish kunlari"
        subtitle="Jadval rejimidagi obyektlarda bu kunlari past xona harorati XAVF ochmaydi"
        icon={<CalendarOff className="size-4" />}
        actions={
          <Select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
              <option key={value} value={value}>
                {value}-yil
              </option>
            ))}
          </Select>
        }
      />

      {canManage ? (
        <CardBody className="grid grid-cols-1 items-end gap-2 border-b border-[var(--border-subtle)] sm:grid-cols-[180px_1fr_auto]">
          <Input
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ramazon hayiti"
          />
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            disabled={!day || !name.trim()}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Qo‘shish
          </Button>
        </CardBody>
      ) : null}

      {query.isLoading ? (
        <CardBody>
          <Skeleton className="h-40" />
        </CardBody>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={`${year}-yil uchun bayram kiritilmagan`}
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col">
          {(query.data ?? []).map((holiday, index) => (
            <li key={holiday.id}>
              {index > 0 ? <div className="h-px bg-line" /> : null}
              <div className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-36 shrink-0 text-ui font-semibold text-strong tabular-nums">
                  {formatDateUz(`${holiday.day}T00:00:00Z`)}
                </span>
                <span className="flex-1 text-ui text-ink">{holiday.name}</span>
                {canManage ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="O‘chirish"
                    onClick={() => remove.mutate(holiday.id)}
                  >
                    <Trash2 className="size-4 text-danger-500" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
