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
import {
  BOILER_STATUS,
  ROOM_CONDITION,
  STATUS_ORDER,
} from '@/shared/constants/status';
import { cn } from '@/shared/utils/cn';
import { useUiStore } from '@/store/ui.store';
import { FlowChannels } from './flow/FlowChannels';
import { useMapCompact, useMapViewTick } from './useMapCompact';
import {
  boilerModelIcon,
  districtBadgeIcon,
  districtBadgeSize,
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
  const dark = useUiStore((state) => state.theme === 'dark');

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
        ...(geojson?.features.map((feature) => feature.properties.total) ?? [
          1,
        ]),
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
  const bounds = useMemo<L.LatLngBoundsLiteral | undefined>(() => {
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
        /* ⚠️⚠️ `isolate` — Leaflet qatlamlari (z-index 400–1000) shu
           konteyner ICHIDA qoladi. Usiz ular sahifaning ildiz
           kontekstiga chiqib, oynalar (`z-50`) USTIDAN chizilardi:
           nuqta bosilganda ochilgan xonalar oynasi xarita ostida
           qolib, faqat qoraygan fon ko'rinardi. */
        'isolate',
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
            {...(BASEMAP.subdomains ? { subdomains: BASEMAP.subdomains } : {})}
            /* ⚠️ Yuqori piksel zichligidagi ekranda ikki baravar
               aniqroq tayl so'raladi — usiz xarita xira ko'rinardi. */
            detectRetina
            className={cn(
              'issiqlik-tiles-muted',
              BASEMAP.invertOnDark && 'issiqlik-basemap-tiles',
            )}
          />
        ) : null}

        <DistrictLayer
          geojson={visibleGeoJson}
          selectedId={selectedId}
          onSelect={handleSelect}
          palette={palette}
          solo={isDistrictView}
          overTiles={showTiles}
        />

        {/*
          ⚠️⚠️ OQIM KANALLARI — har kotyoldan o'z tuman markaziga.
          Canvas qatlamida (DOM emas): viloyat ko'rinishida 2000 tagacha
          kanal bo'lishi mumkin va har biri DOM elementi bo'lsa, xarita
          qotib qolardi. Kotyol belgilari (quyida) faqat tuman ochilganda.
        */}
        <FlowChannels
          geojson={visibleGeoJson}
          points={points}
          solo={isDistrictView}
          dark={dark}
        />

        {/* ⚠️ 3D kotyol belgilari FAQAT tuman ko'rinishida: viloyatda
            ular yuzlab bo'lib, bir-birini yopib, «uyum» bo'lib qolardi —
            u yerda kotyolni kanal boshidagi nurli tugun ko'rsatadi. */}
        {isDistrictView && points ? (
          <BoilerModels points={points} onPointClick={onPointClick} />
        ) : null}

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
          outline={selectedFeature?.geometry}
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

/**
 * 3D KOTYOL BELGILARI — faqat tuman ko'rinishida.
 *
 * ⚠️ Tor xaritada (telefon) model kichikroq: 54 px model 340 px xaritada
 * tuman chegarasining katta qismini yopib qo'yardi.
 *
 * ⚠️ Ikonkalar `useMemo` da: har renderda yangi `divIcon` berilsa,
 * Leaflet belgini qayta yaratib, holat to'lqinini boshidan boshlardi.
 */
function BoilerModels({
  points,
  onPointClick,
}: {
  points: BoilerPoint[];
  onPointClick?: (point: BoilerPoint) => void;
}) {
  const compact = useMapCompact();
  const icons = useMemo(
    () =>
      new Map(
        points.map((point) => [point.id, boilerModelIcon(point, compact)]),
      ),
    [points, compact],
  );
  return (
    <>
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={icons.get(point.id) ?? boilerModelIcon(point, compact)}
          eventHandlers={{ click: () => onPointClick?.(point) }}
          zIndexOffset={600}
        />
      ))}
    </>
  );
}

/** Xarita afsonasi — holat ranglarining ma'nosi. */
function MapLegend() {
  return (
    <div
      data-map-chrome="legend"
      className="pointer-events-none absolute bottom-3 left-3 z-[400] mr-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--surface)]/92 px-2.5 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
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
      {/* ⚠️ Halqa ma'nosi AFSONADA bo'lishi shart: aks holda ko'k
          halqani «tanlangan nuqta» deb o'qishardi. */}
      <span className="flex items-center gap-1.5 text-nano font-medium text-muted">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{
            boxShadow: `0 0 0 1.5px ${ROOM_CONDITION.cold.hex}`,
            backgroundColor: 'var(--surface)',
          }}
        />
        Sovuq xona bor
      </span>
    </div>
  );
}

function DistrictLayer({
  geojson,
  selectedId,
  onSelect,
  palette,
  solo,
  overTiles,
}: {
  geojson: DistrictGeoJson;
  selectedId: string | null;
  onSelect: (props: DistrictStats) => void;
  palette: ReturnType<typeof useDensityPalette>;
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
  const map = useMap();
  const compact = useMapCompact();
  const viewTick = useMapViewTick();

  /*
   * ⚠️⚠️ NOMLAR — HAQIQIY PIKSEL TO'QNASHUVI BO'YICHA. Har zoom va ekran
   * o'lchamida har belgining doirasi va nom yorlig'i ekrandagi to'rtburchak
   * sifatida hisoblanadi; boshqasiga tegsa, nom yashiriladi (doira qoladi).
   * Ustunlik — kotyoli KO'P tumanga. Ilgari «eng kichik 25%» doim
   * yashirilardi: telefonda nomlar baribir ustma-ust tushardi, katta
   * ekranda esa joy bo'la turib yashirilardi.
   */
  const visibleNames = useMemo(() => {
    void viewTick;
    /* ⚠️ Xaritaga hali ko'rinish berilmagan bo'lsa (chegara topilmadi),
       Leaflet piksel hisobida «Set map center and zoom first» bilan
       yiqilib, butun xaritani xato oynasiga tushirardi. */
    if (!(map as L.Map & { _loaded?: boolean })._loaded) {
      return new Set<string>();
    }
    const placed: Array<[number, number, number, number]> = [];
    const hits = (a: [number, number, number, number]): boolean =>
      placed.some(
        (b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1],
      );
    const order = [...geojson.features].sort(
      (a, b) => b.properties.total - a.properties.total,
    );
    // Avval HAMMA doiralar joylashadi (ular doim ko'rinadi).
    for (const feature of order) {
      const props = feature.properties;
      const p = map.latLngToContainerPoint([props.centerLat, props.centerLng]);
      const r = districtBadgeSize(props.total, solo, compact) / 2;
      placed.push([p.x - r, p.y - r, p.x + r, p.y + r]);
    }
    const visible = new Set<string>();
    for (const feature of order) {
      const props = feature.properties;
      const p = map.latLngToContainerPoint([props.centerLat, props.centerLng]);
      const r = districtBadgeSize(props.total, solo, compact) / 2;
      // Yorliq: 10px shrift ≈ 6px/harf + ichki chekka; doira ostida.
      const w = props.shortName.length * 6 + 14;
      const rect: [number, number, number, number] = [
        p.x - w / 2,
        p.y + r + 2,
        p.x + w / 2,
        p.y + r + 19,
      ];
      if (solo || !hits(rect)) {
        visible.add(props.districtId);
        placed.push(rect);
      }
    }
    return visible;
  }, [geojson, map, solo, compact, viewTick]);

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
        const size = districtBadgeSize(props.total, solo, compact);

        return (
          <Marker
            key={props.districtId}
            position={[props.centerLat, props.centerLng]}
            eventHandlers={{ click: () => onSelect(props) }}
            /* ⚠️ Kattaroq tuman USTDA chiziladi. Markaziy tumanlar
               yonma-yon va ularning yorliqlari kesishadi; tartibsiz
               bo'lsa, kichik tumanning nomi kattasining ustini
               yopib, ikkalasi ham o'qilmay qolardi. */
            /* ⚠️ Tuman ko'rinishida markaz belgisi HAR DOIM ustda: unga
               yaqin turgan 3D kotyollar (`zIndexOffset` 600) uning raqami
               va nomini yopib qo'ymasin — kanallar aynan shu belgiga oqadi. */
            zIndexOffset={solo ? 5000 : props.total}
            icon={districtBadgeIcon(props, {
              size,
              showName: visibleNames.has(props.districtId),
              selected: !solo && selectedId === props.districtId,
            })}
          />
        );
      })}
    </>
  );
}

/** Chegara bilan xarita cheti / boshqaruvlar orasidagi bo'shliq, px. */
const FIT_GAP = 14;

/**
 * Dastur moslashidan keyin `zoomstart` «odamniki» deb sanalmaydigan
 * oyna, ms. Leaflet zoom animatsiyasi 250 ms + bir kadr kechikish.
 */
const FIT_GRACE_MS = 600;

interface MapChrome {
  /** Tor tugmalar ustunining o'ng cheti + bo'shliq. */
  left: number;
  /** Afsonaning yuqori cheti (pastdan) + bo'shliq. */
  bottom: number;
  /** Yorliqli keng tugmalar — konteyner koordinatasida, bo'shliq bilan. */
  obstacles: L.Bounds[];
  size: L.Point;
}

/**
 * Xarita USTIDAGI boshqaruvlar egallagan joy — DOM'dagi HAQIQIY o'lcham.
 *
 * ⚠️⚠️ Bir xil `padding` yetmaydi: chapda tugmalar ustuni, pastda afsona
 * turadi va chegaraning cheti aynan ular OSTIGA tushib, ko'rinmay qolardi
 * (Xonobod shahrining janubiy uchi afsona ostida edi). O'lcham
 * qotirilmaydi: telefonda afsona ikki qatorga o'raladi.
 *
 * ⚠️ Chekinish xaritaning ma'lum ulushidan oshmaydi — juda tor xaritada
 * chegara nuqtaga aylanib qolmasligi uchun.
 */
function measureChrome(map: L.Map): MapChrome {
  const container = map.getContainer();
  const box = container.getBoundingClientRect();
  const half = FIT_GAP / 2;
  let left = FIT_GAP;
  let bottom = FIT_GAP;
  const obstacles: L.Bounds[] = [];

  const controls = container.querySelector('[data-map-chrome="controls"]');
  for (const child of Array.from(controls?.children ?? [])) {
    const rect = child.getBoundingClientRect();
    if (child.matches('[data-map-chrome="wide"]')) {
      obstacles.push(
        L.bounds(
          [rect.left - box.left - half, rect.top - box.top - half],
          [rect.right - box.left + half, rect.bottom - box.top + half],
        ),
      );
    } else {
      left = Math.max(left, rect.right - box.left + FIT_GAP);
    }
  }

  // Afsona MapContainer'dan TASHQARIDA — ota konteynerda.
  const legend = container.parentElement?.querySelector(
    '[data-map-chrome="legend"]',
  );
  if (legend) {
    bottom = Math.max(
      bottom,
      box.bottom - legend.getBoundingClientRect().top + FIT_GAP,
    );
  }

  return {
    left: Math.min(left, box.width * 0.3),
    bottom: Math.min(bottom, box.height * 0.25),
    obstacles,
    size: L.point(box.width, box.height),
  };
}

function fitPadding(
  left: number,
  bottom: number,
  top: number = FIT_GAP,
): Pick<L.FitBoundsOptions, 'paddingTopLeft' | 'paddingBottomRight'> {
  return {
    paddingTopLeft: [left, top],
    paddingBottomRight: [FIT_GAP, bottom],
  };
}

function outlineRings(geometry: GeoJSON.Geometry): GeoJSON.Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/**
 * Shu chekinish bilan joylashtirilsa, chegara CHIZIG'I keng tugma ostiga
 * tushadimi.
 *
 * ⚠️ Leaflet `fitBounds` hisobini AYNAN takrorlaydi (zoom + markaz),
 * xaritani siljitmasdan. Tekshiruv chizig'i 4 px qadam bilan: OSM
 * chegarasida ikki uch orasi tuman masshtabida 100 px gacha bo'ladi va
 * faqat uchlar tekshirilsa, tugma burchagidan o'tgan chiziq sezilmasdi.
 */
function outlineHitsObstacle(
  map: L.Map,
  bounds: L.LatLngBounds,
  padding: ReturnType<typeof fitPadding>,
  outline: GeoJSON.Geometry,
  obstacles: L.Bounds[],
): boolean {
  if (obstacles.length === 0) return false;
  const tl = L.point(padding.paddingTopLeft as L.PointTuple);
  const br = L.point(padding.paddingBottomRight as L.PointTuple);
  const zoom = map.getBoundsZoom(bounds, false, tl.add(br));
  const center = map
    .project(bounds.getSouthWest(), zoom)
    .add(map.project(bounds.getNorthEast(), zoom))
    .divideBy(2)
    .add(br.subtract(tl).divideBy(2));
  const origin = center.subtract(map.getSize().divideBy(2));
  const toPx = (position: GeoJSON.Position): L.Point =>
    map.project([position[1], position[0]], zoom).subtract(origin);
  const hit = (point: L.Point): boolean =>
    obstacles.some((obstacle) => obstacle.contains(point));

  for (const ring of outlineRings(outline)) {
    if (ring.length === 0) continue;
    let prev = toPx(ring[0]);
    if (hit(prev)) return true;
    for (let i = 1; i < ring.length; i++) {
      const next = toPx(ring[i]);
      const steps = Math.max(1, Math.ceil(prev.distanceTo(next) / 4));
      const delta = next.subtract(prev);
      for (let step = 1; step <= steps; step++) {
        if (hit(prev.add(delta.multiplyBy(step / steps)))) return true;
      }
      prev = next;
    }
  }
  return false;
}

/**
 * `fitBounds` chekinishi.
 *
 * ⚠️ Keng tugma («Viloyatga qaytish») chekinishga SHARTSIZ qo'shilsa,
 * planshetda tuman 25% kichrayib, o'ngga surilib ketardi — holbuki
 * ko'pincha chegara uning ostidan o'tmaydi ham. Shuning uchun u TO'SIQ:
 * avval tor chekinish sinab ko'riladi va faqat chegara chizig'i tugma
 * ostiga tushsagina tugmani chetlab o'tadigan ikki variant — CHAPDAN yoki
 * TEPADAN — solishtiriladi va tumanni KATTAROQ ko'rsatgani olinadi
 * (enli tumanda tepada bo'sh joy baribir bor, ingichkasida — yonda).
 */
function fitOptionsFor(
  map: L.Map,
  bounds: L.LatLngBoundsLiteral,
  outline: GeoJSON.Geometry | null | undefined,
): ReturnType<typeof fitPadding> {
  const chrome = measureChrome(map);
  const latLngBounds = L.latLngBounds(bounds);
  const narrow = fitPadding(chrome.left, chrome.bottom);
  const hits = (padding: ReturnType<typeof fitPadding>): boolean =>
    Boolean(outline) &&
    outlineHitsObstacle(
      map,
      latLngBounds,
      padding,
      outline as GeoJSON.Geometry,
      chrome.obstacles,
    );
  if (!hits(narrow)) return narrow;

  const pastX = Math.max(...chrome.obstacles.map((o) => o.max?.x ?? 0));
  const pastY = Math.max(...chrome.obstacles.map((o) => o.max?.y ?? 0));
  const besideLeft = fitPadding(
    Math.min(Math.max(chrome.left, pastX + FIT_GAP / 2), chrome.size.x * 0.3),
    chrome.bottom,
  );
  const belowTop = fitPadding(
    chrome.left,
    chrome.bottom,
    Math.min(pastY + FIT_GAP / 2, chrome.size.y * 0.3),
  );
  const zoomOf = (padding: ReturnType<typeof fitPadding>): number =>
    map.getBoundsZoom(
      latLngBounds,
      false,
      L.point(padding.paddingTopLeft as L.PointTuple).add(
        L.point(padding.paddingBottomRight as L.PointTuple),
      ),
    );

  // Kattaroq ko'rsatadigani birinchi; to'siqqa tegmaydigani tanlanadi.
  const candidates = [besideLeft, belowTop].sort(
    (a, b) => zoomOf(b) - zoomOf(a),
  );
  return candidates.find((padding) => !hits(padding)) ?? besideLeft;
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
  outline,
  viewKey,
}: {
  bounds?: L.LatLngBoundsLiteral;
  /** Tuman ko'rinishida — chegara chizig'i (to'siq tekshiruvi uchun). */
  outline?: GeoJSON.Geometry | null;
  viewKey: string;
}) {
  const map = useMap();
  /* ⚠️ `useRef`, `useState` EMAS: qiymat o'zgarishi qayta chizishni
     keltirib chiqarmasligi kerak — aks holda Leaflet hodisasi React
     yangilanishi bilan aralashib, xarita «sakrab» ketardi. */
  const userMoved = useRef(false);

  /*
   * ⚠️ Effektlar `bounds`/`outline` OBYEKTIGA emas, QIYMAT kalitiga
   * bog'lanadi: react-query oyna fokusi qaytganda geojson'ni qayta
   * olib, YANGI obyekt beradi (qiymati o'sha). Obyektga bog'lansa,
   * tuman ko'rinishida foydalanuvchi kattalashtirgan xarita boshqa
   * oynadan qaytishi bilan o'z-o'zidan dastlabki holatga qaytardi.
   */
  const boundsKey = bounds ? bounds.flat().join(',') : '';
  const latest = useRef({ bounds, outline });
  useEffect(() => {
    latest.current = { bounds, outline };
  });

  /*
   * ⚠️ Faqat ODAM qilgan harakat hisobga olinadi.
   *
   * ⚠️⚠️ Animatsiyali `fitBounds` ning O'ZI ham `zoomstart` yuboradi
   * (keyingi kadrda). Ilgari u ham «odam zoom qildi» deb sanalardi:
   * birinchi moslashdan keyin avtomatik rejim jimgina o'chib, telefon
   * burilganda yoki oyna o'lchami o'zgarganda viloyat chetlari kesilib
   * qolardi. Endi dastur moslagandan keyingi qisqa OYNA (`fitUntil`)
   * ichidagi `zoomstart` hisobga olinmaydi. `dragstart` faqat odamdan.
   *
   * ⚠️ Vaqt oynasi, `moveend` gacha turadigan bayroq EMAS: ikki moslash
   * (taymer + ResizeObserver) bir kadrda kelsa, birinchisining `moveend`
   * i bayroqni ikkinchisining kechiktirilgan `zoomstart` idan OLDIN
   * tushirib, avtomatik rejimni baribir o'chirib qo'yardi.
   */
  const fitUntil = useRef(0);
  const markFitting = (): void => {
    fitUntil.current = performance.now() + FIT_GRACE_MS;
  };
  useEffect(() => {
    const onZoomStart = (): void => {
      if (performance.now() > fitUntil.current) userMoved.current = true;
    };
    const onDragStart = (): void => {
      userMoved.current = true;
    };
    map.on('zoomstart', onZoomStart);
    map.on('dragstart', onDragStart);
    return () => {
      map.off('zoomstart', onZoomStart);
      map.off('dragstart', onDragStart);
    };
  }, [map]);

  useEffect(() => {
    userMoved.current = false;
    const timer = setTimeout(() => {
      map.invalidateSize();
      const { bounds: target, outline: shape } = latest.current;
      if (target && !userMoved.current) {
        markFitting();
        map.fitBounds(target, fitOptionsFor(map, target, shape));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [map, boundsKey, viewKey]);

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
        const { bounds: target, outline: shape } = latest.current;
        if (target && !userMoved.current) {
          markFitting();
          map.fitBounds(target, {
            ...fitOptionsFor(map, target, shape),
            animate: false,
          });
        }
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

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
  const compact = useMapCompact();
  return (
    <div
      /*
       * ⚠️ `items-start` SHART. Flex ustunda bolalar sukut bo'yicha
       * `stretch` bo'ladi: «Viloyatga qaytish» yorliqli tugmasi
       * qo'shilgach, kattalashtirish qutisi ham uning kengligiga
       * CHO'ZILIB ketgan va ekranda 130 px lik bo'sh oq to'rtburchak
       * bo'lib turardi.
       */
      data-map-chrome="controls"
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
        aria-label={
          showTiles ? 'Fon xaritasini o‘chirish' : 'Fon xaritasini yoqish'
        }
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
      {/*
        ⚠️ TOR xaritada (telefon) faqat ikonka: yorliqli tugma 150 px
        bo'lib, chegara uning ostida qolmasligi uchun xaritaning chap
        40% ini bo'sh qoldirishga to'g'ri kelardi.
      */}
      {canReset && onReset ? (
        <button
          type="button"
          onClick={onReset}
          data-map-chrome="wide"
          aria-label="Viloyatga qaytish"
          title="Viloyatga qaytish"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--surface)] text-micro font-semibold text-brand-600 shadow-[var(--shadow-card)] transition-colors hover:text-brand-700',
            compact ? 'w-8 justify-center' : 'px-2.5',
          )}
        >
          <ArrowLeft className="size-3.5" />
          {compact ? null : 'Viloyatga qaytish'}
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
