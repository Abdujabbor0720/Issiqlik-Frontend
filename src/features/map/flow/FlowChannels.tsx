import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type {
  BoilerPoint,
  BoilerStatus,
  DistrictGeoJson,
} from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import { usePrefersReducedMotion } from '@/shared/hooks/useMediaQuery';
import { districtBadgeSize } from '../map-icons';
import { useMapCompact } from '../useMapCompact';
import {
  FlowCanvasLayer,
  type FlowData,
  type FlowSpec,
  type HubSpec,
} from './FlowCanvasLayer';

/** Oqim qatlami paneli — tuman ko'pburchaklari USTIDA, belgilar OSTIDA. */
const FLOW_PANE = 'issiqlik-flow';

/**
 * OQIM TEZLIGI holatga qarab, px/s.
 *
 * ⚠️ Oqim HECH QACHON to'xtamaydi — «aloqa yo'q» kotyolda ham. Lekin u
 * kulrang va sekin: jonli oqim bilan bir xil ko'rinsa, ishlamayotgan
 * qozonxona «ishlayapti» degan yolg'on taassurot berardi.
 */
const SPEED: Record<BoilerStatus, number> = {
  active: 64,
  medium: 46,
  inactive: 30,
  offline: 15,
};

/**
 * KOTYOLDAN TUMAN MARKAZIGA OQIM KANALLARI.
 *
 * Har bir koordinatali kotyoldan o'z tumanining markaziga (sanoq belgisi)
 * egri kanal chiziladi va unda nur zarralari doimiy oqadi. Markazda
 * «yutish» halqalari pulslaydi.
 *
 * ⚠️ `geojson` — KO'RINIB TURGAN tumanlar: tuman ochilganda faqat
 * bittasi, ya'ni boshqa tumanlarning kanallari chizilmaydi.
 */
export function FlowChannels({
  geojson,
  points,
  solo,
  dark,
}: {
  geojson: DistrictGeoJson;
  points: BoilerPoint[] | undefined;
  /** Tuman ko'rinishi — kotyollar rasm bilan, kanallar qalinroq. */
  solo: boolean;
  dark: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<FlowCanvasLayer | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  // ⚠️ Belgi o'lchami bilan AYNI qoida — kanal aynan belgi chetiga kirsin.
  const compact = useMapCompact();

  useEffect(() => {
    const pane = map.getPane(FLOW_PANE) ?? map.createPane(FLOW_PANE);
    // overlayPane (ko'pburchaklar) — 400, markerPane (belgilar) — 600.
    pane.style.zIndex = '450';
    pane.style.pointerEvents = 'none';

    const layer = new FlowCanvasLayer(FLOW_PANE);
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  const geometry = useMemo<Pick<FlowData, 'flows' | 'hubs'>>(() => {
    const features = new Map(
      geojson.features.map((feature) => [
        feature.properties.districtId,
        feature.properties,
      ]),
    );

    const flows: FlowSpec[] = [];
    const used = new Set<string>();
    for (const point of points ?? []) {
      if (!features.has(point.districtId)) continue;
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
      flows.push({
        id: point.id,
        from: [point.lat, point.lng],
        hubId: point.districtId,
        color: BOILER_STATUS[point.status].hex,
        speed: SPEED[point.status],
      });
      used.add(point.districtId);
    }

    /*
     * ⚠️ Halqa FAQAT kanali bor markazda: kotyoli yo'q tumanda «yutish»
     * animatsiyasi hech narsa oqib kelmayotgan joyda pulslab, ma'nosiz
     * shovqin bo'lardi.
     */
    const hubs: HubSpec[] = [];
    for (const districtId of used) {
      const props = features.get(districtId);
      if (!props) continue;
      hubs.push({
        id: districtId,
        at: [props.centerLat, props.centerLng],
        color: BOILER_STATUS[props.dominantStatus].hex,
        radius: districtBadgeSize(props.total, solo, compact) / 2,
      });
    }
    return { flows, hubs };
  }, [geojson, points, solo, compact]);

  useEffect(() => {
    layerRef.current?.setData({
      ...geometry,
      detail: solo ? 'district' : 'region',
      dark,
      reducedMotion,
    });
  }, [geometry, solo, dark, reducedMotion]);

  return null;
}
