import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';

/** Shundan tor xarita — «ixcham» (telefon): belgilar kichikroq. */
export const COMPACT_MAP_WIDTH = 640;

/**
 * Xarita ixchammi — XARITANING o'z kengligi bo'yicha, oyna kengligi emas.
 *
 * ⚠️ Oyna (`window`) kengligiga qarash noto'g'ri bo'lardi: dashboard'da
 * xarita sahifaning 2/3 qismini egallaydi, to'liq ekran rejimida esa
 * butun oynani. Belgilar o'lchami aynan xaritaga sig'ishi kerak.
 */
export function useMapCompact(): boolean {
  const map = useMap();
  const [compact, setCompact] = useState(
    () => map.getSize().x < COMPACT_MAP_WIDTH,
  );

  useEffect(() => {
    const update = (): void => setCompact(map.getSize().x < COMPACT_MAP_WIDTH);
    update();
    map.on('resize', update);
    return () => {
      map.off('resize', update);
    };
  }, [map]);

  return compact;
}

/**
 * Xarita ko'rinishi o'zgarganda (zoom, o'lcham) qayta hisoblash uchun hisoblagich.
 *
 * ⚠️ Faqat `zoomend` va `resize` — `move` EMAS: surishda nomlar orasidagi
 * piksel masofa o'zgarmaydi va har kadrda qayta hisoblash keraksiz bo'lardi.
 */
export function useMapViewTick(): number {
  const map = useMap();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = (): void => setTick((value) => value + 1);
    map.on('zoomend resize', bump);
    return () => {
      map.off('zoomend resize', bump);
    };
  }, [map]);
  return tick;
}
