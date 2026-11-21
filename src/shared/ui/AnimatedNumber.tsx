import { animate, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * SANAB CHIQUVCHI RAQAM — tayyor formatlangan SATRni oladi.
 *
 * ⚠️ Kirish SON emas, `formatNumber` / `formatTemperature` natijasi
 * («1 245», «54,5 °C», «17,3%»): formatlash qoidasi BITTA joyda
 * (`utils/format.ts`) qoladi, bu komponent esa faqat raqam qismini
 * animatsiya qiladi — ajratgich, kasr belgisi va birlik asl satrdan
 * olinadi. Aks holda kartada «1245» va «1 245» aralashib chiqardi.
 *
 * ⚠️ Matn DOM ga to'g'ridan-to'g'ri yoziladi (React holati emas): har
 * kadrda qayta chizish 6 ta kartada sekundiga 360 render bo'lardi.
 *
 * ⚠️ Raqam bo'lmagan satr («—») o'zgarishsiz chiqadi. «Harakatni
 * kamaytirish» yoqilgan bo'lsa — darhol yakuniy qiymat.
 */
const NUMBER_RE = /^(\D*?)(-?\d{1,3}(?:[   ]\d{3})*(?:[.,]\d+)?)(.*)$/s;

interface Parsed {
  prefix: string;
  suffix: string;
  value: number;
  decimals: number;
  decimalChar: string;
  group: string;
}

function parse(text: string): Parsed | null {
  const match = NUMBER_RE.exec(text);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  const fraction = /[.,](\d+)$/.exec(raw);
  const decimals = fraction ? fraction[1].length : 0;
  const value = Number(raw.replace(/[   ]/g, '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return {
    prefix,
    suffix,
    value,
    decimals,
    decimalChar: fraction ? raw[raw.length - decimals - 1] : ',',
    group: /[   ]/.exec(raw)?.[0] ?? ' ',
  };
}

function render(value: number, p: Parsed): string {
  const [int, frac] = Math.abs(value).toFixed(p.decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, p.group);
  const sign = value < 0 && Number(int) + Number(frac ?? 0) > 0 ? '-' : '';
  return `${p.prefix}${sign}${grouped}${frac ? p.decimalChar + frac : ''}${p.suffix}`;
}

export function AnimatedNumber({
  value,
  className,
  duration = 1.2,
}: {
  value: string;
  className?: string;
  /** Soniya. */
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const parsed = parse(value);

    if (!parsed || reduce) {
      element.textContent = value;
      previous.current = parsed?.value ?? null;
      return;
    }

    const from = previous.current ?? 0;
    previous.current = parsed.value;
    if (from === parsed.value) {
      element.textContent = value;
      return;
    }

    element.textContent = render(from, parsed);
    const controls = animate(from, parsed.value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        element.textContent = render(latest, parsed);
      },
      onComplete: () => {
        element.textContent = value;
      },
    });
    return () => controls.stop();
  }, [value, reduce, duration]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)} data-numeric />
  );
}
