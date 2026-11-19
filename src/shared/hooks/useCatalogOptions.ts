import { useQuery } from '@tanstack/react-query';
import { get, getPaged } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { CatalogItem, DistrictOption } from '@/shared/api/types';

/**
 * TANLOV RO'YXATLARI — forma va filtrlar uchun.
 *
 * ⚠️ Bitta kalit — bitta ma'lumot SHAKLI. Ilgari obyekt turlari har
 * sahifada o'z kaliti bilan so'ralardi; AYNI kalit ikki joyda ikki xil
 * shaklda (massiv / sahifa) yozilsa, kesh bir-birini buzardi.
 */

/** Tumanlar — tuman mas'uliga server faqat o'z tumanini qaytaradi. */
export function useDistricts(enabled = true) {
  return useQuery({
    queryKey: qk.districts,
    queryFn: () => get<DistrictOption[]>(API.geo.districts),
    staleTime: 60 * 60 * 1000,
    enabled,
  });
}

/** Obyekt turlari («Kataloglar → Obyekt turlari»), arxivlanmaganlari. */
export function useObjectTypes(enabled = true) {
  return useQuery({
    queryKey: qk.objectTypes,
    queryFn: async (): Promise<CatalogItem[]> =>
      (
        await getPaged<CatalogItem>(API.catalogs.list('object-types'), {
          params: { limit: 200 },
        })
      ).items,
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

/**
 * Tumandagi muassasalar yoki MFYlar — `districtKey` bo'yicha.
 * ⚠️ Tuman tanlanmaguncha so'ralmaydi: muassasa/MFY tumanga tegishli.
 */
export function useDistrictCatalog(
  kind: 'organizations' | 'mahallas',
  districtKey: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.catalog(kind, { districtKey, options: true }),
    queryFn: async (): Promise<CatalogItem[]> =>
      (
        await getPaged<CatalogItem>(API.catalogs.list(kind), {
          params: { districtKey, limit: 200 },
        })
      ).items,
    enabled: enabled && Boolean(districtKey),
    staleTime: 60 * 1000,
  });
}
