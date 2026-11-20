import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, get, put } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { AlertSeverity, EscalationRule } from '@/shared/api/types';
import { AUDIENCE_LABELS } from '@/shared/constants/incident';
import { ALERT_SEVERITY } from '@/shared/constants/status';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
  Tr,
} from '@/shared/ui';
import { useAuthStore } from '@/store/auth.store';

const CONDITION_LABELS: Record<EscalationRule['condition'], string> = {
  not_acknowledged: 'Qabul qilinmasa',
  not_resolved: 'Bartaraf etilmasa',
};

const TARGETS: Array<EscalationRule['target']> = [
  'region',
  'agency',
  'district',
];

/**
 * ESKALATSIYA QOIDALARI — administrator sozlaydi.
 *
 * ⚠️ Ro'yxat YAXLIT saqlanadi (server butunlay almashtiradi): «2-daraja
 * bor, 1-daraja yo'q» kabi oraliq holat bo'lmasligi uchun.
 *
 * ⚠️ Har daraja bir hodisa uchun BIR MARTA ishlaydi — qoidalar soni
 * xabarlar sonining yuqori chegarasi (cheksiz takror yo'q).
 */
export function EscalationRulesTab() {
  const queryClient = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const canManage = can('escalation.manage');
  const [rows, setRows] = useState<EscalationRule[]>([]);
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: qk.escalationRules,
    queryFn: () => get<EscalationRule[]>(API.incidents.escalationRules),
  });

  useEffect(() => {
    if (query.data && !dirty) setRows(query.data);
  }, [query.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      put<EscalationRule[]>(API.incidents.escalationRules, {
        rules: rows.map((row) => ({
          severity: row.severity,
          level: row.level,
          condition: row.condition,
          afterMinutes: row.afterMinutes,
          target: row.target,
          isActive: row.isActive,
        })),
      }),
    onSuccess: (data) => {
      toast.success('Eskalatsiya qoidalari saqlandi');
      setRows(data);
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: qk.escalationRules });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = (index: number, patch: Partial<EscalationRule>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };

  if (query.isLoading) return <Skeleton className="h-64" />;
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

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Eskalatsiya qoidalari"
        subtitle="Javobgar belgilangan vaqtda qabul qilmasa yoki bartaraf etmasa — XAVF yuqori mas‘ulga ko‘tariladi"
        icon={<TrendingUp className="size-4" />}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setRows((prev) => [
                    ...prev,
                    {
                      severity: null,
                      level: Math.min(9, (prev.at(-1)?.level ?? 0) + 1),
                      condition: 'not_resolved',
                      afterMinutes: 60,
                      target: 'region',
                      isActive: true,
                    },
                  ]);
                  setDirty(true);
                }}
              >
                Qoida
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Save className="size-4" />}
                disabled={!dirty}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Saqlash
              </Button>
            </div>
          ) : null
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Og‘irlik</Th>
            <Th>Daraja</Th>
            <Th>Shart</Th>
            <Th>Necha daqiqadan keyin</Th>
            <Th>Kimga</Th>
            <Th>Faol</Th>
            <Th align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <Tr key={`${row.id ?? 'new'}-${index}`}>
              <Td>
                <Select
                  value={row.severity ?? ''}
                  disabled={!canManage}
                  onChange={(event) =>
                    update(index, {
                      severity: (event.target.value ||
                        null) as AlertSeverity | null,
                    })
                  }
                >
                  <option value="">Hammasi</option>
                  {(['critical', 'warning', 'info'] as const).map((value) => (
                    <option key={value} value={value}>
                      {ALERT_SEVERITY[value].label}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <Input
                  type="number"
                  min={1}
                  max={9}
                  className="w-20"
                  value={row.level}
                  disabled={!canManage}
                  onChange={(event) =>
                    update(index, { level: Number(event.target.value) })
                  }
                />
              </Td>
              <Td>
                <Select
                  value={row.condition}
                  disabled={!canManage}
                  onChange={(event) =>
                    update(index, {
                      condition: event.target
                        .value as EscalationRule['condition'],
                    })
                  }
                >
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <Input
                  type="number"
                  min={1}
                  max={10080}
                  className="w-28"
                  value={row.afterMinutes}
                  disabled={!canManage}
                  onChange={(event) =>
                    update(index, { afterMinutes: Number(event.target.value) })
                  }
                />
              </Td>
              <Td>
                <Select
                  value={row.target}
                  disabled={!canManage}
                  onChange={(event) =>
                    update(index, {
                      target: event.target.value as EscalationRule['target'],
                    })
                  }
                >
                  {TARGETS.map((value) => (
                    <option key={value} value={value}>
                      {AUDIENCE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <Switch
                  checked={row.isActive}
                  disabled={!canManage}
                  onChange={(value) => update(index, { isActive: value })}
                  label="Qoida faol"
                />
              </Td>
              <Td align="right">
                {canManage ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Qoidani olib tashlash"
                    onClick={() => {
                      setRows((prev) => prev.filter((_, i) => i !== index));
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="size-4 text-danger-500" />
                  </Button>
                ) : null}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <CardBody className="py-3 text-micro text-faint">
        Aniq og‘irlikdagi qoida shu darajadagi «Hammasi» qoidasini almashtiradi
        (faolsizi ham — shu yo‘l bilan bitta og‘irlik uchun darajani o‘chirish
        mumkin). Vaqt hodisa ochilgan (yoki qayta ochilgan) paytdan hisoblanadi.
      </CardBody>
    </Card>
  );
}
