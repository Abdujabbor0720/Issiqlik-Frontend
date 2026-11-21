import { ThermometerSnowflake, ThermometerSun } from 'lucide-react';
import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from 'react';
import { cn } from '@/shared/utils/cn';

/* ───────── Geometriya (viewBox 160×160) ───────── */
const C = 80;
const R = 54;
const START = 135;
const SWEEP = 270;
const MIN_C = 0;
const MAX_C = 100;
/** 0–100 °C, har 2,5 °C — 41 bo'linma; har 10 °C — katta. */
const TICK_COUNT = 40;

function polar(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

const [sx, sy] = polar(START, R);
const [ex, ey] = polar(START + SWEEP, R);
/** To'liq yoy — trek, qiymat va nur uchun BITTA yo'l (`pathLength=100`). */
const ARC = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;

const TICKS = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
  const major = index % 4 === 0;
  const angle = START + (index / TICK_COUNT) * SWEEP;
  const [x1, y1] = polar(angle, major ? 63 : 65.5);
  const [x2, y2] = polar(angle, major ? 72 : 69.5);
  return {
    value: MIN_C + (index / TICK_COUNT) * (MAX_C - MIN_C),
    major,
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
  };
});

const [lx, ly] = polar(START, 74);
const [hx, hy] = polar(START + SWEEP, 74);

const toPct = (value: number): number =>
  Math.min(100, Math.max(0, ((value - MIN_C) / (MAX_C - MIN_C)) * 100));

const formatValue = (value: number): string =>
  value.toFixed(1).replace('.', ',');

/**
 * Raqamni yangi qiymatga SILLIQ olib boradi (0,8 s) va bir lahza
 * yoritadi — React'ni har kadrda qayta chizmasdan, to'g'ridan-to'g'ri
 * matn tuguniga yozib.
 *
 * ⚠️ `span` ning bolasi React'da YO'Q (matnni faqat shu hook yozadi):
 * aks holda React o'zi boshqaradigan matn tugunini biz almashtirib
 * qo'yib, keyingi yangilanishda u ko'rinmay qolgan tugunga yozardi.
 */
function useTweenedText(
  ref: RefObject<HTMLSpanElement | null>,
  value: number | null,
  animate: boolean,
): void {
  /*
   * ⚠️ `shown` — EKRANDA turgan qiymat (o'tish o'rtasida ham). Yangi
   * qiymat o'tish tugamasdan kelsa, u shu joydan davom etadi: avvalgi
   * MAQSADDAN boshlansa, raqam oldinga «sakrab», keyin yana sanardi.
   */
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const from = shown.current;

    if (value === null) {
      shown.current = null;
      element.textContent = '—';
      return;
    }
    if (!animate || from === null || Math.abs(from - value) < 0.05) {
      shown.current = value;
      element.textContent = formatValue(value);
      return;
    }

    element.classList.remove('gauge-flash');
    void element.offsetWidth; // animatsiyani qayta boshlash
    element.classList.add('gauge-flash');

    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - startedAt) / 800);
      const eased = 1 - (1 - t) ** 3;
      const current = from + (value - from) * eased;
      shown.current = current;
      element.textContent = formatValue(current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Faqat to'xtatadi: davomini keyingi effekt `shown` dan oladi.
    return () => cancelAnimationFrame(frame);
  }, [ref, value, animate]);
}

export type GaugeKind = 'inlet' | 'outlet';

const KIND_META: Record<
  GaugeKind,
  { label: string; hue: string; Icon: typeof ThermometerSun }
> = {
  inlet: {
    label: 'Kirish',
    hue: 'var(--gauge-inlet)',
    Icon: ThermometerSnowflake,
  },
  outlet: {
    label: 'Chiqish',
    hue: 'var(--gauge-outlet)',
    Icon: ThermometerSun,
  },
};

/**
 * HARORAT SHKALASI — 270° yoy, 0–100 °C.
 *
 * ⚠️⚠️ RANG — suv YO'NALISHI (kirish ko'k, chiqish issiq to'q sariq),
 * kotyol HOLATI emas: holat ranglari (yashil/sariq/qizil/kulrang) tizimda
 * band va ular karta pastidagi holat yozuvida. Ikkalasi bir rangda
 * bo'lsa, «to'q sariq yoy» «o'rta ishlayapti» deb o'qilardi.
 *
 * ⚠️ JONLI bo'lmasa (aloqa yo'q) — oxirgi ma'lum qiymat KULRANG va
 * harakatsiz: eskirgan raqam jonli bilan bir xil ko'rinsa, operator
 * uni hozirgi holat deb o'ylardi.
 *
 * ⚠️ Raqam — matn rangida (rangli emas): o'qiladigan ma'lumot rangga
 * bog'liq bo'lmasligi kerak; identifikatsiyani ikonka va yoy beradi.
 *
 * Butun shkala — TUGMA: bosilganda tuman va tafsilotlar oynasi.
 */
export const TempGauge = memo(function TempGauge({
  kind,
  value,
  delta,
  live,
  norm,
  phase,
  reducedMotion,
  selected,
  onInspect,
}: {
  kind: GaugeKind;
  value: number | null;
  delta: number | null;
  live: boolean;
  /** Me'yor belgisi (faqat chiqishda), °C. */
  norm?: number;
  /** 0..1 — har kotyolning o'z fazasi (animatsiyalar sinxron «miltillamasin»). */
  phase: number;
  reducedMotion: boolean;
  selected?: boolean;
  onInspect: (kind: GaugeKind, trigger: HTMLButtonElement) => void;
}) {
  const meta = KIND_META[kind];
  const valueRef = useRef<HTMLSpanElement>(null);
  useTweenedText(valueRef, value, live && !reducedMotion);

  const hasValue = value !== null;
  const pct = hasValue ? toPct(value) : 0;
  const hue = live ? meta.hue : 'var(--gauge-stale)';
  const tipAngle = START + (pct / 100) * SWEEP;
  const animated = live && hasValue && !reducedMotion;
  const style = {
    '--pct': pct,
    '--phase': `${(-phase * 2.8).toFixed(2)}s`,
  } as CSSProperties;

  // Raqam DOM'ga to'g'ridan-to'g'ri yoziladi — ekran o'quvchi uchun matn.
  const spoken = hasValue ? `${formatValue(value)} gradus` : 'o‘lchov yo‘q';

  return (
    <button
      type="button"
      onClick={(event) => onInspect(kind, event.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={Boolean(selected)}
      aria-label={`${meta.label}: ${spoken}. Tuman va tafsilotlar`}
      className={cn(
        'group/gauge relative block aspect-square w-full max-w-[184px] rounded-full outline-none',
        'transition-transform duration-200 hover:scale-[1.025] focus-visible:ring-2 focus-visible:ring-brand-400/70',
        selected && 'ring-2 ring-brand-400/60',
      )}
      style={style}
    >
      <svg viewBox="0 0 160 160" className="size-full" aria-hidden>
        {/* Bo'linmalar: qiymatgacha — yoy rangida, keyin — betaraf. */}
        <g className={cn(animated && 'gauge-ticks-live')}>
          {TICKS.map((tick) => (
            <path
              key={tick.d}
              d={tick.d}
              className="gauge-tick"
              stroke={
                hasValue && tick.value <= (value ?? 0) + 0.01
                  ? hue
                  : 'var(--gauge-tick)'
              }
              strokeWidth={tick.major ? 1.7 : 1.1}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Trek */}
        <path
          d={ARC}
          fill="none"
          stroke="var(--gauge-track)"
          strokeWidth={7}
          strokeLinecap="round"
        />

        {hasValue ? (
          <>
            {/* Yumshoq nur — filtr EMAS (blur animatsiya ostida qimmat),
                shunchaki keng, shaffof chiziq. */}
            {live ? (
              <path
                d={ARC}
                pathLength={100}
                fill="none"
                stroke={hue}
                strokeOpacity={0.16}
                strokeWidth={15}
                strokeLinecap="round"
                strokeDasharray="100 100"
                strokeDashoffset={100 - pct}
                className="gauge-value"
              />
            ) : null}
            <path
              d={ARC}
              pathLength={100}
              fill="none"
              stroke={hue}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray="100 100"
              strokeDashoffset={100 - pct}
              className="gauge-value"
            />
            {/* Issiqlik oqimi — yoy bo'ylab yuguruvchi nur. */}
            {animated && pct > 8 ? (
              <path
                d={ARC}
                pathLength={100}
                fill="none"
                stroke="#ffffff"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeDasharray="7 100"
                className="gauge-sheen"
              />
            ) : null}
          </>
        ) : null}

        {/* Me'yor kesigi — yoyni kesib o'tadigan fon rangidagi tirqish. */}
        {norm !== undefined ? <NormNotch value={norm} /> : null}

        {/* Uch — yoy bilan AYNI egri bo'yicha aylanadi. */}
        {hasValue ? (
          <g
            className="gauge-tip"
            style={{
              transform: `rotate(${tipAngle}deg)`,
              transformOrigin: `${C}px ${C}px`,
            }}
          >
            <g transform={`translate(${C + R} ${C})`}>
              {animated ? (
                <circle r={7} fill={hue} className="gauge-tip-pulse" />
              ) : null}
              <circle
                r={4.4}
                fill="var(--surface)"
                stroke={hue}
                strokeWidth={2.6}
              />
            </g>
          </g>
        ) : null}

        <text
          x={lx}
          y={ly + 9}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fill="var(--ink-faint)"
        >
          {MIN_C}
        </text>
        <text
          x={hx}
          y={hy + 9}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fill="var(--ink-faint)"
        >
          {MAX_C}
        </text>
      </svg>

      {/* Markaz — HTML (shriftlar va o'lcham aniq).
          ⚠️ Raqam — displey shriftida (`figure-display`), yorliq va ΔT —
          mono: «o'lchov» va «yorliq» bir qarashda ajraladi. Eskirgan
          qiymatda rang `--ink-muted` (utilita qatlami — displey sinfining
          o'z rangini bosadi). */}
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="flex items-center gap-1 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-muted uppercase">
          <meta.Icon
            className="size-3.5"
            style={{ color: hue }}
            strokeWidth={2}
            aria-hidden
          />
          {meta.label}
        </span>
        <span className="mt-1 flex items-start">
          <span
            ref={valueRef}
            className={cn(
              'figure-display text-[29px] leading-none',
              !live && 'text-[color:var(--ink-muted)]',
            )}
          />
          {hasValue ? (
            <span className="mt-0.5 ml-0.5 font-mono text-[10px] font-semibold text-muted">
              °C
            </span>
          ) : null}
        </span>
        <DeltaLine delta={live ? delta : null} />
      </span>
    </button>
  );
});

function NormNotch({ value }: { value: number }) {
  const angle = START + (toPct(value) / 100) * SWEEP;
  const [x1, y1] = polar(angle, R - 5.5);
  const [x2, y2] = polar(angle, R + 5.5);
  const [mx, my] = polar(angle, 76.5);
  return (
    <g>
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        stroke="var(--surface)"
        strokeWidth={2.2}
      />
      <circle cx={mx} cy={my} r={1.9} fill="var(--ink-muted)" />
    </g>
  );
}

/** «▲ +0,1 °C» — oldingi o'lchovga nisbatan. Joy har doim band (sakrash yo'q). */
function DeltaLine({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="mt-1.5 h-3.5" aria-hidden />;
  }
  const sign = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
  const text =
    delta === 0
      ? '0,0'
      : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1).replace('.', ',')}`;
  return (
    <span
      className="mt-1.5 h-3.5 font-mono text-[10px] leading-3.5 font-semibold text-muted tabular-nums"
      title="Oldingi o‘lchovga nisbatan"
    >
      {sign} {text} °C
    </span>
  );
}
