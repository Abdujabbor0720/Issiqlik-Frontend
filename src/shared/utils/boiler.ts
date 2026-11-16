/**
 * QOZONXONA NOMI — ro'yxat, sarlavha va tooltiplar uchun.
 *
 * ⚠️ Lot raqami IXTIYORIY (rasmiy ro'yxatlarda ko'pincha yo'q). Usiz
 * ekranda «Lot null» yoki «Lot » chiqib qolardi. Tartib: muassasa nomi →
 * lot → «Nomsiz qozonxona».
 */
export function boilerName(
  organizationName: string | null | undefined,
  lotNumber: string | null | undefined,
): string {
  if (organizationName) return organizationName;
  if (lotNumber) return `Lot ${lotNumber}`;
  return 'Nomsiz qozonxona';
}

/** «Lot 2026-LOT-0114» yoki lot yo'q bo'lsa — «Lotsiz». */
export function lotLabel(lotNumber: string | null | undefined): string {
  return lotNumber ? `Lot ${lotNumber}` : 'Lotsiz';
}
