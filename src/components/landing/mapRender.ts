/**
 * Offices map renderer, shared by the worker (officeMap.worker.ts) and the
 * main-thread fallback in OfficeMap.svelte.
 *
 * Real coastlines and borders (Natural Earth 1:50m via world-atlas, public
 * domain; cropped and simplified into static/landing/offices-map.json) in a
 * paper-atlas style, with a camera that flies from office to office.
 *
 * Coastlines and borders are built once as Path2D in Mercator units; a
 * frame only sets the canvas transform and fills/strokes those paths, so
 * there is no per-point work in JavaScript while scrolling.
 */

/**
 * A tour stop: where the camera frames (lon/lat/width) and, when different,
 * the office the plane actually lands on (`at`), e.g. the camera frames all
 * of Costa Rica but the flight ends at Alajuela.
 */
export type Stop = { lon: number; lat: number; width: number; at?: { lon: number; lat: number } };
/** The point a flight leaves from / lands on for a stop. */
export const landing = (s: Stop) => s.at ?? s;
export type Pin = { lon: number; lat: number; label: string; stop: number };
export type MapData = { land: number[][]; borders: number[][] };
export interface Frame {
  t: number;
  W: number;
  H: number;
  dpr: number;
}
export interface FrameOut {
  t: number;
  pins: { x: number; y: number; vis: boolean }[];
  plane: { x: number; y: number; a: number; vis: boolean };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;

const RAD = Math.PI / 180;
export const mx = (lon: number) => lon * RAD;
export const my = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-80, Math.min(80, lat)) * RAD) / 2));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Gentle ease: the plane eases out of each office and into the next. */
const glide = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

const LABELS: { text: string; lon: number; lat: number; sea?: boolean; min?: number; max?: number }[] = [
  { text: 'United States', lon: -98, lat: 38.5, max: 130 },
  { text: 'Mexico', lon: -103.5, lat: 25.5, max: 130 },
  { text: 'Cuba', lon: -79.4, lat: 22.4, max: 40 },
  { text: 'Guatemala', lon: -90.4, lat: 15.6, max: 22 },
  { text: 'Honduras', lon: -86.8, lat: 14.9, max: 22 },
  { text: 'Nicaragua', lon: -85.1, lat: 12.9, max: 22 },
  { text: 'Costa Rica', lon: -84.2, lat: 9.6, max: 30 },
  { text: 'Panamá', lon: -80.4, lat: 8.45, max: 30 },
  { text: 'Colombia', lon: -73.5, lat: 4.2, max: 70 },
  { text: 'Venezuela', lon: -66.5, lat: 7.4, max: 70 },
  { text: 'Spain', lon: -3.5, lat: 39.6, max: 70 },
  { text: 'Portugal', lon: -8.1, lat: 39.9, max: 30 },
  { text: 'France', lon: 2.4, lat: 46.6, max: 70 },
  { text: 'Morocco', lon: -6.3, lat: 31.8, max: 70 },
  { text: 'Atlantic Ocean', lon: -42, lat: 30, sea: true, min: 20 },
  { text: 'Pacific Ocean', lon: -103, lat: 9, sea: true, min: 16 },
  { text: 'Caribbean Sea', lon: -75.5, lat: 14.8, sea: true, min: 8, max: 60 },
  { text: 'Gulf of Mexico', lon: -90.5, lat: 25.3, sea: true, min: 8, max: 60 }
];

/**
 * A leg's flight path in Mercator units: a quadratic arc from a to b, bowed
 * towards the pole like a real route. `at(e)` is the position at 0..1 and
 * `dir(e)` the heading.
 */
export function leg(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const ax = mx(a.lon), ay = my(a.lat), bx = mx(b.lon), by = my(b.lat);
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-9;
  let nx = -dy / len, ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; } // bow north
  const lift = len * 0.22;
  const qx = (ax + bx) / 2 + nx * lift, qy = (ay + by) / 2 + ny * lift;
  const at = (e: number): [number, number] => [
    (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * qx + e * e * bx,
    (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * qy + e * e * by
  ];
  const dir = (e: number): [number, number] => [2 * (1 - e) * (qx - ax) + 2 * e * (bx - qx), 2 * (1 - e) * (qy - ay) + 2 * e * (by - qy)];
  return { at, dir, len };
}

/**
 * Camera for tour position t. Between two offices the camera rides with the
 * plane along the arc, and the view widens with the length of the leg and
 * narrows again on arrival, so scrolling is one continuous flight.
 */
export function camera(tt: number, stops: Stop[], overview: Stop) {
  const n = stops.length;
  if (!n) return { cx: mx(overview.lon), cy: my(overview.lat), w: overview.width, leg: -2, e: 0 };
  const clamped = Math.max(-1, Math.min(n - 1, tt));
  const i = Math.min(n - 2, Math.floor(clamped));
  const u = Math.max(0, Math.min(1, clamped - i));
  const e = glide(u);
  if (i < 0) {
    const a = overview, b = stops[0];
    const w = Math.exp(lerp(Math.log(a.width), Math.log(b.width), e));
    return { cx: lerp(mx(a.lon), mx(b.lon), e), cy: lerp(my(a.lat), my(b.lat), e), w, leg: -1, e };
  }
  const a = stops[i], b = stops[i + 1];
  const L = leg(landing(a), landing(b));
  const [px, py] = L.at(e);
  // The camera rides with the plane, offset by each stop's framing (stop
  // centre minus landing point), blended across the flight, so it settles on
  // the stop's frame while the plane lands exactly on the office.
  const off = (st: Stop): [number, number] => [mx(st.lon) - mx(landing(st).lon), my(st.lat) - my(landing(st).lat)];
  const [oax, oay] = off(a), [obx, oby] = off(b);
  const cx = px + lerp(oax, obx, e), cy = py + lerp(oay, oby, e);
  const distDeg = L.len / RAD;
  const mid = Math.max(a.width, b.width, distDeg * 0.75);
  const base = Math.exp(lerp(Math.log(a.width), Math.log(b.width), e));
  const w = base + (mid - base) * Math.sin(Math.PI * e);
  return { cx, cy, w, leg: i, e };
}

export class MapRenderer {
  private land: Path2D | null = null;
  private borders: Path2D | null = null;
  constructor(
    private canvas: Surface,
    private stops: Stop[],
    private pins: Pin[],
    private overview: Stop
  ) {}

  setData(d: MapData) {
    const land = new Path2D();
    for (const r of d.land) {
      land.moveTo(mx(r[0]), my(r[1]));
      for (let i = 2; i < r.length; i += 2) land.lineTo(mx(r[i]), my(r[i + 1]));
      land.closePath();
    }
    const borders = new Path2D();
    for (const l of d.borders) {
      borders.moveTo(mx(l[0]), my(l[1]));
      for (let i = 2; i < l.length; i += 2) borders.lineTo(mx(l[i]), my(l[i + 1]));
    }
    this.land = land;
    this.borders = borders;
  }

  render({ t, W, H, dpr }: Frame): FrameOut {
    const { canvas, stops, pins, overview } = this;
    const out: FrameOut = { t, pins: [], plane: { x: 0, y: 0, a: 0, vis: false } };
    if (!W || !H) return out;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const g = canvas.getContext('2d') as Ctx | null;
    if (!g) return out;

    const cam = camera(t, stops, overview);
    const s = W / (cam.w * RAD); // px per Mercator unit
    const X = (lon: number) => W / 2 + (mx(lon) - cam.cx) * s;
    const Y = (lat: number) => H / 2 - (my(lat) - cam.cy) * s;
    const lonL = (cam.cx - W / 2 / s) / RAD, lonR = (cam.cx + W / 2 / s) / RAD;
    const yT = cam.cy + H / 2 / s, yB = cam.cy - H / 2 / s;
    const latT = (2 * Math.atan(Math.exp(yT)) - Math.PI / 2) / RAD, latB = (2 * Math.atan(Math.exp(yB)) - Math.PI / 2) / RAD;
    const screen = () => g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const merc = (dy = 0) => g.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (W / 2 - cam.cx * s), dpr * (H / 2 + cam.cy * s + dy));

    // Sea: cool and deep at the bottom, lighter towards the top.
    screen();
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#dcefef');
    sea.addColorStop(1, '#bcdcdf');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);

    // Graticule
    g.strokeStyle = 'rgba(14,47,54,0.07)';
    g.lineWidth = 1;
    const step = cam.w > 60 ? 20 : cam.w > 20 ? 10 : 5;
    g.beginPath();
    for (let lon = Math.ceil(lonL / step) * step; lon <= lonR; lon += step) { g.moveTo(X(lon), 0); g.lineTo(X(lon), H); }
    for (let lat = Math.ceil(latB / step) * step; lat <= latT; lat += step) { g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); }
    g.stroke();

    if (this.land && this.borders) {
      const land = this.land;
      merc();
      g.lineJoin = 'round';
      // Shallow water: one soft light band along every coast.
      g.strokeStyle = 'rgba(255,255,255,0.34)';
      g.lineWidth = 11 / s;
      g.stroke(land);
      // Paper-cut lift: a soft offset shadow, then the land itself.
      merc(2.5);
      g.fillStyle = 'rgba(14,47,54,0.15)';
      g.fill(land);
      merc();
      const paper = g.createLinearGradient(cam.cx - W / 2 / s, cam.cy + H / 2 / s, cam.cx + W / 2 / s, cam.cy - H / 2 / s);
      paper.addColorStop(0, '#fbf8f1');
      paper.addColorStop(1, '#ece4d2');
      g.fillStyle = paper;
      g.fill(land);
      g.strokeStyle = 'rgba(14,47,54,0.42)';
      g.lineWidth = 0.9 / s;
      g.stroke(land);
      g.setLineDash([3 / s, 3 / s]);
      g.strokeStyle = 'rgba(14,47,54,0.3)';
      g.lineWidth = 0.8 / s;
      g.stroke(this.borders);
      g.setLineDash([]);
    }

    // Labels
    screen();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const lb of LABELS) {
      if ((lb.max && cam.w > lb.max) || (lb.min && cam.w < lb.min)) continue;
      const x = X(lb.lon), y = Y(lb.lat);
      if (x < -60 || x > W + 60 || y < -20 || y > H + 20) continue;
      const size = Math.max(9, Math.min(13, 9 + 60 / cam.w));
      g.font = lb.sea ? `italic 400 ${size}px Georgia, 'Times New Roman', serif` : `600 ${size - 1}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
      g.fillStyle = lb.sea ? 'rgba(14,90,100,0.55)' : 'rgba(14,47,54,0.5)';
      g.fillText(lb.sea ? lb.text : lb.text.toUpperCase().split('').join(' '), x, y);
    }

    // Routes: legs already flown stay as a faint trail; the current leg is
    // solid up to the plane and dashed ahead of it.
    const toScreen = (m: [number, number]): [number, number] => [W / 2 + (m[0] - cam.cx) * s, H / 2 - (m[1] - cam.cy) * s];
    const drawLeg = (k: number, from: number, to: number, style: string, dash: number[], width: number) => {
      const L = leg(landing(stops[k]), landing(stops[k + 1]));
      const N = 48;
      g.setLineDash(dash);
      g.lineCap = 'round';
      g.strokeStyle = style;
      g.lineWidth = width;
      g.beginPath();
      for (let j = 0; j <= N; j++) {
        const [x, y] = toScreen(L.at(from + ((to - from) * j) / N));
        if (j) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      g.setLineDash([]);
    };
    const flown = cam.leg >= 0 ? cam.leg : -1;
    for (let k = 0; k < flown; k++) drawLeg(k, 0, 1, 'rgba(2,140,146,0.35)', [], 1.5);
    if (cam.leg >= 0) {
      const e = cam.e;
      if (e < 0.999) drawLeg(cam.leg, e, 1, 'rgba(2,140,146,0.45)', [4, 6], 1.5);
      if (e > 0.001) drawLeg(cam.leg, 0, e, 'rgba(2,140,146,0.95)', [], 2.2);
      if (e > 0.001 && e < 0.999) {
        const L = leg(landing(stops[cam.leg]), landing(stops[cam.leg + 1]));
        const [px, py] = toScreen(L.at(e));
        const [dx, dy] = L.dir(e);
        out.plane = { x: px, y: py, a: Math.atan2(-dy, dx), vis: true };
      }
    }

    out.pins = pins.map((p) => {
      const x = X(p.lon), y = Y(p.lat);
      return { x, y, vis: x > -20 && x < W + 20 && y > -20 && y < H + 20 };
    });
    return out;
  }
}
