import { cn } from '@/shared/utils/cn';

/**
 * LOGOTIP — plitka + alanga belgisi.
 *
 * ⚠️ Belgi SVG sifatida INLINE, rasm fayli emas: logotip har sahifada
 * va login ekranida bor, rasm bo'lsa u alohida so'rov bo'lib, sekin
 * tarmoqda sahifa logotipsiz ochilardi.
 *
 * ⚠️ Alanga rangi ILIQ (`#ffb454`), brend esa SOVUQ ko'k: domen
 * «issiqlik» bo'lgani uchun iliq urg'u kerak, lekin u HOLAT ranglari
 * (yashil/sariq/qizil) bilan chalkashmasligi uchun faqat logotipda
 * qoladi.
 */
export function Logo({
  size = 'md',
  withText = true,
  className,
}: {
  size?: 'sm' | 'md';
  withText?: boolean;
  className?: string;
}) {
  const tile = size === 'sm' ? 'size-7 rounded-md' : 'size-8 rounded-tile';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-brand-600 shadow-[var(--shadow-brand)]',
          tile,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={size === 'sm' ? 'size-4' : 'size-[18px]'}
          aria-hidden
        >
          <path
            d="M12 3c.5 2.6-.9 3.7-2.1 4.9C8.6 9.1 7.4 10.3 7.4 12.6A4.6 4.6 0 0 0 12 17.2a4.6 4.6 0 0 0 4.6-4.6c0-1.8-.7-2.9-1.5-4-.2.8-.7 1.4-1.4 1.7.3-2.7-.8-4.8-3.3-6.4"
            fill="#ffb454"
            transform="translate(1 1) scale(0.92)"
          />
        </svg>
      </span>

      {withText ? (
        <span className="flex flex-col leading-none">
          <span className="text-lede font-semibold tracking-tight text-strong">
            Issiqlik
          </span>
          <span className="mt-0.5 text-nano font-medium tracking-wide text-faint uppercase">
            Andijon viloyati
          </span>
        </span>
      ) : null}
    </div>
  );
}
