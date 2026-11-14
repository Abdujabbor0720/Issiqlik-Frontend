/**
 * FON XARITASI (basemap) — Leaflet uchun tayl (tile) manbalari.
 *
 * ⚠️⚠️ LEAFLET'NING O'ZIDA XARITA YO'Q. U faqat RENDER qiladi:
 * taylarni (256×256 rasm bo'laklari) tashqi serverdan oladi va
 * ustiga bizning ko'pburchak va nuqtalarimizni chizadi. Shuning
 * uchun «Leaflet'ni uladim» degani hali xarita ko'rinadi degani emas
 * — tayl manbasi ham ko'rsatilishi SHART.
 *
 * ⚠️ Sukut — OpenStreetMap: leafletjs.com ning rasmiy qo'llanmasidagi
 * manba, BEPUL, API kalit va bank kartasi KERAK EMAS.
 *
 * ⚠️⚠️ ATRIBUTSIYA MAJBURIY va olib tashlanmaydi. OpenStreetMap
 * ma'lumoti ODbL litsenziyasida: manba ko'rsatilmasa, foydalanish
 * litsenziyani buzadi. Shuning uchun u `attribution` maydonida
 * qotirib yozilgan va Leaflet uni xarita burchagida ko'rsatadi.
 */

export interface BasemapProvider {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** Qorong'i rejimda taylar teskari rangga o'tkazilsinmi. */
  invertOnDark: boolean;
  subdomains?: string;
}

/**
 * ⚠️ `{s}` (subdomen) ISHLATILMAYDI. OpenStreetMap 2021-yildan beri
 * bitta `tile.openstreetmap.org` manzilini tavsiya qiladi: eski
 * `a./b./c.` shakli HTTP/2 da foyda bermaydi va ularning siyosatida
 * tavsiya etilmaydi.
 */
const OSM: BasemapProvider = {
  id: 'osm',
  label: 'Ko‘chalar (OpenStreetMap)',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> hissadorlari',
  /*
   * ⚠️ `maxZoom: 19` — OSM taylari aynan shu darajagacha mavjud.
   * Balandroq qo'yilsa, Leaflet bo'sh (kulrang) kataklarni so'rab,
   * xaritada «teshiklar» hosil qilardi.
   */
  maxZoom: 19,
  invertOnDark: true,
};

/**
 * ⚠️ `.env` dagi manzil OSM O'RNINI oladi, unga qo'shilmaydi:
 * ikkita fon bir-birining ustida chizilsa, pastdagisi behuda
 * trafik bo'lib qolardi.
 *
 * MapTiler / Carto / Stadia kabi xizmatga o'tish uchun faqat
 * `VITE_BASEMAP_URL` va `VITE_BASEMAP_ATTRIBUTION` yoziladi — kodga
 * tegilmaydi.
 */
const CUSTOM_URL = (import.meta.env.VITE_BASEMAP_URL ?? '').trim();
const CUSTOM_ATTRIBUTION = (
  import.meta.env.VITE_BASEMAP_ATTRIBUTION ?? ''
).trim();

export const BASEMAP: BasemapProvider = CUSTOM_URL
  ? {
      id: 'custom',
      label: 'Fon xaritasi',
      url: CUSTOM_URL,
      /*
       * ⚠️ Atributsiya bo'sh qoldirilmaydi. Deyarli har bir tayl
       * xizmati uni talab qiladi va bo'sh satr «talab bajarilmadi»
       * degani — shuning uchun hech bo'lmasa umumiy matn qoladi.
       */
      attribution: CUSTOM_ATTRIBUTION || 'Fon xaritasi manbasi',
      maxZoom: 20,
      /* ⚠️ Maxsus manba ko'pincha o'zining to'q uslubiga ega —
         uni teskari rangga o'tkazish uni BUZARDI. */
      invertOnDark: false,
    }
  : OSM;

/**
 * Fon xaritasi sukut bo'yicha YOQILGANMI.
 *
 * ⚠️ Yoqilgan: foydalanuvchi uchun «bu qozonxona aynan qayerda»
 * degan savolga javob faqat ko'chalar bilan paydo bo'ladi. Toza
 * ko'rinish (fonsiz) esa bitta bosish bilan qaytariladi — xarita
 * ustidagi tugmadan.
 */
export const BASEMAP_DEFAULT_ON = true;
