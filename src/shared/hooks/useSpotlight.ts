import { useEffect } from 'react';

/**
 * KARTA PROJEKTORI — kursor ostidagi `.card` chetini yoritadi.
 *
 * ⚠️ BITTA hujjat tinglovchisi (event delegation), har kartada alohida
 * emas: sahifada 200 ta muassasa kartasi bo'lsa ham bitta funksiya
 * ishlaydi. Koordinata kadrga bir marta (`requestAnimationFrame`) —
 * sichqoncha 1000 Hz bo'lsa ham sekundiga 60 ta yozuv.
 *
 * ⚠️ Faqat sichqonchali qurilmada: sensorli ekranda «kursor» yo'q va
 * barmoq bosilganda chet bir lahza yonib, xato bosildi degan taassurot
 * qoldirardi. Chizish CSS da (`.card::before`), bu yerda faqat
 * `--mx` / `--my` yoziladi.
 */
export function useSpotlight(): void {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduce.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    let target: EventTarget | null = null;

    const apply = (): void => {
      frame = 0;
      const card =
        target instanceof Element ? target.closest<HTMLElement>('.card') : null;
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${x - box.left}px`);
      card.style.setProperty('--my', `${y - box.top}px`);
    };

    const onMove = (event: PointerEvent): void => {
      x = event.clientX;
      y = event.clientY;
      target = event.target;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
