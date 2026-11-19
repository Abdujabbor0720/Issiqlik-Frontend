/**
 * SERVER BILAN SHARTNOMA.
 *
 * ⚠️ Tiplar QO'LDA yozilgan va backend DTO'lari bilan mos turishi
 * kerak. Avtomatik generatsiya (openapi-typescript) qo'shilmadi:
 * u build bosqichiga backend'ning ISHLAB TURISHINI talab qilardi va
 * frontend'ni backend'siz qurib bo'lmasdi.
 */

export type BoilerStatus = 'active' | 'medium' | 'inactive' | 'offline';
export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer';
export type FuelType = 'gas' | 'electric' | 'coal' | 'diesel' | 'other';
export type AlertType =
  | 'offline'
  | 'low_temperature'
  | 'critical_temperature'
  | 'overheat'
  /** Chiqish datchigi qiymat bermayapti — harorat NOMA'LUM. */
  | 'sensor_fault'
  /** Kirish va chiqish harorati deyarli teng — suv aylanmayapti. */
  | 'no_circulation'
  /**
   * XONA SOVUQ — havo harorati sozlamadagi minimumdan past.
   * ⚠️ Kotyol ogohlantirishlaridan ALOHIDA: `room` maydoni to'ldirilgan.
   */
  | 'room_cold';

/**
 * O'LCHOVDA QAYSI DATCHIK QATNASHGANI.
 *
 * ⚠️ `inlet` — chiqish datchigi NOSOZ: harorat noma'lum, shuning uchun
 * grafikda chiqish chizig'ida bu nuqta bo'lmaydi.
 * ⚠️ `unknown` — eski proshivka: bitta harorat yubordi, qaysi quvur
 * ekanini aytmadi. Chiqish deb qabul qilinadi, lekin bu TAXMIN.
 */
export type ProbeKind = 'both' | 'inlet' | 'outlet' | 'unknown';

export type RolloutStatus = 'active' | 'paused' | 'done' | 'cancelled';
export type RolloutTargetType = 'all' | 'districts' | 'object_types' | 'devices';
export type OtaEventStatus =
  | 'offered'
  | 'installed'
  | 'ok'
  | 'failed'
  | 'rolled_back';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertState = 'open' | 'acknowledged' | 'resolved';

/** Hamma javob shu konvertda keladi. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  error: { code: string; message: string; details?: unknown };
  path: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: PaginationMeta;
}

// ───────────────── Auth ─────────────────

export interface AuthUser {
  id: string;
  login: string;
  role: UserRole;
  permissions: string[];
  districtId: string | null;
  fullName: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

// ───────────────── Hududlar ─────────────────

export interface DistrictOption {
  id: string;
  /**
   * PROSHIVKA KALITI (`asaka`, `andijon-sh`) — plata shu kalitni yuboradi;
   * muassasa va MFY katalogi ham tumanga SHU kalit bilan bog'lanadi.
   */
  key: string;
  code: string;
  name: string;
  shortName: string;
  kind: string;
}

export interface DistrictStats {
  districtId: string;
  code: string;
  name: string;
  shortName: string;
  kind: string;
  centerLat: number;
  centerLng: number;
  total: number;
  boilerUnits: number;
  active: number;
  medium: number;
  inactive: number;
  offline: number;
  workingPercent: number;
  avgTemperature: number | null;
  dominantStatus: BoilerStatus;
}

export interface DistrictGeoJson {
  type: 'FeatureCollection';
  bbox: number[] | null;
  features: Array<{
    type: 'Feature';
    properties: DistrictStats;
    geometry: GeoJSON.Geometry | null;
  }>;
}

export interface BoilerPoint {
  id: string;
  lotNumber: string | null;
  organizationName: string | null;
  districtId: string;
  districtName: string;
  lat: number;
  lng: number;
  status: BoilerStatus;
  temperature: number | null;
  boilerCount: number;
  lastReadingAt: string | null;
  /**
   * Xonalar — faqat NAZORATDAGI va DOLZARB o'lchovlilar.
   * `null` — xona yo'q yoki hammasining o'lchovi eskirgan.
   */
  rooms: {
    count: number;
    avg: number | null;
    min: number | null;
    /** Minimumdan past xonalar soni. */
    cold: number;
  } | null;
}

// ───────────────── Xonalar (havo harorati) ─────────────────

/**
 * Xona holati — sozlamadagi chegaralarga nisbatan:
 *   • `cold`   — minimumdan past (qizil, ogohlantirish);
 *   • `cool`   — minimum bilan me'yor orasida (sariq);
 *   • `normal` — me'yorda (yashil).
 * `null` — o'lchov ESKIRGAN: holat noma'lum.
 */
export type RoomCondition = 'cold' | 'cool' | 'normal';

export interface Room {
  id: string;
  boilerId: string;
  /** Datchik manzili — o'zgarmaydi. */
  sensorKey: string;
  name: string;
  note: string | null;
  sortOrder: number;
  /** Datchikdan avtomatik yaratilgan va hali nomlanmagan. */
  isAutoCreated: boolean;
  /** `false` — o'rtachaga va ogohlantirishga kirmaydi. */
  isMonitored: boolean;
  temperature: number | null;
  lastReadingAt: string | null;
  isFresh: boolean;
  condition: RoomCondition | null;
}

/** Kotyol xonalari + grafik chiziqlari uchun chegaralar. */
export interface BoilerRooms {
  thresholds: { minC: number; normC: number };
  rooms: Room[];
}

export interface RoomHistorySeries {
  roomId: string;
  name: string;
  points: Array<{ t: number; at: string }>;
}

export interface RoomsSummary {
  measured: number;
  stale: number;
  avg: number | null;
  min: number | null;
  cold: number;
  cool: number;
  normal: number;
  buildingsWithCold: number;
  minC: number;
  normC: number;
  coldest: Array<{
    roomId: string;
    roomName: string;
    temperature: number;
    boilerId: string;
    lotNumber: string | null;
    organizationName: string | null;
    districtName: string;
  }>;
}

// ───────────────── Kataloglar ─────────────────

export interface CatalogItem {
  id: string;
  name: string;
  /** ⚠️ MFYda izoh ustuni yo'q — maydon kelmaydi. */
  note?: string | null;
  isArchived: boolean;
  // ── marka ──
  country?: string | null;
  // ── DXSH firma ──
  tin?: string | null;
  phone?: string | null;
  directorName?: string | null;
  // ── muassasa ──
  objectTypeId?: string | null;
  objectType?: { id: string; name: string; code: string } | null;
  /**
   * ── muassasa va MFY ── tuman KALITI (`DistrictOption.key`), id EMAS.
   * MFYda majburiy, muassasada `null` bo'lishi mumkin (eski yozuv).
   */
  districtKey?: string | null;
  /** Faqat muassasa: MFY (shu tumandagi). */
  mahallaId?: string | null;
  mahalla?: { id: string; name: string } | null;
  /**
   * ⚠️ Faqat OBYEKT TURIDA: mashina kaliti (`school`, `hospital`).
   * Seed va import aynan shu kalit bo'yicha moslanadi — nom
   * tahrirlanadi, kalit esa o'zgarmas.
   */
  code?: string;
}

// ───────────────── Kotyol ─────────────────

export interface Boiler {
  id: string;
  createdAt: string;
  updatedAt: string;
  districtId: string;
  district?: { id: string; name: string; shortName: string; kind: string };
  address: string | null;
  lat: number | null;
  lng: number | null;
  lotNumber: string | null;
  firmId: string | null;
  firm?: { id: string; name: string; phone: string | null } | null;
  organizationId: string | null;
  organization?: { id: string; name: string; kind: string } | null;
  brandId: string | null;
  brand?: { id: string; name: string; country: string | null } | null;
  boilerCount: number;
  normAt60: number | null;
  fuelType: FuelType;
  capacityKw: number | null;
  installedYear: number | null;
  responsibleName: string | null;
  responsiblePhone: string | null;
  note: string | null;
  currentStatus: BoilerStatus;
  lastTemperature: number | null;
  lastReadingAt: string | null;
  statusChangedAt: string | null;
  todayAvgTemperature: number | null;
  isArchived: boolean;
  archiveNote: string | null;
  devices?: DeviceBrief[];
}

/**
 * QURILMA TURI — plata o'zi aytadi (yoki yukidan aniqlanadi).
 *
 * ⚠️ OTA shu bo'yicha ajratiladi: kotyol proshivkasi xona moduliga hech
 * qachon berilmaydi. Qiymatlar backend bilan AYNI (`kotyol` / `xona`).
 */
export type DeviceType = 'kotyol' | 'xona';

/** Oxirgi so'rovdagi token turi; hali so'rov bo'lmasa `null`. */
export type TokenKind = 'personal' | 'shared';

/** Kotyol kartasidagi qisqa qurilma yozuvi (`Boiler.devices[]`). */
export interface DeviceBrief {
  id: string;
  deviceId: string;
  name: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  deviceType: DeviceType;
  lastRoomTemperature?: number | null;
  lastRoomReadingAt?: string | null;
}

/** Tuman havolasi — qurilma qatorida. */
export interface DeviceDistrictRef {
  id: string;
  key: string;
  name: string;
  shortName: string;
}

/**
 * «QURILMALAR» SAHIFASINING BITTA QATORI (`GET /devices`).
 *
 * ⚠️ `location` — AMALDAGI joylashuv (kotyolga ulangan bo'lsa kotyolniki,
 * aks holda qurilmaning o'ziniki). `suggestion` — plata aytgan, lekin
 * panelda BO'SH maydonlar: admin «Tasdiqlash» bilan qabul qiladi.
 * `reported` — plata yuborgan xom qiymatlar, faqat ko'rsatish uchun.
 */
export interface DeviceRow {
  id: string;
  deviceId: string;
  name: string | null;
  deviceType: DeviceType;
  isActive: boolean;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  /** OTA tekshiruvi oxirgi marta qachon bo'lgan. */
  lastCheckAt: string | null;
  lastIpAddress: string | null;
  /** Oxirgi telemetriya 5 daqiqadan yangi (server hisoblaydi). */
  online: boolean;
  readingsCount: string;
  note: string | null;
  apiKeyPreview: string;
  allowSharedToken: boolean;
  tokenKind: TokenKind | null;
  tokenIssuedAt: string | null;
  boilerId: string | null;
  /** Paneldagi tuman (qurilmaning o'zi). */
  districtId: string | null;
  /** Paneldagi muassasa (qurilmaning o'zi). */
  organizationId: string | null;
  boiler: {
    id: string;
    lotNumber: string | null;
    districtId: string;
    organization: { id: string; name: string } | null;
  } | null;
  /** Qurilmaning o'z (paneldagi) tumani. */
  district: DeviceDistrictRef | null;
  location: {
    source: 'boiler' | 'device' | null;
    district: DeviceDistrictRef | null;
    objectType: { id: string; code: string; name: string } | null;
    institution: { id: string; name: string } | null;
  };
  suggestion: {
    district: { key: string; name: string } | null;
    objectType: { code: string; name: string } | null;
    institution: string | null;
  } | null;
  reported: {
    district: string | null;
    objectType: string | null;
    institution: string | null;
    mfy: string | null;
    institutionHint: string | null;
  };
  lastOta: {
    status: OtaEventStatus;
    targetVersion: string | null;
    runningVersion: string | null;
    message: string | null;
    at: string;
  } | null;
  lastRoomTemperature: number | null;
  lastHumidity: number | null;
  lastRoomReadingAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filtr uchun: proshivka versiyalari (`null` — versiyasiz). */
export interface DeviceVersionCount {
  version: string | null;
  count: number;
}

/** «Yangi qurilmalar» — ro'yxatdan o'tmagan, lekin so'rov yuborayotgan plata. */
export interface PendingDevice {
  id: string;
  deviceId: string;
  /** `null` — plata turini aytmagan: ro'yxatga olishda qo'lda tanlanadi. */
  deviceType: DeviceType | null;
  district: { id: string; key: string; name: string } | null;
  objectType: { id: string; code: string; name: string } | null;
  institutionName: string | null;
  /**
   * ⚠️ Shu `device_id` bilan TURLI tokenlar kelgan — bir bosishda ro'yxatga
   * olib bo'lmaydi (server 409), kalit qo'lda kiritiladi.
   */
  tokenConflict: boolean;
  tokenKind: TokenKind | null;
  tokenPreview: string | null;
  isDismissed: boolean;
  institutionHint: string | null;
  firmwareVersion: string | null;
  lastIpAddress: string | null;
  attempts: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/**
 * ⚠️ API kalit FAQAT yaratish/almashtirish javobida keladi.
 * `null` — kalit tizimga noma'lum (qurilmaning o'z tokeni qabul qilindi
 * yoki u umumiy token bilan ishlaydi): ko'rsatadigan narsa yo'q.
 */
export interface DeviceWithKey {
  device: DeviceRow;
  apiKey: string | null;
}

/** `POST /devices/pending/:id/register` javobi. */
export interface RegisterPendingResult extends DeviceWithKey {
  tokenSource: 'adopted' | 'shared' | 'provided';
}

/**
 * QURILMA GRAFIGI NUQTASI.
 *
 * ⚠️ `null` — o'lchov YO'Q (masalan yakka datchik o'lchovida ikkinchi
 * quvur), nol EMAS: grafikda uzilish bo'lib ko'rinadi.
 */
export interface DeviceSeriesPoint {
  t: string;
  /** Kirish (obratka), °C — kotyol moduli. */
  inlet: number | null;
  /** Chiqish (podacha), °C — kotyol moduli. */
  outlet: number | null;
  /** Xona havosi, °C — xona moduli. */
  room: number | null;
  /** Namlik, % — xona moduli. */
  humidity: number | null;
  count: number;
}

export interface DeviceSeries {
  deviceType: DeviceType;
  points: DeviceSeriesPoint[];
}

// ───────────────── Dashboard ─────────────────

export interface DashboardSummary {
  total: number;
  boilerUnits: number;
  working: number;
  workingPercent: number;
  active: number;
  activePercent: number;
  medium: number;
  mediumPercent: number;
  inactive: number;
  inactivePercent: number;
  offline: number;
  offlinePercent: number;
  avgTemperature: number | null;
  normTemperature: number;
  openAlerts: number;
  devicesTotal: number;
  devicesOnline: number;
  readingsLast24h: number;
  withoutCoordinates: number;
  withoutDevice: number;
  updatedAt: string;
}

/** Muassasalar shkalasi — bitta kotyol (qozonxona). */
export interface GaugeItem {
  boilerId: string;
  lotNumber: string | null;
  organizationName: string | null;
  objectTypeId: string | null;
  objectTypeName: string | null;
  objectTypeCode: string | null;
  districtId: string;
  districtName: string;
  districtShortName: string;
  status: BoilerStatus;
  /** Kirish (qaytuvchi suv), °C. */
  inlet: number | null;
  /** Chiqish (uzatuvchi suv), °C. */
  outlet: number | null;
  /** Oldingi o'lchovga nisbatan o'zgarish, °C (`null` — noma'lum). */
  inletDelta: number | null;
  outletDelta: number | null;
  lastReadingAt: string | null;
  hasDevice: boolean;
}

export interface GaugeBoard {
  normTemperature: number;
  items: GaugeItem[];
  updatedAt: string;
}

export interface DistrictRow {
  districtId: string;
  /** Proshivka kaliti (`asaka`). */
  districtKey: string;
  name: string;
  shortName: string;
  /** Faol qurilmalar (amaldagi tumani shu tuman). */
  devicesTotal: number;
  /** Oxirgi telemetriya 5 daqiqadan yangi. */
  devicesOnline: number;
  devicesOffline: number;
  /** O'lchovi bor va chiqish harorati me'yordan past kotyollar. */
  belowNorm: number;
  /** Ochiq ogohlantirishlar (kotyol va xona). */
  openAlerts: number;
  total: number;
  boilerUnits: number;
  active: number;
  medium: number;
  inactive: number;
  offline: number;
  workingPercent: number;
  avgTemperature: number | null;
}

export interface TrendPoint {
  t: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  active: number;
  medium: number;
  inactive: number;
  offline: number;
}

export interface AttentionRow {
  id: string;
  lotNumber: string | null;
  status: BoilerStatus;
  temperature: number | null;
  lastReadingAt: string | null;
  statusChangedAt: string | null;
  boilerCount: number;
  address: string | null;
  districtId: string;
  districtName: string;
  organizationName: string | null;
}

export interface BrandRow {
  name: string;
  total: number;
  working: number;
  workingPercent: number;
  avgTemperature: number | null;
}

// ───────────────── Ogohlantirish ─────────────────

export interface Alert {
  id: string;
  createdAt: string;
  boilerId: string;
  type: AlertType;
  severity: AlertSeverity;
  state: AlertState;
  message: string;
  temperature: number | null;
  lastSeenAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  ackNote: string | null;
  boiler?: {
    id: string;
    lotNumber: string | null;
    address: string | null;
    districtId: string;
    lastTemperature: number | null;
    district?: { id: string; name: string; shortName: string };
    organization?: { id: string; name: string } | null;
  };
  acknowledgedBy?: { id: string; fullName: string } | null;
  /** Faqat xona ogohlantirishida (`room_cold`). */
  room?: { id: string; name: string } | null;
}

// ───────────────── Telemetriya ─────────────────

export interface SeriesPoint {
  t: string;
  /** CHIQISH haroratining o'rtachasi - grafikning asosiy chizigi. */
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
  /**
   * KIRISH (obratka) haroratining o'rtachasi.
   *
   * WARN: `null` - bu davrda birorta qurilma kirish haroratini
   * yubormagan (eski proshivka). Grafik ikkinchi chiziqni CHIZMAYDI,
   * nol bilan to'ldirmaydi.
   */
  inletAvg: number | null;
}

export interface TelemetryReading {
  id: string;
  /** CHIQISH harorati — `outletTemperature` bilan AYNI qiymat. */
  temperature: number | null;
  inletTemperature: number | null;
  outletTemperature: number | null;
  probe: ProbeKind;
  status: BoilerStatus | null;
  recordedAt: string;
  /** Qurilma aytgan o'lchov vaqti (oflayn navbatdan kelgan bo'lsa). */
  measuredAt: string | null;
}

// ───────────────── Proshivka (OTA) ─────────────────

export interface FirmwareRelease {
  id: string;
  version: string;
  /** Qaysi qurilma turi uchun. */
  deviceType: DeviceType;
  /** `marker` — tur `.bin` ichidagi belgidan; `manual` — yuklovchi tanlagan. */
  typeSource: 'marker' | 'manual';
  /** Versiya qaysi prefiksdan o'qilgani (`ANDIJON`, `XONOBOD`, …). */
  markerPrefix: string | null;
  size: number;
  sha256: string;
  note: string | null;
  isArchived: boolean;
  createdAt: string;
  uploadedBy: string | null;
}

/**
 * `POST /firmware/releases/inspect` — yuklashdan OLDIN ko'rish.
 * ⚠️ Fayl saqlanmaydi; panel tur tanlovini shu bilan to'ldiradi.
 */
export interface FirmwareInspection {
  version: string | null;
  prefix: string | null;
  /** `.bin` ichidagi modul belgisi bo'yicha tur. */
  markedType: DeviceType | null;
  /** Belgisiz eski fayl uchun TAKLIF. */
  suggestedType: DeviceType | null;
  /** Belgi yo'q — tur qo'lda tanlanishi SHART. */
  needsManualType: boolean;
  /** Fayl qabul qilinmasa — sababi (o'zbekcha). */
  error: string | null;
  size: number;
  sha256: string;
  isEsp32Image: boolean;
  fitsPartition: boolean;
  maxSize: number;
}

export interface FirmwareRollout {
  id: string;
  version: string;
  deviceType: DeviceType;
  status: RolloutStatus;
  targetType: RolloutTargetType;
  targetIds: string[];
  /** Bosqich — bir vaqtda nechta qurilma; `null` — hammasi. */
  maxDevices: number | null;
  note: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface RolloutProgress {
  version: string;
  status: RolloutStatus;
  total: number;
  /** Holat → qurilmalar soni (`pending` ham bor). */
  counts: Record<string, number>;
  devices: Array<{
    deviceId: string;
    name: string | null;
    state: OtaEventStatus | 'pending';
    message: string | null;
    at: string | null;
  }>;
}

export interface FirmwareBlock {
  id: string;
  deviceId: string;
  version: string;
  failCount: number;
  isBlocked: boolean;
  reason: string | null;
  createdAt: string;
}

// ───────────────── Foydalanuvchi ─────────────────

export interface User {
  id: string;
  createdAt: string;
  login: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: UserRole;
  districtId: string | null;
  district?: { id: string; name: string; shortName: string } | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

/** Tuman + unga biriktirilgan mas'ul(lar). */
export interface DistrictResponsible {
  districtId: string;
  code: string;
  name: string;
  shortName: string;
  kind: string;
  responsibles: User[];
}

// ───────────────── Sozlamalar ─────────────────

export interface SystemSettings {
  id: string;
  activeMinC: number;
  mediumMinC: number;
  criticalMinC: number;
  overheatC: number;
  offlineAfterMinutes: number;
  normTemperature: number;
  /** Xona: eng past ruxsat etilgan harorat, °C (sukut 15). */
  roomMinC: number;
  /** Xona: me'yoriy harorat, °C (sukut 25). */
  roomNormC: number;
  /** Xona tarixi necha daqiqada bir yoziladi (sukut 10). */
  roomSampleMinutes: number;
  retentionDays: number;
  seasonLabel: string | null;
  updatedAt: string;
}

// ───────────────── Realtime ─────────────────

export interface BoilerStatusEvent {
  boilerId: string;
  districtId: string;
  lotNumber: string | null;
  status: BoilerStatus;
  temperature: number | null;
  at: string;
}

export interface AlertEvent {
  alertId: string;
  boilerId: string;
  lotNumber: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  at: string;
}

// ───────────────── Excel import (qozonxonalar ro'yxati) ─────────────────

export interface BoilerImportRow {
  excelRow: number;
  sourceName: string;
  name: string;
  kind: 'school' | 'kindergarten';
  organizationId: string | null;
  /** Yaratiladigan qozonxonalar — har biri kotyol soni. */
  boilerCounts: number[];
  skipReason: string | null;
  serial: string | null;
}

export interface BoilerImportPlan {
  fileName: string;
  date: string | null;
  tag: string;
  district: { id: string; name: string; code: string; shortName: string };
  rows: BoilerImportRow[];
  totals: {
    institutions: number;
    newOrganizations: number;
    existingOrganizations: number;
    boilers: number;
    units: number;
    withoutBoiler: number;
  };
  warnings: string[];
  /** Faqat yozishdan keyin. */
  result?: { organizationsCreated: number; boilersCreated: number };
  /** Arxivga (DO Spaces, private) saqlangan asl fayllar — arxiv sozlangan bo'lsa. */
  archived?: Array<{ bucket: string; key: string; size: number }>;
}
