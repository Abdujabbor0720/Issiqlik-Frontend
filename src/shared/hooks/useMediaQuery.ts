import { useEffect, useState } from 'react';

/**
 * CSS media so'rovi — jonli (oyna o'lchami / tizim sozlamasi o'zgarsa
 * qayta chiziladi).
 *
 * ⚠️ Boshlang'ich qiymat DARHOL `matchMedia` dan olinadi, effektdan
 * keyin emas: aks holda birinchi kadr noto'g'ri holatda chizilib (masalan
 * telefonda yig'ilgan menyu), keyin «sakrardi».
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (): void => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tizim sozlamasi: «harakatni kamaytirish» (vestibulyar sezgirlik). */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
