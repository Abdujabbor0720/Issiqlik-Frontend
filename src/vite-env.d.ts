/// <reference types="vite/client" />

/**
 * MUHIT O'ZGARUVCHILARI — TIPLANGAN.
 *
 * ⚠️ `vite/client` ning o'zi `import.meta.env` ni `any` bilan
 * qaytaradi: xato yozilgan nom (`VITE_API_RUL`) kompilyatsiyadan
 * o'tib, brauzerda `undefined` bo'lib chiqardi va so'rov
 * `undefined/auth/login` manziliga ketardi. Bu yerda ular aniq
 * e'lon qilinadi.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_BASEMAP_URL?: string;
  readonly VITE_BASEMAP_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
