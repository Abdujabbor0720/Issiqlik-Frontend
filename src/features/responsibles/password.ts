/**
 * PAROL GENERATORI.
 *
 * ⚠️⚠️ `Math.random()` ISHLATILMAYDI. U kriptografik emas va uning
 * natijasini oldingi qiymatlardan bashorat qilish mumkin — 16 ta tuman
 * mas'uliga ketma-ket parol yaratilganda bu haqiqiy xavf.
 * `crypto.getRandomValues` brauzerning kriptografik manbasi.
 *
 * ⚠️ Alifboda CHALKASHADIGAN belgilar YO'Q: `0/O`, `1/l/I`. Parol
 * qog'ozga yozib yoki og'zaki topshiriladi va «nol'mi, katta O'mi»
 * degan savol mas'ulni tizimga kirita olmay qo'yardi.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);

  /*
   * ⚠️ `byte % ALPHABET.length` — modul SURILISHI (modulo bias) bu
   * yerda ahamiyatsiz: manba 32 bitli (4 294 967 296), alifbo esa 56
   * belgi. Surilish 10⁻⁸ darajasida va parol uzunligi 12 belgi —
   * ya'ni amalda bir tekis taqsimot.
   */
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return result;
}

/**
 * LOGIN TAKLIFI — tuman kodidan.
 *
 * ⚠️ Tuman KODI ishlatiladi (`jalaquduq`), nomi EMAS: nomda apostrof
 * va o'zbekcha harflar bor (`Qo'rg'ontepa`) va ular loginda
 * taqiqlangan — server faqat lotin harfi, raqam, `-` va `_` ni
 * qabul qiladi (`CreateUserDto`).
 */
export function suggestLogin(districtCode: string): string {
  const clean = districtCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
  return `masul.${clean}`;
}
