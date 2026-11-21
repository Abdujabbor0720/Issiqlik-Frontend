import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * SINF NOMLARINI BIRLASHTIRISH.
 *
 * ⚠️ `clsx` YETARLI EMAS: `cn('p-2', 'p-4')` da u ikkalasini ham
 * qoldiradi va natija CSS da qaysi qoida keyin turganiga — ya'ni build
 * tartibiga — bog'liq bo'lib qoladi. `twMerge` oxirgisini yutqizmaydi.
 *
 * ⚠️⚠️ LEKIN `twMerge` BIZNING O'LCHAM SHKALAMIZNI BILMAYDI.
 *
 * `--text-meta`, `--text-ui`, `--text-body` kabi tokenlar `text-meta`,
 * `text-ui` utilitalarini hosil qiladi. `twMerge` esa `text-*` naqshini
 * ko'rib, ularni RANG deb o'ylaydi va shu sababli:
 *
 *   cn('text-white', 'text-meta')  →  'text-meta'     ← `text-white` YO'Q!
 *
 * Natijada ASOSIY TUGMA matni oq emas, meros bo'yicha QORA bo'lib
 * chiqardi (variant `text-white` beradi, o'lcham `text-meta` keyin
 * keladi va uni o'chirib tashlaydi). Ekranda bu «ko'k tugmada qora
 * yozuv» bo'lib ko'rinadi va sababini topish deyarli imkonsiz:
 * Button.tsx da `text-white` ko'rinib turibdi.
 *
 * Shuning uchun maxsus shkalalar `twMerge` ga ANIQ e'lon qilinadi.
 * Yangi token qo'shilsa, u ham shu ro'yxatga qo'shilishi kerak.
 */
export const cn: (...inputs: ClassValue[]) => string = (() => {
  const merge = extendTailwindMerge({
    extend: {
      classGroups: {
        /* O'lcham shkalasi — `index.css` dagi `--text-*` tokenlari. */
        'font-size': [
          {
            text: [
              'nano',
              'micro',
              'meta',
              'ui',
              'body',
              'lede',
              'head',
              'sub',
              'display',
              'figure',
              'title',
              'mega',
            ],
          },
        ],
        /* Burchak radiusi — `--radius-card`, `--radius-tile`. */
        rounded: [{ rounded: ['card', 'tile'] }],
        /* Soyalar — `--shadow-hair`, `--shadow-card`, … */
        shadow: [{ shadow: ['hair', 'card', 'raise', 'pop', 'brand'] }],
      },
      /*
       * ⚠️ RANG sinflari `conflictingClassGroups` ga qo'shilmaydi:
       * `text-ink`, `text-strong`, `text-muted`, `text-faint` —
       * bular `twMerge` uchun NOMA'LUM sinflar va u noma'lum sinfga
       * tegmaydi (ikkalasini ham qoldiradi). Bu bizga kerak: rang
       * sinfi o'lcham sinfi bilan birga ishlatiladi.
       */
    },
  });

  return (...inputs: ClassValue[]): string => merge(clsx(inputs));
})();
