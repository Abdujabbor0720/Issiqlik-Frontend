/**
 * LOYIHA NOMI — YAGONA MANBA.
 *
 * ⚠️ Nom bir necha ekranda ko'rinadi: brauzer sarlavhasi, logotip,
 * kirish sahifasi, login/parol varaqasi, hisobot sarlavhalari. Ilgari
 * u har joyda QO'LDA yozilgan edi (7 joyda) va nom o'zgarganda bir
 * ekranda eskisi, boshqasida yangisi turib qolardi — eng ko'zga
 * tashlanadigan turdagi nomuvofiqlik.
 *
 * ⚠️ Yangi joyda nom kerak bo'lsa, shu yerdan import qiling; satrni
 * qo'lda ko'chirmang.
 *
 * ⚠️ `index.html` dagi `<title>` bundan TASHQARIDA: u JS yuklanishidan
 * oldin ko'rinadi va import qilib bo'lmaydi. U qo'lda yozilgan va
 * nom o'zgarsa u ham yangilanishi kerak.
 */
export const BRAND = {
  /**
   * TO'LIQ RASMIY NOM — brauzer sarlavhasi, kirish sahifasi,
   * hisobot va hujjat sarlavhalari.
   */
  full: 'Andijon viloyati issiqlik nazorat markazi',

  /**
   * QISQA NOM — logotipning birinchi qatori.
   *
   * ⚠️ To'liq nom bu yerga sig'maydi: yon menyu tor va uzun satr
   * `truncate` bilan «Andijon viloyati issiq…» bo'lib kesilardi.
   * Shuning uchun nom ikki qatorga bo'linadi va `scope` bilan birga
   * to'liq nomni o'qiydi.
   */
  short: 'Issiqlik nazorati',

  /** Logotipning ikkinchi qatori — qamrov. */
  scope: 'Andijon viloyati',

  /** Kirish sahifasi va varaqalar uchun bir qatorli izoh. */
  tagline: 'Qozonxonalar va xona haroratini masofadan nazorat qilish',
} as const;
