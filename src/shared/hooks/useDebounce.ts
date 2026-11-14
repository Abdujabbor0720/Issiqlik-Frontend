import { useEffect, useState } from 'react';

/**
 * ⚠️ Qidiruv maydoni uchun SHART: har bosilgan harf so'rov yuborsa,
 * «Jalaquduq» so'zi 10 ta so'rov yuborardi va ularning javoblari
 * TARTIBSIZ kelib, ekranda eski natija qolib ketishi mumkin edi.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
