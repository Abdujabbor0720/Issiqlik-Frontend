/**
 * OQIM KANALLARI GEOMETRIYASI — sof funksiyalar (DOM'ga, Leaflet'ga bog'liq emas).
 *
 * Kanal — kotyoldan tuman markaziga KVADRAT BEZYE egri chizig'i. To'g'ri
 * chiziq emas: bitta markazga yig'ilgan o'nlab to'g'ri chiziq «tikanli
 * kirpi» bo'lib ko'rinadi. Hamma egri BIR tomonga (soat yo'nalishida)
 * buriladi — markaz atrofida yumshoq girdob hosil bo'ladi va tarmoq
 * tirik, yaxlit tizim bo'lib ko'rinadi.
 */

export interface Pt {
  x: number;
  y: number;
}

/**
 * Uzunlik bo'yicha jadval (LUT): egri chiziq nuqtalari va ularga qadar
 * yig'ilgan uzunlik. Zarrani «N piksel yurdi» bo'yicha joylashtirish uchun:
 * Bezye parametri `u` bir tekis emas — usiz zarra egri boshida sekin,
 * o'rtasida tez yurardi.
 */
export interface CurveLut {
  xs: Float32Array;
  ys: Float32Array;
  /** `cum[i]` — 0-nuqtadan i-nuqtagacha uzunlik, px. */
  cum: Float32Array;
  length: number;
}

/** Egrilik: kanal uzunligiga nisbatan og'ish (0.17 — nafis, lekin sezilarli). */
const BEND_RATIO = 0.17;
const BEND_MIN = 4;
const BEND_MAX = 150;

export function buildCurve(from: Pt, to: Pt): CurveLut | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 1) return null;

  // Normal vektor — doim bir tomonga (girdob).
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.min(BEND_MAX, Math.max(BEND_MIN, len * BEND_RATIO));
  const cx = (from.x + to.x) / 2 + nx * bend;
  const cy = (from.y + to.y) / 2 + ny * bend;

  // Nuqtalar soni uzunlikka qarab: qisqa kanalga 12 ta yetadi, uzuniga 64.
  const n = Math.min(64, Math.max(12, Math.round(len / 7)));
  const xs = new Float32Array(n + 1);
  const ys = new Float32Array(n + 1);
  const cum = new Float32Array(n + 1);

  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    xs[i] = a * from.x + b * cx + c * to.x;
    ys[i] = a * from.y + b * cy + c * to.y;
    if (i > 0) {
      cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
  }
  return { xs, ys, cum, length: cum[n] };
}

/**
 * Egri chiziq bo'yicha `s` piksel yurilgan nuqta (`out` ga yoziladi —
 * har kadrda yangi obyekt yaratilmasin: 2000 kanal × 60 kadr = sekundiga
 * 120 000 ta keraksiz obyekt va axlat yig'uvchining «qotishi»).
 */
export function pointAt(lut: CurveLut, s: number, out: Pt): Pt {
  const { xs, ys, cum } = lut;
  const last = cum.length - 1;
  if (s <= 0) {
    out.x = xs[0];
    out.y = ys[0];
    return out;
  }
  if (s >= lut.length) {
    out.x = xs[last];
    out.y = ys[last];
    return out;
  }
  // Ikkilik qidiruv — `cum` o'suvchi.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (s - cum[lo]) / seg;
  out.x = xs[lo] + (xs[hi] - xs[lo]) * t;
  out.y = ys[lo] + (ys[hi] - ys[lo]) * t;
  return out;
}

/**
 * Barqaror faza [0, 1) — kotyol identifikatoridan.
 *
 * ⚠️ Tasodifiy (`Math.random`) EMAS: xarita har qayta chizilganda
 * zarralar sakrab ketmasligi va ikki kanal sinxron «miltillamasligi»
 * uchun. Bir xil kotyol — har doim bir xil faza.
 */
export function stablePhase(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** `#rrggbb` → `r,g,b` (canvas `rgba()` uchun). */
export function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
