import L from 'leaflet';
import {
  ArrowLeft,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GeoJSON as GeoJsonLayer,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type {
  BoilerPoint,
  DistrictGeoJson,
  DistrictStats,
} from '@/shared/api/types';
import { BASEMAP, BASEMAP_DEFAULT_ON } from '@/shared/constants/basemap';
import { BOILER_STATUS, STATUS_ORDER } from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';
import {
  boilerPointIcon,
  districtBadgeIcon,
  districtTooltipHtml,
  esc,
  geometryBounds,
} from './map-icons';
import { useDensityPalette } from './useDensityPalette';



/** Qo'shni viloyatlar — mo'ljal uchun yorliqlar. */
const NEIGHBOURS: Array<{ label: string; position: [number, number] }> = [
  { label: 'Namangan viloyati', position: [41.055, 72.62] },
  { label: 'Toshkent viloyati', position: [40.98, 71.52] },
  { label: 'Farg‘ona viloyati', position: [40.43, 72.0] },
];

interface DistrictMapProps {
  geojson: DistrictGeoJson | undefined;
  /** Kotyol nuqtalari — tanlov bo'lganda ko'rsatiladi. */
  points?: BoilerPoint[];
  /** Tanlangan tuman (umumiy filtrdan). `null` — butun viloyat. */
  selectedId: string | null;
  /**
   * Tuman bosilganda. `null` — tanlov bekor qilindi.
   * ⚠️ Tanlangan tumanni QAYTA bosish uni bekor qiladi: usiz
   * «butun viloyatga qaytish» uchun yuqoridagi filtrni qidirish
   * kerak bo'lardi va xaritadan chiqib ketish kerak edi.
   */
  onSelectDistrict: (id: string | null) => void;
  /** Nuqta bosilganda — kotyol kartasiga o'tish. */
  onPointClick?: (point: BoilerPoint) => void;
  heightClass?: string;
  className?: string;
}

/**
 * ANDIJON VILOYATI XARITASI.
 *
 * ⚠️⚠️ VILOYAT va TUMAN kesimi BITTA komponentda. Chegara
 * ma'lumotining shakli (`DistrictStats`) ikkalasida bir xil; ikkinchi
 * xarita yozilsa, rang shkalasi, ko'rsatma va to'liq ekran rejimi
 * ikki joyda ALOHIDA tuzatilishi kerak bo'lardi va ular birinchi
 * tuzatishdayoq ajralib ketardi.
 *
 * ⚠️ Tuman bosilganda SAHIFA ALMASHMAYDI — u tanlovga qo'shiladi.
 * Sabab: tanlov butun ilova uchun umumiy (`filters.store`) va
 * dashboard, ro'yxat, hisobot — hammasi o'sha tanlovga ergashadi.
 * Alohida «tuman sahifasi» bo'lsa, foydalanuvchi bir vaqtda ikkita
 * kesimda (sahifa va filtr) turib qolardi.
 */
export function DistrictMap({
  geojson,
  points,
  selectedId,
  onSelectDistrict,
  onPointClick,
  heightClass = 'h-[560px]',
  className,
}: DistrictMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  /*
   * ⚠️ Fon xaritasi IChKI holat, prop emas: uni yoqish/o'chirish —
   * xaritaning o'z boshqaruvi, sahifaning qarori emas. Prop bo'lsa,
   * har chaqiruv joyi o'z tugmasini qo'shishi kerak bo'lardi va
   * ular bir-biridan farq qilardi.
   */
  const [showTiles, setShowTiles] = useState(BASEMAP_DEFAULT_ON);

  /*
   * ⚠️⚠️ IKKI KO'RINISH, BITTA komponent:
   *   • `region`   — tanlov yo'q: 16 ta tuman, viloyat chegarasi;
   *   • `district` — tuman tanlangan: FAQAT o'sha tuman, uning
   *     chegarasiga moslangan masshtab va ichidagi qozonxonalar.
   *
   * Ikkinchi xarita komponenti yozilsa, rang shkalasi, ko'rsatma,
   * to'liq ekran va chegara moslash — hammasi IKKI joyda alohida
   * tuzatilishi kerak bo'lardi va ular birinchi tuzatishdayoq
   * ajralib ketardi.
   */
  const selectedFeature = useMemo(
    () =>
      selectedId
        ? (geojson?.features.find(
            (feature) => feature.properties.districtId === selectedId,
          ) ?? null)
        : null,
    [geojson, selectedId],
  );

  const isDistrictView = Boolean(selectedFeature);

  /** Chizish uchun chegaralar — tuman ko'rinishida FAQAT bittasi. */
  const visibleGeoJson = useMemo<DistrictGeoJson | undefined>(() => {
    if (!geojson) return undefined;
    if (!selectedFeature) return geojson;
    return { ...geojson, features: [selectedFeature] };
  }, [geojson, selectedFeature]);

  const maxTotal = useMemo(
    () =>
      Math.max(
        1,
        ...(geojson?.features.map((feature) => feature.properties.total) ?? [1]),
      ),
    [geojson],
  );
  const palette = useDensityPalette(maxTotal);

  /*
   * ⚠️ BOG'LIQLIK — QIYMAT, massiv identifikatori EMAS.
   *
   * `geojson.bbox` serverdan kelgan massiv va react-query HAR
   * yangilanishda YANGI massiv qaytaradi (qiymati o'sha bo'lsa ham).
   * `useMemo` massiv identifikatoriga bog'lansa, fonda bitta qayta
   * so'rov ketishi bilan `bounds` «o'zgargan» hisoblanib, xarita
   * avtomatik `fitBounds` qilardi — FOYDALANUVCHI KATTALASHTIRGAN
   * ko'rinish o'z-o'zidan orqaga qaytardi va zoom tugmasi
   * «ishlamayotgandek» tuyulardi.
   */
  const bboxKey = geojson?.bbox?.join(',') ?? '';
  const bounds = useMemo<L.LatLngBoundsExpression | undefined>(() => {
    /*
     * ⚠️ TUMAN ko'rinishida chegara uning O'Z geometriyasidan
     * hisoblanadi. Serverdagi `bbox` butun VILOYATNIKI va u bilan
     * ochilsa, xarita baribir viloyat masshtabida qolardi — ya'ni
     * «tumanni ochdim» degan amal hech narsani o'zgartirmasdi.
     */
    if (selectedFeature) {
      return geometryBounds(selectedFeature.geometry) ?? undefined;
    }

    const bbox = bboxKey ? bboxKey.split(',').map(Number) : [];
    if (bbox.length < 4 || bbox.some((value) => !Number.isFinite(value))) {
      return undefined;
    }
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [bboxKey, selectedFeature]);

  // Escape bilan to'liq ekrandan chiqish — brauzerning o'z F11 rejimi
  // emas, shuning uchun klaviaturani o'zimiz ulaymiz.
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  const handleSelect = useCallback(
    (props: DistrictStats) =>
      onSelectDistrict(
        selectedId === props.districtId ? null : props.districtId,
      ),
    [onSelectDistrict, selectedId],
  );

  if (!geojson || !visibleGeoJson) {
    return (
      <div className={cn('skeleton rounded-card', heightClass, className)} />
    );
  }

  return (
    <div
      className={cn(
        /* ⚠️ Fon YASSI kulrang emas: yuqoridan pastga juda yupqa ko'k
           o'tish. Xarita ko'pburchaklari ham ko'kish bo'lgani uchun
           yassi kulrang maydon ular ostida «qog'oz varaq» bo'lib
           turardi; o'tish bilan esa idish xaritaning o'z muhitiga
           aylanadi. */
        'relative overflow-hidden rounded-card',
        /* ⚠️ Gradient FAQAT fon xaritasiz: taylar ustiga qo'yilsa,
           ular ko'kish parda ostida qolib, ko'chalar o'qilmasdi. */
        showTiles
          ? 'bg-[var(--surface-sunken)]'
          : 'bg-[var(--surface-muted)] bg-[linear-gradient(180deg,rgb(29_114_187/0.06)_0%,rgb(29_114_187/0.015)_55%,rgb(29_114_187/0)_100%)]',
        'shadow-[inset_0_0_0_1px_rgb(20_45_80/0.07)]',
        fullscreen
          ? 'fixed inset-3 z-50 h-auto shadow-[0_28px_70px_-20px_rgb(8_20_40/0.5)]'
          : heightClass,
        className,
      )}
    >
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [18, 18] }}
        zoomControl={false}
        /*
         * ⚠️ Atributsiya HAR DOIM yoqilgan.
         *
         * `attributionControl` Leaflet'da faqat xarita YARATILGANDA
         * o'qiladi — uni keyin `showTiles` bilan yoqib-o'chirib
         * bo'lmaydi va shart qo'yish faqat chalg'itardi. Buning
         * o'rniga Leaflet manbalarni O'ZI boshqaradi: tayl qatlami
         * qo'shilganda «© OpenStreetMap hissadorlari» paydo bo'ladi,
         * olib tashlanganda — yo'qoladi va faqat «Leaflet» qoladi.
         *
         * ⚠️ Bu MAJBURIY: OpenStreetMap ma'lumoti ODbL litsenziyasida
         * va manba ko'rsatilmasa, foydalanish litsenziyani buzadi.
         */
        attributionControl
        /* ⚠️ Sichqoncha g'ildiragi bilan kattalashtirish O'CHIQ:
           xarita sahifa ichida turadi va sahifani aylantirayotgan
           odam uning ustidan o'tganda xarita «tutib olib»
           kattalashib ketardi. Zoom tugmalari va ikki marta bosish
           qoladi. */
        scrollWheelZoom={false}
        /* ⚠️ Sukut bo'yicha Leaflet FAQAT butun zoom darajalarini
           ishlatadi va `fitBounds` konteynerga sig'adigan eng katta
           BUTUN darajani tanlaydi — natijada xarita atrofida keng
           bo'sh joy qoladi. `zoomSnap={0}` kasrli zoomga ruxsat
           beradi va chegara aniq o'tiradi. */
        zoomSnap={0}
        zoomDelta={0.4}
        doubleClickZoom
        className="size-full"
        style={{ background: 'transparent' }}
      >
        {showTiles ? (
          <TileLayer
            /* ⚠️ `key` ichida manba identifikatori: `.env` orqali
               boshqa xizmatga o'tilganda React qatlamni QAYTA
               yaratishi kerak — Leaflet `url` o'zgarganini o'zi
               sezmaydi va eski taylarni ko'rsatib turardi. */
            key={BASEMAP.id}
            url={BASEMAP.url}
            attribution={BASEMAP.attribution}
            maxZoom={BASEMAP.maxZoom}
            {...(BASEMAP.subdomains
              ? { subdomains: BASEMAP.subdomains }
              : {})}
            /* ⚠️ Yuqori piksel zichligidagi ekranda ikki baravar
               aniqroq tayl so'raladi — usiz xarita xira ko'rinardi. */
            detectRetina
            className={
              BASEMAP.invertOnDark ? 'issiqlik-basemap-tiles' : undefined
            }
          />
        ) : null}

        <DistrictLayer
          geojson={visibleGeoJson}
          selectedId={selectedId}
          onSelect={handleSelect}
          palette={palette}
          fullscreen={fullscreen}
          solo={isDistrictView}
          overTiles={showTiles}
        />

        {/* ⚠️ Nuqtalar chegaralar USTIDAN chiziladi: ular aniq
            joyni ko'rsatadi va ko'pburchak ostida qolib ketmasligi
            kerak. */}
        {points?.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={boilerPointIcon(point)}
            eventHandlers={{ click: () => onPointClick?.(point) }}
            zIndexOffset={600}
          />
        ))}

        {/* ⚠️ Qo'shni viloyat yorliqlari FAQAT viloyat ko'rinishida:
            tuman masshtabida ular ekrandan tashqarida qolib, faqat
            ortiqcha qatlam bo'lardi. */}
        {!isDistrictView
          ? NEIGHBOURS.map((neighbour) => (
              <Marker
                key={neighbour.label}
                position={neighbour.position}
                interactive={false}
                icon={L.divIcon({
                  className: '',
                  html: `<span style="white-space:nowrap;font:500 11px/1.4 var(--font-sans);color:var(--ink-faint)">${esc(
                    neighbour.label,
                  )}</span>`,
                  iconSize: [0, 0],
                })}
              />
            ))
          : null}

        {/* ⚠️ `viewKey` — ko'rinish identifikatori. O'zgarganda
            (to'liq ekran, boshqa chegara) avtomatik moslash
            tiklanadi; o'zgarmasa, foydalanuvchi zoomi SAQLANADI. */}
        {/* ⚠️ `viewKey` ichida TANLOV ham bor: usiz boshqa tumanga
            o'tilganda xarita eski masshtabda qolib, yangi tuman
            ekrandan tashqarida chizilardi. */}
        <BoundsKeeper
          bounds={bounds}
          viewKey={`${bboxKey}:${selectedId ?? 'all'}:${fullscreen}`}
        />

        {/* ⚠️ Boshqaruvlar MapContainer ICHIDA: `useMap()` faqat shu
            kontekstda ishlaydi. Tashqarida bo'lsa, kattalashtirish
            tugmasi «useMap must be used within MapContainer» xatosi
            bilan yiqilardi. */}
        <MapControls
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((value) => !value)}
          canReset={isDistrictView}
          onReset={() => onSelectDistrict(null)}
          showTiles={showTiles}
          onToggleTiles={() => setShowTiles((value) => !value)}
        />
      </MapContainer>

      {/* ⚠️ Afsona xarita USTIDA, pastki chap burchakda: u yerda
          Farg'ona tomonidagi bo'sh joy bor va birorta tumanni
          yopmaydi. O'ng yuqorida bo'lsa Namangan tomondagi
          tumanlarni to'sardi. */}
      <MapLegend />
    </div>
  );
}

/** Xarita afsonasi — holat ranglarining ma'nosi. */
function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--surface)]/92 px-2.5 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-sm">
      {STATUS_ORDER.map((status) => (
        <span
          key={status}
          className="flex items-center gap-1.5 text-nano font-medium text-muted"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: BOILER_STATUS[status].hex }}
          />
          {BOILER_STATUS[status].short}
        </span>
      ))}
    </div>
  );
}

function DistrictLayer({
  geojson,
  selectedId,
  onSelect,
  palette,
  fullscreen,
  solo,
  overTiles,
}: {
  geojson: DistrictGeoJson;
  selectedId: string | null;
  onSelect: (props: DistrictStats) => void;
  palette: ReturnType<typeof useDensityPalette>;
  fullscreen: boolean;
  /** Yolg'iz tuman ko'rinishi — ekranda bitta ko'pburchak. */
  solo: boolean;
  /** Ostida fon xaritasi (ko'chalar) bormi. */
  overTiles: boolean;
}) {
  /*
   * ⚠️⚠️ `key` ichida MA'LUMOT IMZOSI bor va u SHART. Leaflet GeoJSON
   * qatlami `data` o'zgarganda O'ZINI YANGILAMAYDI — React uni qayta
   * yaratishi kerak. Busiz filtr o'zgarganda ranglar eski holida
   * qolardi va foydalanuvchi «xarita yangilanmayapti» degan xulosaga
   * kelardi.
   */
  const signature = useMemo(
    () =>
      geojson.features
        .map(
          (feature) =>
            `${feature.properties.code}:${feature.properties.total}:${feature.properties.dominantStatus}`,
        )
        .join('|') +
      `|${selectedId ?? 'all'}|${solo ? 'solo' : 'region'}|${overTiles ? 'tiles' : 'flat'}` +
      (palette.dark ? '|dark' : '|light'),
    [geojson, selectedId, palette.dark, solo, overTiles],
  );

  /**
   * NOMI KO'RSATILMAYDIGAN TUMANLAR.
   *
   * ⚠️ Andijon shahri, Xonobod, Asaka kabi KICHIK tumanlar viloyat
   * markazida zich joylashgan va ularning nom yorliqlari bir-birining
   * ustiga tushib, o'qib bo'lmas aralashma hosil qilardi. Eng kichik
   * chorak uchun faqat SANOQ doirasi qoladi — nom ko'rsatmada
   * (hover) va yonidagi jadvalda baribir bor.
   *
   * ⚠️ Chegara MAYDON bo'yicha, obyektlar soni bo'yicha EMAS: masala
   * joyning yetishmasligida, muhimlikda emas.
   *
   * ⚠️ To'liq ekranda joy yetarli — hamma nom ko'rsatiladi.
   */
  const crowded = useMemo(() => {
    if (fullscreen) return new Set<string>();
    const spans = geojson.features
      .map((feature) => ({
        id: feature.properties.districtId,
        span: bboxSpan(feature.geometry),
      }))
      .sort((a, b) => a.span - b.span);
    const hidden = Math.floor(spans.length / 4);
    return new Set(spans.slice(0, hidden).map((item) => item.id));
  }, [geojson, fullscreen]);

  const hasSelection = Boolean(selectedId);

  return (
    <>
      <GeoJsonLayer
        key={signature}
        data={geojson as unknown as GeoJSON.FeatureCollection}
        style={(feature) => {
          const props = feature?.properties as DistrictStats | undefined;
          const selected = props ? selectedId === props.districtId : false;

          /*
           * ⚠️ YOLG'IZ tumanda to'ldirma ZICHLIK SHKALASIDAN OLINMAYDI:
           * ekranda bitta ko'pburchak qolgan va uning rangini
           * taqqoslaydigan hech narsa yo'q — rang ma'no tashimaydi.
           * Ustida esa qozonxona nuqtalari turadi va to'q fon ularni
           * yutib yuborardi.
           */
          const fillColor = solo
            ? palette.soloHex
            : palette.hexFor(props?.total ?? 0);

          /*
           * ⚠️⚠️ FON XARITASI USTIDA TO'LDIRMA SHAFFOF bo'ladi.
           *
           * Fonsiz ko'rinishda ko'pburchak — asosiy ma'lumot va u
           * to'q bo'ladi. Ko'chalar ustida esa aksincha: to'q
           * to'ldirma butun xaritani ko'kish parda bilan yopib,
           * «qozonxona qaysi ko'chada» degan savolni javobsiz
           * qoldirardi — ya'ni fon xaritasini yoqishdan ma'no
           * qolmasdi.
           *
           * ⚠️ Yolg'iz tumanda shaffoflik eng kuchli (0.14): aynan
           * o'sha ko'rinishda ta'mirchi manzilni qidiradi.
           */
          const fillOpacity = overTiles
            ? solo
              ? 0.14
              : !hasSelection || selected
                ? 0.34
                : 0.12
            : solo
              ? 0.9
              : !hasSelection || selected
                ? 1
                : 0.42;

          /* ⚠️ Chiziq fon ustida QALINROQ: ingichka oq chiziq
             ko'chalar va binolar orasida ko'rinmay ketardi. */
          const weight = overTiles
            ? solo
              ? 3
              : selected
                ? 3
                : 2
            : solo
              ? 2.2
              : selected
                ? 2.6
                : 1.4;

          return {
            color:
              solo || selected
                ? palette.selectedStrokeHex
                : overTiles
                  ? palette.selectedStrokeHex
                  : palette.strokeHex,
            weight,
            fillColor,
            fillOpacity,
          };
        }}
        onEachFeature={(feature, layer) => {
          const props = feature.properties as DistrictStats;
          layer.on({
            click: () => onSelect(props),
            /* ⚠️ Sichqoncha ostida FAQAT chiziq qalinlashadi.
               To'ldirish ham shaffoflashsa, u pastdagi ko'k fonga
               singib, ajralib turish o'rniga YO'QOLIB qolardi. */
            mouseover: (event) => {
              (event.target as L.Path).setStyle({ weight: 3 });
            },
            /* ⚠️ Sichqoncha ketganda chiziq O'Z qalinligiga qaytadi.
               Qat'iy qiymat yozilsa, tanlangan tumanning qalin
               chizig'i ustidan o'tilgandan keyin ingichkalashib
               qolardi. */
            mouseout: (event) => {
              (event.target as L.Path).setStyle({
                weight: selectedId === props.districtId ? 2.6 : 1.4,
              });
            },
          });
          layer.bindTooltip(districtTooltipHtml(props), {
            sticky: true,
            direction: 'top',
            opacity: 1,
            className: '!border-0 !bg-transparent !p-0 !shadow-none',
          });
        }}
      />

      {geojson.features.map((feature) => {
        const props = feature.properties;
        /*
         * ⚠️ O'lcham SONGA qarab: 29 ta obyekti bor tuman 2 ta
         * obyekti bor tumandan ko'zga ko'proq tashlanishi kerak.
         * Hammasi bir xil bo'lsa, xarita faqat RANG orqali
         * gapirardi va rangni ajrata olmaydigan foydalanuvchi uchun
         * u butunlay jim bo'lib qolardi.
         */
        /* ⚠️ Yolg'iz tumanda belgi KATTAROQ: ekranda bitta ko'pburchak
           bor va uning raqami asosiy ma'lumot — qo'shnilari bilan
           kesishib qolish xavfi yo'q. */
        const size = solo
          ? 40
          : props.total >= 20
            ? 34
            : props.total >= 10
              ? 30
              : props.total >= 1
                ? 27
                : 24;

        return (
          <Marker
            key={props.districtId}
            position={[props.centerLat, props.centerLng]}
            eventHandlers={{ click: () => onSelect(props) }}
            /* ⚠️ Kattaroq tuman USTDA chiziladi. Markaziy tumanlar
               yonma-yon va ularning yorliqlari kesishadi; tartibsiz
               bo'lsa, kichik tumanning nomi kattasining ustini
               yopib, ikkalasi ham o'qilmay qolardi. */
            zIndexOffset={props.total}
            icon={districtBadgeIcon(props, {
              size,
              showName: solo || !crowded.has(props.districtId),
              selected: !solo && selectedId === props.districtId,
            })}
          />
        );
      })}
    </>
  );
}

/** Geometriya chegaralovchi to'rtburchagining yuzasi (daraja²). */
function bboxSpan(geometry: GeoJSON.Geometry | null): number {
  if (!geometry) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: unknown): void => {
    if (
      Array.isArray(coords) &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const [x, y] = coords as [number, number];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };

  visit((geometry as { coordinates?: unknown }).coordinates);
  if (minX === Infinity) return 0;
  return (maxX - minX) * (maxY - minY);
}

/**
 * KO'RINISHNI MOSLASH — faqat KERAK BO'LGANDA.
 *
 * ⚠️⚠️ FOYDALANUVCHI ZOOMI USTUN. Har `bounds` yangilanishida
 * `fitBounds` chaqirilsa va `ResizeObserver` kuzatuv BOSHLANISHIDA
 * ham bir marta ishga tushsa, xarita har qayta chizishda o'z-o'zidan
 * boshlang'ich ko'rinishga qaytardi — kattalashtirish
 * «ishlamayotgandek» tuyulardi. Endi odam bir marta zoom qilsa yoki
 * xaritani sursa, avtomatik moslash TO'XTAYDI va faqat ko'rinish
 * almashganda qayta yoqiladi.
 *
 * ⚠️ `invalidateSize` esa HAR DOIM chaqiriladi: konteyner o'lchami
 * CSS orqali o'zgarganini Leaflet o'zi sezmaydi va xarita yarim
 * bo'sh qolardi. U zoomga tegmaydi.
 */
function BoundsKeeper({
  bounds,
  viewKey,
}: {
  bounds?: L.LatLngBoundsExpression;
  viewKey: string;
}) {
  const map = useMap();
  /* ⚠️ `useRef`, `useState` EMAS: qiymat o'zgarishi qayta chizishni
     keltirib chiqarmasligi kerak — aks holda Leaflet hodisasi React
     yangilanishi bilan aralashib, xarita «sakrab» ketardi. */
  const userMoved = useRef(false);

  /*
   * ⚠️ Faqat ODAM qilgan harakat hisobga olinadi. `fitBounds` ning
   * o'zi ham `zoomend`/`moveend` hodisasini yuboradi; ular ham
   * sanalsa, birinchi moslashdan keyin avtomatik rejim darhol
   * o'chib qolardi.
   */
  useEffect(() => {
    const onUserMove = (): void => {
      userMoved.current = true;
    };
    map.on('zoomstart', onUserMove);
    map.on('dragstart', onUserMove);
    return () => {
      map.off('zoomstart', onUserMove);
      map.off('dragstart', onUserMove);
    };
  }, [map]);

  useEffect(() => {
    userMoved.current = false;
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (bounds && !userMoved.current) {
        map.fitBounds(bounds, { padding: [14, 14] });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [map, bounds, viewKey]);

  /*
   * ⚠️ `ResizeObserver` — TAYMERDAN TASHQARI va undan muhimroq.
   * Xarita kartasining balandligi gridning o'sha qatoridagi eng
   * baland ustundan kelib chiqadi; u esa ma'lumot yuklangach
   * o'zgaradi. Qat'iy taymer bu lahzani o'tkazib yuborishi mumkin va
   * Leaflet eski o'lchamni keshlab qoladi: chegaralar konteynerning
   * o'rtasida kichkina bo'lib chizilardi.
   */
  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        if (bounds && !userMoved.current) {
          map.fitBounds(bounds, { padding: [14, 14], animate: false });
        }
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map, bounds]);

  return null;
}

function MapControls({
  fullscreen,
  onToggleFullscreen,
  canReset,
  onReset,
  showTiles,
  onToggleTiles,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  canReset: boolean;
  onReset?: () => void;
  showTiles: boolean;
  onToggleTiles: () => void;
}) {
  return (
    <div
      /*
       * ⚠️ `items-start` SHART. Flex ustunda bolalar sukut bo'yicha
       * `stretch` bo'ladi: «Viloyatga qaytish» yorliqli tugmasi
       * qo'shilgach, kattalashtirish qutisi ham uning kengligiga
       * CHO'ZILIB ketgan va ekranda 130 px lik bo'sh oq to'rtburchak
       * bo'lib turardi.
       */
      className="absolute top-3 left-3 z-[400] flex flex-col items-start gap-1.5"
      // Tugma bosilganda xarita ham siljib/kattalashib ketmasligi kerak.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="overflow-hidden rounded-lg bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <ZoomButton direction="in" />
        <span className="block h-px bg-line" />
        <ZoomButton direction="out" />
      </div>

      {/* ⚠️ Fon xaritasi tugmasi — yoqilganda BREND rangida.
          Oddiy kulrang bo'lsa, «hozir yoqilganmi yo'qmi» degan
          savolga javob faqat xaritaga qarab topilardi, tugmaga
          emas. */}
      <button
        type="button"
        onClick={onToggleTiles}
        aria-pressed={showTiles}
        aria-label={showTiles ? 'Fon xaritasini o‘chirish' : 'Fon xaritasini yoqish'}
        title={
          showTiles
            ? 'Fon xaritasini o‘chirish (toza ko‘rinish)'
            : 'Ko‘chalar va binolarni ko‘rsatish'
        }
        className={cn(
          'grid size-8 place-items-center rounded-lg shadow-[var(--shadow-card)] transition-colors',
          showTiles
            ? 'bg-brand-600 text-white'
            : 'bg-[var(--surface)] text-muted hover:text-strong',
        )}
      >
        <Layers className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? 'Oddiy ko‘rinish' : 'To‘liq ekran'}
        title={fullscreen ? 'Oddiy ko‘rinish (Esc)' : 'To‘liq ekran'}
        className="grid size-8 place-items-center rounded-lg bg-[var(--surface)] text-muted shadow-[var(--shadow-card)] transition-colors hover:text-strong"
      >
        {fullscreen ? (
          <Minimize2 className="size-3.5" />
        ) : (
          <Maximize2 className="size-3.5" />
        )}
      </button>

      {/*
        ⚠️ Tuman ko'rinishida tugma YORLIQLI, faqat ikonka emas:
        xarita butunlay boshqa masshtabda va foydalanuvchi «qanday
        qaytaman» degan savolga darhol javob topishi kerak. Ikonka
        bilan u xaritani qo'lda kichraytirib, adashib yurardi.
      */}
      {canReset && onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 text-micro font-semibold text-brand-600 shadow-[var(--shadow-card)] transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          Viloyatga qaytish
        </button>
      ) : null}
    </div>
  );
}

function ZoomButton({ direction }: { direction: 'in' | 'out' }) {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label={direction === 'in' ? 'Kattalashtirish' : 'Kichiklashtirish'}
      onClick={() => (direction === 'in' ? map.zoomIn() : map.zoomOut())}
      className="grid size-8 place-items-center text-muted transition-colors hover:bg-[var(--surface-sunken)] hover:text-strong"
    >
      {direction === 'in' ? (
        <Plus className="size-3.5" />
      ) : (
        <Minus className="size-3.5" />
      )}
    </button>
  );
}
