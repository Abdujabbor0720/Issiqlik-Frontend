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
  note: string | null;
  isArchived: boolean;
  // ── marka ──
  country?: string | null;
  // ── DXSH firma ──
  tin?: string | null;
  phone?: string | null;
  directorName?: string | null;
  // ── tashkilot ──
  objectTypeId?: string | null;
  objectType?: { id: string; name: string; code: string } | null;
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

export interface DeviceBrief {
  id: string;
  deviceId: string;
  name: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
}

export interface Device extends DeviceBrief {
  createdAt: string;
  apiKeyPreview: string;
  boilerId: string | null;
  boiler?: {
    id: string;
    lotNumber: string | null;
    districtId: string;
    district?: { id: string; name: string; shortName: string };
    organization?: { id: string; name: string } | null;
  } | null;
  lastIpAddress: string | null;
  firmwareVersion: string | null;
  readingsCount: string;
  note: string | null;

  // ───────── ESP32 v2.0.0 ─────────
  /** Proshivka aytgan muassasa — FAQAT ma'lumot uchun, ishonilmaydi. */
  institutionHint: string | null;
  /** Umumiy tokenga ruxsat berilganmi (sukut: `false`). */
  allowSharedToken: boolean;
  /** OTA tekshiruvi oxirgi marta qachon bo'lgan. */
  lastCheckAt: string | null;
  /** Shaxsiy token qachon berilgan. */
  tokenIssuedAt: string | null;

  /**
   * TUMAN — plata menyusida tanlangan, kabinetda O'ZGARTIRILMAYDI.
   * `null` — eski proshivka (tuman yubormaydi) yoki noma'lum kod.
   */
  districtId?: string | null;
  district?: { id: string; name: string; shortName: string } | null;
  /** Plata yuborgan xom qiymat (server taniy olmasa ham ko'rinadi). */
  reportedDistrict?: string | null;
}

/** «Yangi qurilma so'rayapti» — ro'yxatdan o'tmagan plata. */
export interface PendingDevice {
  id: string;
  deviceId: string;
  institutionHint: string | null;
  firmwareVersion: string | null;
  lastIpAddress: string | null;
  attempts: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** ⚠️ API kalit FAQAT yaratish/almashtirish javobida keladi. */
export interface DeviceWithKey {
  device: Device;
  apiKey: string;
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
  name: string;
  shortName: string;
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
  size: number;
  sha256: string;
  note: string | null;
  isArchived: boolean;
  createdAt: string;
  uploadedBy: string | null;
}

export interface FirmwareRollout {
  id: string;
  version: string;
  status: RolloutStatus;
  targetType: RolloutTargetType;
  targetIds: string[];
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
