/**
 * ENDPOINT MANZILLARI — yagona ro'yxat.
 *
 * ⚠️ Manzil satrlari komponentlar ichida yozilmaydi: backend yo'lni
 * o'zgartirsa (`/boilers` → `/catalog/boilers`), uni o'nlab faylda
 * qidirish kerak bo'lardi va bittasi albatta qolib ketardi.
 */
export const API = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/change-password',
  },
  geo: {
    regions: '/geo/regions',
    districts: '/geo/districts',
    map: '/geo/map',
    points: '/geo/map/points',
    district: (id: string) => `/geo/districts/${id}`,
  },
  dashboard: {
    summary: '/dashboard/summary',
    districts: '/dashboard/districts',
    trend: '/dashboard/trend',
    attention: '/dashboard/attention',
    brands: '/dashboard/brands',
    gauges: '/dashboard/gauges',
  },
  boilers: {
    list: '/boilers',
    one: (id: string) => `/boilers/${id}`,
    archive: (id: string) => `/boilers/${id}/archive`,
    restore: (id: string) => `/boilers/${id}/restore`,
    export: '/boilers/export',
    importPreview: '/boiler-import/preview',
    import: '/boiler-import',
  },
  devices: {
    list: '/devices',
    one: (id: string) => `/devices/${id}`,
    rotateKey: (id: string) => `/devices/${id}/rotate-key`,
    /** Plata aytgan joylashuv taklifini tasdiqlash. */
    confirmLocation: (id: string) => `/devices/${id}/location/confirm`,
    /** Filtr uchun: proshivka versiyalari va soni. */
    versions: '/devices/versions',
    pending: '/devices/pending',
    /** «Yangi qurilmalar» → bir bosishda ro'yxatga olish. */
    registerPending: (id: string) => `/devices/pending/${id}/register`,
    dismissPending: (id: string) => `/devices/pending/${id}/dismiss`,
    restorePending: (id: string) => `/devices/pending/${id}/restore`,
  },

  /**
   * PROSHIVKA VA MASOFADAN YANGILASH.
   *
   * ⚠️ Qurilma ishlatadigan `/ota/index.php` yo'li bu ro'yxatda YO'Q
   * va bo'lmasligi kerak: u global prefiksdan tashqarida va faqat
   * ESP32 uchun. Kabinet undan foydalanmaydi.
   */
  firmware: {
    releases: '/firmware/releases',
    release: (id: string) => `/firmware/releases/${id}`,
    /** Yuklashdan OLDIN tekshirish — fayl saqlanmaydi. */
    inspect: '/firmware/releases/inspect',
    rollouts: '/firmware/rollouts',
    rolloutStatus: (id: string) => `/firmware/rollouts/${id}/status`,
    /** Bosqich: 1 → 10 → 50 → `null` (hammasi). */
    rolloutLimit: (id: string) => `/firmware/rollouts/${id}/limit`,
    rolloutProgress: (id: string) => `/firmware/rollouts/${id}/progress`,
    blocks: '/firmware/blocks',
    block: (id: string) => `/firmware/blocks/${id}`,
  },
  telemetry: {
    series: '/telemetry/series',
    recent: (boilerId: string) => `/telemetry/boilers/${boilerId}/recent`,
    /** Qurilma grafigi: kotyol — kirish/chiqish, xona — xona harorati. */
    deviceSeries: (deviceId: string) => `/telemetry/devices/${deviceId}/series`,
  },
  /**
   * XONALAR (havo harorati).
   * ⚠️ Xona KOTYOLGA tegishli — ro'yxat kotyol bo'yicha olinadi.
   */
  rooms: {
    byBoiler: (boilerId: string) => `/rooms/by-boiler/${boilerId}`,
    history: (boilerId: string) => `/rooms/by-boiler/${boilerId}/history`,
    summary: '/rooms/summary',
    one: (id: string) => `/rooms/${id}`,
  },
  /** Kotyol + modul (+ yangi muassasa) — BITTA tranzaksiyada. */
  boilerSetup: '/boiler-setup',
  alerts: {
    list: '/alerts',
    acknowledge: (id: string) => `/alerts/${id}/acknowledge`,
  },
  catalogs: {
    list: (kind: CatalogKind) => `/catalogs/${kind}`,
    one: (kind: CatalogKind, id: string) => `/catalogs/${kind}/${id}`,
  },
  users: {
    list: '/users',
    districtResponsibles: '/users/district-responsibles',
    one: (id: string) => `/users/${id}`,
    resetPassword: (id: string) => `/users/${id}/reset-password`,
  },
  settings: '/settings',
  audit: '/audit',
  health: '/health',
} as const;

export type CatalogKind =
  | 'brands'
  | 'firms'
  | 'organizations'
  | 'object-types'
  /** MFYlar — tumanga (kalit bilan) tegishli. */
  | 'mahallas';

/**
 * QUERY KALITLARI — TanStack Query uchun.
 *
 * ⚠️ Kalitlar MARKAZLASHGAN: `invalidateQueries` chaqirgan joy va
 * so'rovni yozgan joy AYNI massivni ko'rsatishi kerak. Kalit qo'lda
 * yozilsa, bitta harf farqi bilan kesh yangilanmay qolardi — va bu
 * «saqladim, lekin ro'yxat o'zgarmadi» degan eng chalkash xato.
 */
export const qk = {
  me: ['me'] as const,
  districts: ['districts'] as const,
  /*
   * ⚠️ Kalitlarda `districtId` — BITTA tuman yoki `null` («Umumiy»).
   * `null` ham kalitning bir qismi: usiz «butun viloyat» va «Asaka»
   * natijalari BITTA keshga tushib, filtr o'zgarganda eski raqamlar
   * ekranda qolib ketardi.
   */
  map: (districtId: string | null) => ['map', districtId] as const,
  points: (districtId: string | null) => ['points', districtId] as const,
  /*
   * ⚠️ Dashboard kalitlarida obyekt turlari ham bor: usiz «hamma turlar»
   * va «faqat maktablar» natijalari bitta keshga tushardi. Sukut `[]` —
   * yon panel (`qk.summary(null)`) dashboard bilan AYNI keshni o'qiydi.
   */
  summary: (districtId: string | null, objectTypeIds: readonly string[] = []) =>
    ['summary', districtId, objectTypeIds] as const,
  gauges: (districtId: string | null) => ['gauges', districtId] as const,
  districtRows: (
    districtId: string | null,
    objectTypeIds: readonly string[] = [],
  ) => ['districtRows', districtId, objectTypeIds] as const,
  trend: (
    districtId: string | null,
    range: string,
    objectTypeIds: readonly string[] = [],
  ) => ['trend', districtId, range, objectTypeIds] as const,
  attention: (
    districtId: string | null,
    objectTypeIds: readonly string[] = [],
  ) => ['attention', districtId, objectTypeIds] as const,
  brands: (districtId: string | null, objectTypeIds: readonly string[] = []) =>
    ['brands', districtId, objectTypeIds] as const,
  boilers: (params: unknown) => ['boilers', params] as const,
  boiler: (id: string) => ['boiler', id] as const,
  boilerSeries: (id: string, range: string) =>
    ['boilerSeries', id, range] as const,
  devices: (params: unknown) => ['devices', params] as const,
  deviceVersions: ['devices', 'versions'] as const,
  deviceSeries: (id: string, range: string) =>
    ['deviceSeries', id, range] as const,
  /** Prefiks — invalidatsiya uchun (rad etilganlar bilan ham, ularsiz ham). */
  pendingDevices: ['pendingDevices'] as const,
  pendingDevicesList: (includeDismissed: boolean) =>
    ['pendingDevices', includeDismissed] as const,
  releases: ['releases'] as const,
  objectTypes: ['catalog', 'object-types', 'options'] as const,
  rollouts: ['rollouts'] as const,
  rolloutProgress: (id: string) => ['rolloutProgress', id] as const,
  firmwareBlocks: ['firmwareBlocks'] as const,
  alerts: (params: unknown) => ['alerts', params] as const,
  catalog: (kind: CatalogKind, params: unknown) =>
    ['catalog', kind, params] as const,
  users: (params: unknown) => ['users', params] as const,
  responsibles: ['responsibles'] as const,
  settings: ['settings'] as const,
  rooms: (boilerId: string) => ['rooms', boilerId] as const,
  roomHistory: (boilerId: string, hours: number) =>
    ['roomHistory', boilerId, hours] as const,
  roomsSummary: (districtId: string | null) =>
    ['roomsSummary', districtId] as const,
} as const;
