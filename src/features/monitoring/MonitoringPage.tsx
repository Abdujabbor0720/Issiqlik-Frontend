import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarOff,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { del, errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { MonitoringScheduleRow, ScheduleScope } from '@/shared/api/types';
import { formatWeekdays } from '@/shared/constants/incident';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { formatTemperature } from '@/shared/utils/format';
import { useAuthStore } from '@/store/auth.store';
import { EscalationRulesTab } from './EscalationRulesTab';
import { HolidaysTab } from './HolidaysTab';
import { ScheduleModal } from './ScheduleModal';

type Tab = 'schedules' | 'holidays' | 'escalation';

const TABS: Array<{ key: Tab; label: string; icon: typeof CalendarClock }> = [
  { key: 'schedules', label: 'Jadvallar', icon: CalendarClock },
  { key: 'holidays', label: 'Bayram kunlari', icon: CalendarOff },
  { key: 'escalation', label: 'Eskalatsiya', icon: TrendingUp },
];

const SCOPE_ORDER: ScheduleScope[] = [
  'global',
  'object_type',
  'organization',
  'boiler',
];

const SCOPE_TITLE: Record<ScheduleScope, string> = {
  global: 'Umumiy jadval (zaxira)',
  object_type: 'Obyekt turlari bo‘yicha',
  organization: 'Muassasalar bo‘yicha',
  boiler: 'Obyektlar (individual)',
};

const SCOPE_HINT: Record<ScheduleScope, string> = {
  global:
    'Jadvali belgilanmagan obyektlar uchun. O‘chirilmaydi — faqat tahrirlanadi.',
  object_type:
    'Maktab, bog‘cha, shifoxona… uchun sukut jadvali (masalan maktab 07:00 dan).',
  organization: 'Muassasa jadvali uning barcha qozonxonalariga amal qiladi.',
  boiler: 'Aniq qozonxona uchun — eng kuchli daraja.',
};

/**
 * MONITORING JADVALI — «qachon past harorat XAVF hisoblanadi».
 *
 * ⚠️ Ustuvorlik: obyekt → muassasa → obyekt turi → umumiy. Har daraja
 * TO'LIQ jadval (maydonlar aralashtirilmaydi) — ekranda ham shunday
 * ko'rsatiladi, aks holda «qaysi soat qayerdan keldi» tushunarsiz bo'lardi.
 *
 * ⚠️ Jadval faqat ODATIY past haroratni yashiradi: qurilma uzilishi,
 * datchik nosozligi, ortiqcha qizish va muzlash xavfi (≤ 5 °C) har
 * doim XAVF — buni sahifada aniq aytamiz.
 */
export function MonitoringPage() {
  const [tab, setTab] = useState<Tab>('schedules');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-sub font-semibold tracking-tight text-strong">
            Monitoring jadvali
          </h1>
          <p className="max-w-2xl text-meta text-muted">
            Past xona/kotyol harorati faqat jadval oynasida XAVF ochadi. Qurilma
            uzilishi, datchik nosozligi, ortiqcha qizish va muzlash xavfi (≤ 5
            °C) — har doim.
          </p>
        </div>
        <div className="flex rounded-full bg-[var(--surface-sunken)] p-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={
                tab === item.key
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-meta font-semibold text-strong shadow-[var(--shadow-hair)]'
                  : 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-meta font-medium text-muted hover:text-strong'
              }
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'schedules' ? <SchedulesTab /> : null}
      {tab === 'holidays' ? <HolidaysTab /> : null}
      {tab === 'escalation' ? <EscalationRulesTab /> : null}
    </div>
  );
}

function SchedulesTab() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const canManage = can('schedules.manage');
  const [editing, setEditing] = useState<MonitoringScheduleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<MonitoringScheduleRow | null>(null);

  const query = useQuery({
    queryKey: qk.schedules,
    queryFn: () => get<MonitoringScheduleRow[]>(API.monitoring.schedules),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(API.monitoring.schedule(id)),
    onSuccess: () => {
      toast.success('Individual jadval olib tashlandi');
      void queryClient.invalidateQueries({ queryKey: qk.schedules });
      setRemoving(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isLoading) return <Skeleton className="h-72" />;
  if (query.isError) {
    return (
      <Card>
        <ErrorState
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }
  const rows = query.data ?? [];

  return (
    <>
      {SCOPE_ORDER.map((scope) => {
        const group = rows.filter((row) => row.scopeType === scope);
        // ⚠️ Individual (obyekt) bo'limi bo'sh bo'lsa ham ko'rinadi — «qo'shish» tugmasi shu yerda.
        if (group.length === 0 && scope !== 'boiler') return null;
        return (
          <Card key={scope} className="overflow-hidden">
            <CardHeader
              title={SCOPE_TITLE[scope]}
              subtitle={SCOPE_HINT[scope]}
              actions={
                canManage && scope === 'boiler' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus className="size-4" />}
                    onClick={() => setCreating(true)}
                  >
                    Individual jadval
                  </Button>
                ) : null
              }
            />
            {group.length === 0 ? (
              <EmptyState
                title="Individual jadval yo‘q"
                description="Obyekt yoki muassasa uchun alohida jadval kerak bo‘lsa, qo‘shing — u turdagi jadvaldan ustun turadi."
                className="py-6"
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Nishon</Th>
                    <Th>Rejim / kunlar</Th>
                    <Th>XAVF monitoringi</Th>
                    <Th>Isitish</Th>
                    <Th align="right">Min. xona</Th>
                    <Th>Bayramlar</Th>
                    <Th align="right" />
                  </tr>
                </thead>
                <tbody>
                  {group.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-medium text-strong">
                        {row.scopeLabel}
                        {row.note ? (
                          <p className="text-micro font-normal text-faint">
                            {row.note}
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        {row.mode === 'always' ? (
                          <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                            24/7
                          </Badge>
                        ) : (
                          formatWeekdays(row.activeDays)
                        )}
                      </Td>
                      <Td className="tabular-nums">
                        {row.mode === 'always'
                          ? 'uzluksiz'
                          : windowLabel(row.monitorStart, row.monitorEnd)}
                      </Td>
                      <Td className="tabular-nums">
                        {row.mode === 'always'
                          ? 'uzluksiz'
                          : windowLabel(row.heatingStart, row.heatingEnd)}
                      </Td>
                      <Td align="right">
                        {row.minRoomTemperature === null ? (
                          <span className="text-faint">umumiy</span>
                        ) : (
                          formatTemperature(row.minRoomTemperature)
                        )}
                      </Td>
                      <Td className="text-muted">
                        {row.mode === 'always'
                          ? '—'
                          : row.observeHolidays
                            ? 'dam olinadi'
                            : 'nazoratda'}
                      </Td>
                      <Td align="right">
                        {canManage ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Tahrirlash"
                              onClick={() => setEditing(row)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {row.scopeType !== 'global' ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Olib tashlash"
                                onClick={() => setRemoving(row)}
                              >
                                <Trash2 className="size-4 text-danger-500" />
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );
      })}

      <ScheduleModal
        open={creating || Boolean(editing)}
        schedule={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title="Individual jadvalni olib tashlash"
        message={
          <>
            «{removing?.scopeLabel}» uchun jadval olib tashlanadi — keyingi
            darajadagi (muassasa / obyekt turi / umumiy) jadval amal qiladi.
          </>
        }
        confirmLabel="Olib tashlash"
        tone="danger"
        loading={remove.isPending}
      />
    </>
  );
}

function windowLabel(start: string, end: string): string {
  return start === end ? 'kun bo‘yi' : `${start}–${end}`;
}
