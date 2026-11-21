import { BRAND } from '@/shared/constants/brand';
import { StateEmblem } from '@/shared/ui/StateEmblem';
import { cn } from '@/shared/utils/cn';

/**
 * LOGOTIP — Davlat gerbi + tizim nomi.
 *
 * ⚠️ Gerb logotipning ASOSI: bu davlat tizimi va foydalanuvchi ekranga
 * qaraganda birinchi «kimning tizimi» degan savolga javob olishi kerak.
 * Ilgari logotip alanga belgisi edi — u har qanday tijorat panelida
 * bo'lishi mumkin edi.
 *
 * ⚠️ Matn IKKI qatorda: to'liq nom yon panelga sig'maydi va `truncate`
 * bilan kesilardi. `short` + `scope` birga to'liq nomni o'qiydi.
 *
 * `tone="light"` — to'q fonda (yon panel, login chap paneli).
 */
export function Logo({
  size = 'md',
  withText = true,
  tone = 'auto',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
  tone?: 'auto' | 'light';
  className?: string;
}) {
  const emblem = size === 'sm' ? 30 : size === 'lg' ? 46 : 36;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <StateEmblem size={emblem} glow={tone === 'light'} />

      {withText ? (
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'truncate font-display font-[780] tracking-[-0.018em] [font-stretch:112%]',
              size === 'lg'
                ? 'text-[19px] leading-6'
                : 'text-[15px] leading-[19px]',
              tone === 'light' ? 'text-white' : 'text-strong',
            )}
          >
            {BRAND.short}
          </span>
          <span
            className={cn(
              'mt-0.5 truncate font-mono text-[9.5px] leading-[13px] font-semibold tracking-[0.18em] uppercase',
              tone === 'light' ? 'text-white/45' : 'text-faint',
            )}
          >
            {BRAND.scope}
          </span>
        </span>
      ) : null}
    </div>
  );
}
