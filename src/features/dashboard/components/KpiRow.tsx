import {
  Activity,
  Flame,
  Gauge,
  PlugZap,
  ThermometerSun,
  TrendingDown,
} from 'lucide-react';
import type { DashboardSummary } from '@/shared/api/types';
import { StatCard } from '@/shared/ui';
import {
  formatNumber,
  formatPercent,
  formatTemperature,
} from '@/shared/utils/format';

/**
 * ASOSIY KO'RSATKICHLAR QATORI.
 *
 * ⚠️⚠️ Kartalar tartibi TASODIFIY EMAS: «Jami» → «Faol» → «O'rta» →
 * «Ishlamayotgan» → «Aloqa yo'q». Ko'z chapdan o'ngga yurib, umumiy
 * sondan muammoga qarab tushadi; oxirgi karta esa o'rtacha harorat —
 * butun tizimning bitta raqamdagi holati.
 *
 * ⚠️ Raqamlar QO'SHILADI: 196 = 17 + 145 + 34 + 0. Shuning uchun
 * ularning hammasi BITTA agregat so'rovdan keladi (`dashboard.service`
 * dagi izohga qarang) — ketma-ket so'rovlarda yig'indi jamiga teng
 * bo'lmay qolishi mumkin edi.
 */
export function KpiRow({
  summary,
  activeFilter,
  onFilter,
}: {
  summary: DashboardSummary;
  activeFilter?: string | null;
  onFilter?: (status: string | null) => void;
}) {
  const toggle = (status: string) => (): void => {
    onFilter?.(activeFilter === status ? null : status);
  };

  /*
   * ⚠️ `index` — kartalar chapdan o'ngga KETMA-KET chiqadi (60 ms qadam).
   * Tartib yuqoridagi o'qish tartibi bilan AYNI: ko'z qayerdan boshlasa,
   * harakat ham o'sha yerdan boshlanadi.
   */
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        index={0}
        label="Jami qozonxonalar"
        value={formatNumber(summary.total)}
        icon={Flame}
        tone="brand"
        hint={`${formatNumber(summary.boilerUnits)} ta kotyol`}
      />

      <StatCard
        index={1}
        label="Faol ishlayotgan"
        value={formatNumber(summary.active)}
        icon={Activity}
        tone="ok"
        hint={`${formatPercent(summary.activePercent, 1)} · ≥ 50 °C`}
        share={summary.activePercent}
        onClick={onFilter ? toggle('active') : undefined}
        active={activeFilter === 'active'}
      />

      <StatCard
        index={2}
        label="O‘rta ishlayotgan"
        value={formatNumber(summary.medium)}
        icon={Gauge}
        tone="warn"
        hint={`${formatPercent(summary.mediumPercent, 1)} · 40–50 °C`}
        share={summary.mediumPercent}
        onClick={onFilter ? toggle('medium') : undefined}
        active={activeFilter === 'medium'}
      />

      <StatCard
        index={3}
        label="Ishlamayotgan"
        value={formatNumber(summary.inactive)}
        icon={TrendingDown}
        tone="danger"
        hint={`${formatPercent(summary.inactivePercent, 1)} · 20–40 °C`}
        share={summary.inactivePercent}
        onClick={onFilter ? toggle('inactive') : undefined}
        active={activeFilter === 'inactive'}
      />

      <StatCard
        index={4}
        label="Aloqa yo‘q"
        value={formatNumber(summary.offline)}
        icon={PlugZap}
        tone="idle"
        hint={`${formatNumber(summary.devicesOnline)} / ${formatNumber(
          summary.devicesTotal,
        )} modul onlayn`}
        share={summary.offlinePercent}
        onClick={onFilter ? toggle('offline') : undefined}
        active={activeFilter === 'offline'}
      />

      <StatCard
        index={5}
        label="O‘rtacha harorat"
        value={formatTemperature(summary.avgTemperature)}
        icon={ThermometerSun}
        tone={
          summary.avgTemperature === null
            ? 'idle'
            : summary.avgTemperature >= 50
              ? 'ok'
              : summary.avgTemperature >= 40
                ? 'warn'
                : 'danger'
        }
        /* ⚠️ Me'yor bilan TAQQOSLASH ko'rsatiladi, yalang'och raqam
           emas: «54,2 °C» o'z-o'zidan yaxshi ham, yomon ham emas —
           ma'no faqat 60 °C me'yoriga nisbatan paydo bo'ladi. */
        hint={`Me‘yor: ${formatTemperature(summary.normTemperature)}`}
      />
    </div>
  );
}
