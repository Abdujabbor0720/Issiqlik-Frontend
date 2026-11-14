/**
 * SONLARNI FORMATLASH.
 *
 * ⚠️ Ajratgich — TOR BO'SH JOY (U+202F), oddiy probel EMAS: oddiy
 * probelda brauzer «1 245» ni ikki so'z deb bilib, qator oxirida
 * ikkiga bo'lib tashlaydi va raqam ikki satrga tushib qoladi.
 */
const THIN_SPACE = ' ';

export function formatNumber(
  value: number | null | undefined,
  fallback = '—',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/** `54,5 °C` — kasr qismi VERGUL bilan (o'zbek yozuvi qoidasi). */
export function formatTemperature(
  value: number | null | undefined,
  fallback = '—',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${value.toFixed(1).replace('.', ',')}${THIN_SPACE}°C`;
}

export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(fractionDigits).replace('.', ',')}%`;
}

/**
 * Katta sonlarni qisqartirish: `1,2 mln`.
 * ⚠️ Faqat grafik o'qida va kichik joylarda: kartadagi ASOSIY raqam
 * har doim to'liq ko'rsatiladi — rahbar aniq sonni ko'rishi kerak.
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mln`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace('.', ',')} ming`;
  }
  return formatNumber(value);
}

/** F.I.Sh dan bosh harflar: «Akmal Tursunov» → «AT». */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Bo'sh qiymatni «—» ga aylantiradi. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}
