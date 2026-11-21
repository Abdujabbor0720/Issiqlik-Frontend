import gerb128 from '@/assets/brand/gerb-128.png';
import gerb256 from '@/assets/brand/gerb-256.png';
import { cn } from '@/shared/utils/cn';

/**
 * O'ZBEKISTON RESPUBLIKASI DAVLAT GERBI — logotipning asosi.
 *
 * ⚠️ Rasm RASTR (PNG, 128 / 256 px), SVG EMAS. Rasmiy SVG ~250 KB va
 * 300 ta murakkab yo'ldan iborat: har sahifada yon panelda turgani uchun
 * u har chizishda brauzerni band qilardi. 128 px nusxa 36 px logotipni
 * 3× ekranda ham tiniq ko'rsatadi; katta joyda (login) 256 px olinadi.
 *
 * ⚠️ Gerb O'ZGARTIRILMAYDI: rangi, shakli, nisbati asl holida (qonun
 * talabi). Faqat ATROFIGA nur qo'shiladi (`glow`) — gerbning o'ziga
 * filtr, soya yoki rang qo'llanmaydi.
 */
export function StateEmblem({
  size = 36,
  glow = false,
  className,
  alt = 'O‘zbekiston Respublikasi Davlat gerbi',
}: {
  /** CSS piksel. */
  size?: number;
  /** Orqasida sekin «nafas oluvchi» nur — faqat qorong'i fonda. */
  glow?: boolean;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {glow ? <span aria-hidden className="emblem-glow" /> : null}
      <img
        src={size > 56 ? gerb256 : gerb128}
        srcSet={`${gerb128} 128w, ${gerb256} 256w`}
        sizes={`${size}px`}
        width={size}
        height={size}
        alt={alt}
        decoding="async"
        draggable={false}
        className="relative size-full object-contain select-none"
      />
    </span>
  );
}
