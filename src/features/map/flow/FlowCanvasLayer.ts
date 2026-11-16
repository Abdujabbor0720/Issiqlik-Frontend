import L from 'leaflet';
import {
  buildCurve,
  hexToRgb,
  pointAt,
  stablePhase,
  type CurveLut,
  type Pt,
} from './flow-geometry';

/** Bitta kanal: kotyoldan tuman markaziga. */
export interface FlowSpec {
  id: string;
  from: [number, number];
  /** Qaysi markazga oqadi (`HubSpec.id`). */
  hubId: string;
  /** Holat rangi (`#rrggbb`). */
  color: string;
  /** Oqim tezligi, px/s — holatga qarab. */
  speed: number;
}

/** Tuman markazi — kanallar yig'iladigan nuqta. */
export interface HubSpec {
  id: string;
  at: [number, number];
  color: string;
  /** Markaz belgisi radiusi, px — kanal shu chegarada «kiradi». */
  radius: number;
}

export type FlowDetail = 'region' | 'district';

export interface FlowData {
  flows: FlowSpec[];
  hubs: HubSpec[];
  detail: FlowDetail;
  dark: boolean;
  reducedMotion: boolean;
}

interface FlowRuntime {
  spec: FlowSpec;
  lut: CurveLut;
  start: number;
  end: number;
  span: number;
  phase: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  glow: HTMLCanvasElement;
  core: HTMLCanvasElement;
}

interface HubRuntime {
  x: number;
  y: number;
  rgb: string;
  radius: number;
  phase: number;
}

/** Markazdagi «yutish» halqasi davri, s. */
const HUB_PERIOD = 2.6;
/** Kotyol rasmi ostidan chiqish masofasi (tuman ko'rinishi), px. */
const DISTRICT_START_TRIM = 7;
/** Viloyat ko'rinishida kanal boshlanish nuqtasi (manba tugun radiusi). */
const REGION_START_TRIM = 3;

/**
 * OQIM KANALLARI — canvas qatlami (Leaflet `Layer`).
 *
 * ⚠️⚠️ NIMA UCHUN CANVAS, SVG/DOM EMAS. Viloyatda 2000 tagacha kotyol va har
 * birida bir nechta harakatlanuvchi zarra bor. SVG'da bu o'n minglab
 * element bo'lib, har kadrda brauzer ularning hammasini qayta joylashtirardi
 * — xarita qotib qolardi. Canvas'da esa kadr narxi faqat chizilgan piksellar.
 *
 * ⚠️ CANVAS FAQAT KO'RINIB TURGAN OYNA O'LCHAMIDA. Xaritadan kattaroq
 * (zaxira chetli) canvas retina ekranda 100 MB dan ortiq xotira yerdi.
 * Buning o'rniga egri chiziqlar «qatlam koordinatalari»da saqlanadi va
 * har kadrda joriy siljish bilan chiziladi; xarita surilganda faqat canvas
 * joyi yangilanadi, geometriya qayta hisoblanmaydi.
 *
 * ⚠️ Kanallar RANG BO'YICHA guruhlanib (`Path2D`) chiziladi: 2000 kanal —
 * 2000 emas, 4 rang × 2 qatlam = 8 ta chizish buyrug'i.
 */
export class FlowCanvasLayer extends L.Layer {
  private paneName: string;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private width = 0;
  private height = 0;

  private data: FlowData = {
    flows: [],
    hubs: [],
    detail: 'region',
    dark: false,
    reducedMotion: false,
  };
  private flows: FlowRuntime[] = [];
  private hubs: HubRuntime[] = [];
  /** Rang bo'yicha guruhlangan kanallar va manba tugunlari (qatlam koordinatalarida). */
  private channels = new Map<
    string,
    { path: Path2D; nodes: Path2D; rgb: string }
  >();
  private sprites = new Map<
    string,
    { glow: HTMLCanvasElement; core: HTMLCanvasElement }
  >();

  private running = false;
  private raf = 0;
  private last = 0;
  /** Faqat animatsiya ishlayotganda o'sadigan soat — pauzadan keyin sakrash bo'lmaydi. */
  private clock = 0;
  private inView = true;
  private observer: IntersectionObserver | null = null;
  /** Kadr narxining silliq o'rtachasi (ms) — sekin qurilmada sifatni pasaytirish uchun. */
  private frameCost = 0;
  private quality = 2;

  private readonly scratch: Pt = { x: 0, y: 0 };

  constructor(paneName: string) {
    super();
    this.paneName = paneName;
  }

  // ───────────────────────── Leaflet hayot sikli ─────────────────────────

  onAdd(map: L.Map): this {
    const pane = map.getPane(this.paneName) ?? map.getPanes().overlayPane;
    const canvas = L.DomUtil.create('canvas', 'issiqlik-flow-canvas', pane);
    canvas.setAttribute('aria-hidden', 'true');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    map.on('move', this.onMove, this);
    map.on('zoomstart', this.onZoomStart, this);
    map.on('zoomend viewreset', this.onZoomEnd, this);
    map.on('resize', this.onResize, this);
    document.addEventListener('visibilitychange', this.onVisibility);

    /*
     * ⚠️ Xarita sahifada pastda bo'lsa (dashboard), u ekranda ko'rinmaguncha
     * animatsiya ISHLAMAYDI — ko'rinmas narsani chizish sof isrof.
     */
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(([entry]) => {
        this.inView = entry?.isIntersecting ?? true;
        this.syncLoop();
      });
      this.observer.observe(map.getContainer());
    }

    this.onResize();
    this.rebuild();
    return this;
  }

  onRemove(map: L.Map): this {
    this.stop();
    map.off('move', this.onMove, this);
    map.off('zoomstart', this.onZoomStart, this);
    map.off('zoomend viewreset', this.onZoomEnd, this);
    map.off('resize', this.onResize, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer?.disconnect();
    this.observer = null;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    return this;
  }

  /** Ma'lumot yangilandi (kotyollar, holat, mavzu, ko'rinish). */
  setData(data: FlowData): void {
    const themeChanged = data.dark !== this.data.dark;
    this.data = data;
    if (themeChanged) this.sprites.clear();
    if (this._map) this.rebuild();
  }

  // ───────────────────────── Hodisalar ─────────────────────────

  private onMove(): void {
    this.placeCanvas();
    // Animatsiya to'xtagan bo'lsa ham (harakat kamaytirilgan), surilgandan keyin qayta chiziladi.
    if (!this.running) this.draw();
  }

  /**
   * ⚠️ Zoom animatsiyasi paytida canvas YASHIRILADI: u taylar bilan birga
   * CSS orqali kattalashmaydi va bir zum kanallar boshqa joyda «osilib»
   * qolardi. Yumshoq so'nish (CSS) tufayli bu sezilmaydi.
   */
  private onZoomStart(): void {
    this.canvas?.classList.add('is-zooming');
  }

  private onZoomEnd(): void {
    this.rebuild();
    this.canvas?.classList.remove('is-zooming');
  }

  private onResize(): void {
    const map = this._map;
    const canvas = this.canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    /*
     * ⚠️ Piksel zichligi 2 bilan cheklanadi: 3x ekranda (ba'zi noutbuklar)
     * canvas 9 baravar katta bo'lib, ko'zga farqi sezilmagan holda
     * xotira va GPU'ni yeb qo'yardi.
     */
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = size.x;
    this.height = size.y;
    canvas.width = Math.max(1, Math.round(size.x * this.dpr));
    canvas.height = Math.max(1, Math.round(size.y * this.dpr));
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    this.sprites.clear();
    this.placeCanvas();
    if (!this.running) this.draw();
  }

  private readonly onVisibility = (): void => {
    this.syncLoop();
  };

  // ───────────────────────── Geometriya ─────────────────────────

  /** Canvas har doim xarita oynasini aniq qoplaydi. */
  private placeCanvas(): void {
    const map = this._map;
    if (!map || !this.canvas) return;
    L.DomUtil.setPosition(this.canvas, map.containerPointToLayerPoint([0, 0]));
  }

  /**
   * Barcha kanallarni qayta hisoblash — FAQAT zoom yoki ma'lumot
   * o'zgarganda. Surishda (pan) qatlam koordinatalari o'zgarmaydi.
   */
  private rebuild(): void {
    const map = this._map;
    if (!map) return;
    const { flows, hubs, detail } = this.data;
    const startTrim =
      detail === 'district' ? DISTRICT_START_TRIM : REGION_START_TRIM;

    const toLayer = (at: [number, number]): Pt => {
      const p = map.latLngToLayerPoint(at);
      return { x: p.x, y: p.y };
    };

    const hubById = new Map(hubs.map((hub) => [hub.id, hub]));

    this.flows = [];
    this.channels.clear();

    for (const spec of flows) {
      const hub = hubById.get(spec.hubId);
      // Markazi yo'q kanal chizilmaydi — u «hech qayerga» oqib ketardi.
      if (!hub) continue;
      const lut = buildCurve(toLayer(spec.from), toLayer(hub.at));
      if (!lut) continue;
      // Kanal markaz belgisining CHETIGA kiradi — belgi ostiga emas.
      const endTrim = hub.radius + 2;
      const start = startTrim;
      const end = lut.length - endTrim;
      /*
       * ⚠️ Markazga juda yaqin kotyol (zoom kichik) — kanal chizilmaydi:
       * 10 px dan qisqa «oqim» nuqta bo'lib ko'rinadi va markaz belgisi
       * ostida yo'qolib ketadi.
       */
      if (end - start < 10) continue;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < lut.xs.length; i += 1) {
        if (lut.xs[i] < minX) minX = lut.xs[i];
        if (lut.xs[i] > maxX) maxX = lut.xs[i];
        if (lut.ys[i] < minY) minY = lut.ys[i];
        if (lut.ys[i] > maxY) maxY = lut.ys[i];
      }

      const sprite = this.spriteFor(spec.color);
      this.flows.push({
        spec,
        lut,
        start,
        end,
        span: end - start,
        phase: stablePhase(spec.id),
        minX,
        minY,
        maxX,
        maxY,
        glow: sprite.glow,
        core: sprite.core,
      });

      // Kanal yo'li — rang guruhiga.
      let group = this.channels.get(spec.color);
      if (!group) {
        group = {
          path: new Path2D(),
          nodes: new Path2D(),
          rgb: hexToRgb(spec.color),
        };
        this.channels.set(spec.color, group);
      }
      const p = this.scratch;
      pointAt(lut, start, p);
      group.path.moveTo(p.x, p.y);
      const step = 4;
      for (let s = start + step; s < end; s += step) {
        pointAt(lut, s, p);
        group.path.lineTo(p.x, p.y);
      }
      pointAt(lut, end, p);
      group.path.lineTo(p.x, p.y);

      // Viloyat ko'rinishida kotyolning o'zi — nurli tugun (rasm yo'q).
      if (detail === 'region') {
        group.nodes.moveTo(lut.xs[0] + 2.6, lut.ys[0]);
        group.nodes.arc(lut.xs[0], lut.ys[0], 2.6, 0, Math.PI * 2);
      }
    }

    this.hubs = hubs.map((hub) => {
      const p = toLayer(hub.at);
      return {
        x: p.x,
        y: p.y,
        rgb: hexToRgb(hub.color),
        radius: hub.radius,
        phase: stablePhase(hub.id),
      };
    });

    this.placeCanvas();
    this.syncLoop();
    if (!this.running) this.draw();
  }

  // ───────────────────────── Spritelar ─────────────────────────

  /**
   * Zarra spritelari — har rang uchun BIR MARTA chiziladi.
   *
   * ⚠️ Har kadrda `createRadialGradient` qilish 2000 kanalda sekundiga
   * yuz minglab gradient obyekti degani; tayyor rasmni `drawImage` bilan
   * qo'yish esa GPU uchun eng arzon amal.
   */
  private spriteFor(color: string): {
    glow: HTMLCanvasElement;
    core: HTMLCanvasElement;
  } {
    const cached = this.sprites.get(color);
    if (cached) return cached;
    const rgb = hexToRgb(color);
    const scale = this.dpr;

    const glow = document.createElement('canvas');
    const gs = Math.round(32 * scale);
    glow.width = gs;
    glow.height = gs;
    const g = glow.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(
        gs / 2,
        gs / 2,
        0,
        gs / 2,
        gs / 2,
        gs / 2,
      );
      grad.addColorStop(0, `rgba(${rgb},0.95)`);
      grad.addColorStop(0.22, `rgba(${rgb},0.55)`);
      grad.addColorStop(0.55, `rgba(${rgb},0.14)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, gs, gs);
    }

    /*
     * ⚠️ Yadro — «oq-issiq» markaz: rangli dog' emas, NUR bo'lib ko'rinishi
     * shundan. Yorug' xaritada sof oq yo'qolib ketadi, shuning uchun
     * chetida holat rangi qoladi.
     */
    const core = document.createElement('canvas');
    const cs = Math.round(12 * scale);
    core.width = cs;
    core.height = cs;
    const c = core.getContext('2d');
    if (c) {
      const grad = c.createRadialGradient(
        cs / 2,
        cs / 2,
        0,
        cs / 2,
        cs / 2,
        cs / 2,
      );
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.42, `rgba(${rgb},0.95)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = grad;
      c.fillRect(0, 0, cs, cs);
    }

    const sprite = { glow, core };
    this.sprites.set(color, sprite);
    return sprite;
  }

  // ───────────────────────── Animatsiya sikli ─────────────────────────

  /**
   * ⚠️ Sikl FAQAT kerak bo'lganda aylanadi: tab ko'rinib turibdi, xarita
   * ekranda, harakat kamaytirilmagan va kamida bitta kanal bor. Aks holda
   * GPU va batareya behuda ishlardi (fon tabida ham).
   */
  private syncLoop(): void {
    const should =
      Boolean(this._map) &&
      !document.hidden &&
      this.inView &&
      !this.data.reducedMotion &&
      (this.flows.length > 0 || this.hubs.length > 0);
    if (should) this.start();
    else {
      this.stop();
      this.draw();
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    // ⚠️ Uzoq tanaffusdan keyin (sekin kadr) zarralar «sakramasin».
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.clock += dt;

    const t0 = performance.now();
    this.draw();
    const cost = performance.now() - t0;
    this.frameCost = this.frameCost * 0.92 + cost * 0.08;
    /*
     * ⚠️ MOSLASHUVCHAN SIFAT. Kuchsiz kompyuterda (hokimlikdagi eski
     * ofis kompyuteri) kadr 10 ms dan oshsa, zarra dumlari qisqaradi —
     * animatsiya to'xtamaydi, faqat soddalashadi. Tez qurilmada qaytadi.
     */
    if (this.frameCost > 10 && this.quality > 0) {
      this.quality -= 1;
      this.frameCost = 6;
    } else if (this.frameCost < 3 && this.quality < 2) {
      this.quality += 1;
      this.frameCost = 6;
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  // ───────────────────────── Chizish ─────────────────────────

  private draw(): void {
    const map = this._map;
    const ctx = this.ctx;
    if (!map || !ctx || !this.canvas) return;

    const origin = map.containerPointToLayerPoint([0, 0]);
    const ox = origin.x;
    const oy = origin.y;
    const dpr = this.dpr;
    const { detail, dark } = this.data;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Qatlam koordinatalarida chizamiz: siljish va piksel zichligi bitta matritsada.
    ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);

    const viewMinX = ox - 40;
    const viewMinY = oy - 40;
    const viewMaxX = ox + this.width + 40;
    const viewMaxY = oy + this.height + 40;

    /*
     * 1) KANALLAR — uch qatlam, xarita marshrut chiziqlari uslubida:
     *    • yumshoq rangli nur (keng, juda shaffof) — «energiya» hissi;
     *    • G'ILOF (yorug'da oq, qorong'ida to'q) — kanal har qanday fon
     *      ustida aniq ajralib turadi;
     *    • to'yingan rangli YADRO.
     * ⚠️ G'ilofsiz rangli chiziq yo'l va daryolar ustida «erib» ketardi.
     */
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const district = detail === 'district';
    const casing = dark ? 'rgba(8,14,22,0.78)' : 'rgba(255,255,255,0.92)';
    for (const group of this.channels.values()) {
      ctx.strokeStyle = `rgba(${group.rgb},${dark ? 0.16 : 0.11})`;
      ctx.lineWidth = district ? 14 : 8;
      ctx.stroke(group.path);
    }
    for (const group of this.channels.values()) {
      ctx.strokeStyle = casing;
      ctx.lineWidth = district ? 5.2 : 3.2;
      ctx.stroke(group.path);
    }
    for (const group of this.channels.values()) {
      ctx.strokeStyle = `rgba(${group.rgb},${dark ? 0.85 : 0.78})`;
      ctx.lineWidth = district ? 2.2 : 1.3;
      ctx.stroke(group.path);
    }

    // 2) MARKAZ — yumshoq nur va «yutish» halqalari (kanallar shu yerga quyiladi).
    for (const hub of this.hubs) {
      if (
        hub.x < viewMinX ||
        hub.x > viewMaxX ||
        hub.y < viewMinY ||
        hub.y > viewMaxY
      )
        continue;
      const aura = hub.radius + (district ? 46 : 22);
      const breath =
        0.85 +
        0.15 * Math.sin((this.clock / HUB_PERIOD + hub.phase) * Math.PI * 2);
      const halo = ctx.createRadialGradient(
        hub.x,
        hub.y,
        hub.radius * 0.6,
        hub.x,
        hub.y,
        aura,
      );
      halo.addColorStop(
        0,
        `rgba(${hub.rgb},${((dark ? 0.34 : 0.26) * breath).toFixed(3)})`,
      );
      halo.addColorStop(1, `rgba(${hub.rgb},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, aura, 0, Math.PI * 2);
      ctx.fill();

      const r0 = hub.radius + 2;
      const r1 = hub.radius + (district ? 34 : 20);
      for (let k = 0; k < 2; k += 1) {
        const q = (this.clock / HUB_PERIOD + hub.phase + k * 0.5) % 1;
        const eased = 1 - (1 - q) * (1 - q) * (1 - q);
        const radius = r0 + (r1 - r0) * eased;
        const alpha = (dark ? 0.5 : 0.38) * Math.pow(1 - q, 1.7);
        ctx.strokeStyle = `rgba(${hub.rgb},${alpha.toFixed(3)})`;
        ctx.lineWidth = 2.4 * (1 - q) + 0.6;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3) ZARRALAR — kotyoldan markazga oqadigan nur.
    const visible = this.flows.filter(
      (flow) =>
        flow.maxX >= viewMinX &&
        flow.minX <= viewMaxX &&
        flow.maxY >= viewMinY &&
        flow.minY <= viewMaxY,
    );
    const n = visible.length;
    const q = this.quality;
    const comets = district ? (q > 0 ? 3 : 2) : n <= 160 ? 2 : 1;
    const tail = district
      ? [4, 7, 10][q]
      : n <= 300
        ? [2, 4, 6][q]
        : n <= 1000
          ? [1, 2, 3][q]
          : [1, 1, 2][q];
    const gap = district ? 2.6 : 2;
    const glowSize = district ? 22 : 12;
    const coreSize = district ? 8 : 5;
    const p = this.scratch;

    for (const flow of visible) {
      for (let k = 0; k < comets; k += 1) {
        const prog =
          ((((this.clock * flow.spec.speed) / flow.span +
            flow.phase +
            k / comets) %
            1) +
            1) %
          1;
        const s = flow.start + prog * flow.span;
        // Kirishda paydo bo'ladi, markazga yetganda so'nadi.
        const fadeIn = Math.min(1, prog / 0.08);
        const fadeOut = Math.min(1, (1 - prog) / 0.14);
        const fade = Math.min(fadeIn, fadeOut);
        if (fade <= 0.01) continue;

        for (let j = tail; j >= 1; j -= 1) {
          const sj = s - j * gap;
          if (sj < flow.start) continue;
          const f = 1 - j / (tail + 1);
          pointAt(flow.lut, sj, p);
          const size = glowSize * (0.45 + 0.55 * f);
          ctx.globalAlpha = fade * f * f * 0.8;
          ctx.drawImage(flow.glow, p.x - size / 2, p.y - size / 2, size, size);
        }

        pointAt(flow.lut, s, p);
        ctx.globalAlpha = fade;
        ctx.drawImage(
          flow.glow,
          p.x - glowSize / 2,
          p.y - glowSize / 2,
          glowSize,
          glowSize,
        );
        ctx.drawImage(
          flow.core,
          p.x - coreSize / 2,
          p.y - coreSize / 2,
          coreSize,
          coreSize,
        );
      }
    }
    ctx.globalAlpha = 1;

    // 4) VILOYAT ko'rinishida kotyol tugunlari — zarralar USTIDA, oq hoshiya bilan.
    if (!district) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = dark ? 'rgba(10,18,28,0.9)' : 'rgba(255,255,255,0.95)';
      for (const group of this.channels.values()) {
        ctx.fillStyle = `rgb(${group.rgb})`;
        ctx.fill(group.nodes);
        ctx.stroke(group.nodes);
      }
    }
  }
}
