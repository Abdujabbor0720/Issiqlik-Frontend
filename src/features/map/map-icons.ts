import L from 'leaflet';
import kotyolModelUrl from '@/assets/map/kotyol.webp';
import type { BoilerPoint, DistrictStats } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { hexToRgb, stablePhase } from './flow/flow-geometry';
import { boilerName } from '@/shared/utils/boiler';

/**
 * XARITA BELGILARI — Leaflet HTML SATRINI talab qiladi.
 *
 * ⚠️⚠️ Bu yerda React ishlamaydi: `L.divIcon` va `bindTooltip` xom
 * HTML qabul qiladi va AVTOMATIK QOCHIRISH YO'Q. Tashkilot nomlari
 * bazadan keladi va ular tahrirlanadigan maydon — `<img src=x
 * onerror=…>` nomli tashkilot xaritada ishga tushardi. Qochirish
 * arzon va butun xavf sinfini yopadi.
 */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * TUMAN BELGISI O'LCHAMI, px — YAGONA joy.
 *
 * ⚠️ Uni ikki narsa ishlatadi: belgining o'zi va oqim kanallari (kanal
 * aynan belgi CHETIGA kiradi). O'lcham ikki joyda yozilsa, birinchi
 * o'zgarishdayoq kanallar belgi ichiga kirib yoki undan oldin to'xtab
 * qolardi.
 */
export function districtBadgeSize(
  total: number,
  solo: boolean,
  compact = false,
): number {
  const base = solo
    ? 40
    : total >= 20
      ? 34
      : total >= 10
        ? 30
        : total >= 1
          ? 27
          : 24;
  // Telefonda (tor xarita) ~18% kichikroq — 16 tuman bir-birini yopmasin.
  return compact ? Math.round(base * 0.82) : base;
}

/**
 * SANOQ BELGISI — doira + nom yorlig'i.
 *
 * ⚠️ BITTA funksiya IKKI joyga xizmat qiladi: viloyat kesimidagi
 * tuman va tanlangan tumanning o'z belgisi. Nusxa ko'chirilsa,
 * birinchi tuzatishdayoq ular ajralib ketardi — o'lcham bir joyda
 * o'zgarib, ikkinchisida qolib.
 */
export function districtBadgeIcon(
  props: DistrictStats,
  options: { size: number; showName: boolean; selected: boolean },
): L.DivIcon {
  const hex = BOILER_STATUS[props.dominantStatus].hex;
  const rgb = hexToRgb(hex);
  const { size, showName, selected } = options;
  const height = size + (showName ? 18 : 0);
  /* ⚠️ Tashqi halqa — `box-shadow`, `border` EMAS: u o'lchamga qo'shilmaydi,
     ya'ni oqim kanali (`districtBadgeSize`) aynan doira CHETIGA kirishda
     davom etadi. Tanlangan tuman — brend halqasi, qolganlari — o'z holat
     rangidagi xira nur. */
  const halo = selected
    ? '0 0 0 3px rgba(11,91,181,.26)'
    : `0 0 0 3px rgba(${rgb},.18)`;

  return L.divIcon({
    className: '',
    /* ⚠️ `iconSize` BELGI kengligi emas, BUTUN BLOK kengligi: nom
       doiradan kengroq bo'ladi va markazlash shunga qarab hisoblanadi.
       Tor qilib qo'yilsa, uzun nomli tuman («Qo'rg'ontepa») chapga
       siljib qolardi. */
    iconSize: [116, height],
    iconAnchor: [58, height / 2],
    html: `<span style="
        display:flex;flex-direction:column;align-items:center;gap:3px;
        width:116px;cursor:pointer;
      ">
      <span style="
        display:grid;place-items:center;
        width:${size}px;height:${size}px;border-radius:999px;
        /* ⚠️ Yassi doira EMAS: yuqori chapda yupqa yorug'lik
           (radial gradient) — belgi xarita ustida sharsimon bo'lib
           ko'rinadi. Yassi rangli doira ko'pburchak bilan bitta
           tekislikda turib, «bo'yoq dog'i» bo'lib ko'rinardi.
           Rang O'ZGARMAYDI — faqat oq alfa qo'shiladi. */
        background:
          radial-gradient(120% 120% at 32% 24%, rgba(255,255,255,.34), rgba(255,255,255,0) 58%),
          ${hex};
        color:#fff;
        /* ⚠️ Raqam DISPLEY shriftida (sahifadagi KPI raqamlari bilan bir
           oila). Yupqa soya — oq raqam sariq («o'rta») doira ustida ham
           o'qilsin. */
        font:700 ${props.total >= 100 ? 10.5 : 12}px/1 var(--font-display);
        font-stretch:108%;letter-spacing:-.01em;
        font-variant-numeric:tabular-nums;
        text-shadow:0 1px 1px rgba(8,20,40,.35);
        box-shadow:${halo},0 1px 3px rgba(8,30,60,.36),0 6px 14px -5px rgba(8,30,60,.55);
        border:${selected ? '3px solid #0b5bb5' : '2px solid #fff'};
      ">${esc(props.total)}</span>
      ${
        showName
          ? `<span style="
        display:inline-block;padding:1px 6px;border-radius:4px;
        background:var(--surface);
        /* Halqa + yumshoq soya: yorliq xarita ko'pburchagi ustida
           turadi va faqat 1px halqa bilan u fonga singib ketardi.
           ⚠️ Shrift va o'lcham O'ZGARMAYDI (Inter 10px): nomlar to'qnashuvi
           («DistrictLayer») aynan shu harf kengligi bilan hisoblanadi. */
        box-shadow:0 0 0 1px color-mix(in srgb,var(--ink-strong) 13%,transparent),0 2px 6px -2px rgba(8,30,60,.34);
        font:600 10px/1.35 var(--font-sans);
        color:var(--ink-strong);white-space:nowrap;
      ">${esc(props.shortName)}</span>`
          : ''
      }
    </span>`,
  });
}

/**
 * KOTYOL KO'RSATMASI — sichqoncha olib borilganda (`title`, ko'p qatorli).
 *
 * ⚠️ `title` da: Leaflet `Popup` bosishni talab qiladi, bosish esa xonalar
 * oynasini ochadi. «Qayerda va qanday» degan savolga javob shu yerda.
 * `\n` haqiqiy qator uzilishi bo'lib ishlaydi, `<br>` esa matn bo'lib qolardi.
 */
function boilerTooltip(point: BoilerPoint): string {
  const meta = BOILER_STATUS[point.status];
  const temp = (value: number | null): string =>
    value === null ? '—' : `${value.toFixed(1).replace('.', ',')} °C`;

  const rooms = point.rooms;
  return [
    boilerName(point.organizationName, point.lotNumber),
    `Holati: ${meta.label}`,
    point.temperature === null
      ? 'Harorat: o‘lchov yo‘q'
      : `Harorat: ${temp(point.temperature)}`,
    `Kotyollar soni: ${point.boilerCount}`,
    ...(rooms
      ? [
          `Xonalar (${rooms.count}): o‘rtacha ${temp(rooms.avg)}, eng past ${temp(rooms.min)}`,
          ...(rooms.cold > 0 ? [`❄ Sovuq xonalar: ${rooms.cold}`] : []),
        ]
      : []),
    'Bosing — xonalar ro‘yxati',
  ].join('\n');
}

/** Kotyol belgisi o'lchami, px (rasm 112×105 — 2x zichlikda). */
export const BOILER_MODEL_W = 54;
export const BOILER_MODEL_H = 51;

/**
 * KOTYOL — 3D MODEL, tuman ko'rinishida.
 *
 * ⚠️ Langar nuqtasi — POYDEVOR markazi (rasm pastidan ~7px), rasm o'rtasi
 * EMAS: geografik nuqta binoning O'RNI, va kanal aynan shu yerdan —
 * kotyol tagidan chiqib, tuman markaziga oqadi.
 *
 * ⚠️⚠️ O'lcham INLINE uslubda, `width` atributida emas: Leaflet'ning o'z
 * CSS'i marker ichidagi har bir `<img>` ga `width: auto` beradi va u
 * atributni bosib ketadi — rasm asl 112px o'lchamida chiqib, xaritani
 * to'sib qo'yardi.
 *
 * ⚠️ Holat RANGI — model ostidagi nur va to'lqin halqasida; modelning
 * o'zi bo'yalmaydi (u hamma joyda bir xil, tanish obyekt bo'lib qoladi).
 *
 * ⚠️⚠️ SOVUQ XONASI BOR BINO — poydevor atrofida KO'K halqa; kotyol
 * holati rangi O'ZGARMAYDI. «Qozon ishlayapti, lekin 1-sinf sovuq» va
 * «qozon to'xtagan» boshqa-boshqa usta talab qiladi.
 */
/** Tor xaritada (telefon) model masshtabi — tuman chegarasini yopmasin. */
const BOILER_MODEL_COMPACT_SCALE = 0.72;

export function boilerModelIcon(
  point: BoilerPoint,
  compact = false,
): L.DivIcon {
  const meta = BOILER_STATUS[point.status];
  const rgb = hexToRgb(meta.hex);
  const cold = Boolean(point.rooms && point.rooms.cold > 0);
  // To'lqinlar sinxron «miltillamasin» — har kotyolning o'z fazasi.
  const delay = (-stablePhase(point.id) * 2.4).toFixed(2);
  const w = BOILER_MODEL_W;
  const h = BOILER_MODEL_H + 6;

  return L.divIcon({
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 7],
    html: `<span class="iss-boiler${cold ? ' is-cold' : ''}" title="${esc(boilerTooltip(point))}" style="
        --st:${meta.hex};--st-glow:rgba(${rgb},.78);--st-soft:rgba(${rgb},.0);--delay:${delay}s;
        --s:${compact ? BOILER_MODEL_COMPACT_SCALE : 1};
        width:${w}px;height:${h}px;">
      <span class="iss-boiler__pulse"></span>
      <span class="iss-boiler__glow"></span>
      <img class="iss-boiler__img" src="${kotyolModelUrl}" alt="" width="${w}" height="${BOILER_MODEL_H}" draggable="false"
        style="width:${w}px;height:${BOILER_MODEL_H}px" />
    </span>`,
  });
}

/**
 * KO'RSATMA (tooltip) — tuman ustiga sichqoncha kelganda.
 *
 * ⚠️ Fon HAR DOIM to'q, yorug' rejimda ham: ko'rsatma xarita USTIDA
 * suzadi va oq fonli bo'lsa, ochiq ko'k tumanlar ustida chegarasi
 * yo'qolib ketardi.
 *
 * ⚠️ To'q fonda holat ranglari OCH qadamda (`*-300`): `#118a56` kabi asosiy
 * qadam to'q ko'k ustida o'qilmay qolardi. Nuqta va bo'lakli chiziq esa
 * asosiy hex'da — ular xaritadagi belgilar bilan AYNI rangda bo'lishi kerak.
 */
export function districtTooltipHtml(props: DistrictStats): string {
  const ink = '#ffffff';
  const bg = '#0b1626';
  const faint = 'rgba(214,226,242,.58)';

  const row = (
    label: string,
    value: string | number,
    color?: string,
    dot?: string,
  ): string =>
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
       <span style="display:inline-flex;align-items:center;gap:6px;color:${faint}">${
         dot
           ? `<span style="width:6px;height:6px;border-radius:999px;background:${dot};box-shadow:0 0 0 2px ${dot}33"></span>`
           : ''
       }${esc(label)}</span>
       <strong style="font-weight:600;font-variant-numeric:tabular-nums;${
         color ? `color:${color}` : ''
       }">${esc(value)}</strong>
     </div>`;

  const temp =
    props.avgTemperature === null
      ? '—'
      : `${props.avgTemperature.toFixed(1).replace('.', ',')} °C`;

  /* Holatlar taqsimoti — jadvaldagi bo'lakli chiziq bilan AYNI shakl. */
  const parts = [
    { value: props.active, hex: BOILER_STATUS.active.hex },
    { value: props.medium, hex: BOILER_STATUS.medium.hex },
    { value: props.inactive, hex: BOILER_STATUS.inactive.hex },
    { value: props.offline, hex: BOILER_STATUS.offline.hex },
  ];
  const sum = parts.reduce((acc, part) => acc + part.value, 0);
  const bar =
    sum > 0
      ? parts
          .filter((part) => part.value > 0)
          .map(
            (part) =>
              `<span style="width:${((part.value / sum) * 100).toFixed(2)}%;background:${part.hex}"></span>`,
          )
          .join('')
      : '';

  return `<div style="
      position:relative;overflow:hidden;
      min-width:216px;padding:12px 12px 9px;border-radius:10px;
      background:${bg};color:${ink};font:400 11.5px/1.7 var(--font-sans);
      box-shadow:0 0 0 1px rgba(140,175,220,.18),0 18px 40px -12px rgba(4,10,22,.65)
    ">
    <span style="position:absolute;left:0;right:0;top:0;height:2px;background:var(--thermal)"></span>
    <div style="font:600 9.5px/1.4 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:${faint}">Hudud</div>
    <div style="font:700 13.5px/1.25 var(--font-display);font-stretch:108%;letter-spacing:-.012em;margin-top:1px">${esc(props.name)}</div>
    <div style="display:flex;gap:1px;height:4px;margin:8px 0 7px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,.08)">${bar}</div>
    ${row('Qozonxonalar', props.total)}
    ${row('Kotyollar soni', props.boilerUnits)}
    ${row('Faol', props.active, '#6ccb98', BOILER_STATUS.active.hex)}
    ${row('O‘rta', props.medium, '#efb954', BOILER_STATUS.medium.hex)}
    ${row('Ishlamayotgan', props.inactive, '#f3948c', BOILER_STATUS.inactive.hex)}
    ${row('Aloqa yo‘q', props.offline, '#aeb9c9', BOILER_STATUS.offline.hex)}
    <div style="height:1px;margin:4px 0 3px;background:rgba(255,255,255,.08)"></div>
    ${row('O‘rtacha harorat', temp)}
  </div>`;
}

/**
 * GEOMETRIYA IDENTIFIKATORI — React `key` uchun.
 *
 * ⚠️⚠️ `react-leaflet` ning `GeoJSON` qatlami `data` propi
 * o'zgarganda O'ZINI QAYTA CHIZMAYDI (Leaflet qatlami bir marta
 * yaratiladi va keyin React unga tegmaydi). Yagona ishonchli yo'l —
 * `key` ni o'zgartirib, qatlamni QAYTA YARATISH.
 *
 * ⚠️ Kalit MAZMUNDAN olinadi, obyekt identifikatoridan emas: bitta
 * so'rov qayta yuklanganda yangi obyekt keladi, lekin geometriya
 * o'sha-o'sha bo'ladi va qatlam bekorga qayta qurilardi. Butun
 * JSON ni hisoblash esa har chizishda megabaytlab satr yasashni
 * anglatardi — shuning uchun tur, nuqtalar soni va birinchi nuqta.
 */
export function geometryKey(
  geometry: GeoJSON.Geometry | null | undefined,
): string {
  if (!geometry) return 'none';
  let count = 0;
  let first = '';

  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      count += 1;
      if (!first) first = `${coords[0]},${coords[1]}`;
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };

  visit((geometry as { coordinates?: unknown }).coordinates);
  return `${geometry.type}:${count}:${first}`;
}

/**
 * GEOMETRIYANING CHEGARALOVCHI TO'RTBURCHAGI — `[[lat,lng],[lat,lng]]`.
 *
 * ⚠️⚠️ TUMAN KO'RINISHI uchun SHART. Serverdagi `bbox` butun
 * VILOYATNIKI va u bilan tumanni ochsak, xarita baribir viloyat
 * masshtabida qolardi — ya'ni «tumanni ochdim» degan amal hech
 * narsani o'zgartirmasdi.
 *
 * ⚠️ Hisob MIJOZDA: geometriya allaqachon yuklangan (xarita uni
 * chizyapti), server esa har tanlovda yangi so'rov olib, o'sha
 * ma'lumotni qaytarardi.
 *
 * ⚠️ GeoJSON tartibi `[lng, lat]`, Leaflet esa `[lat, lng]` kutadi —
 * almashtirish SHU YERDA, bitta joyda bo'ladi. Chaqiruv joylarida
 * qilinsa, bitta unutilgan joy xaritani Hind okeaniga olib ketardi.
 */
export function geometryBounds(
  geometry: GeoJSON.Geometry | null | undefined,
): [[number, number], [number, number]] | null {
  if (!geometry) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (
      Array.isArray(coords) &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const [lng, lat] = coords as [number, number];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };

  visit((geometry as { coordinates?: unknown }).coordinates);
  if (minLng === Infinity) return null;

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
