<script lang="ts">
  /**
   * Dotted globe on a canvas (orthographic projection, no map library).
   * Land dots come from static/landing/land-dots.json (lon, lat pairs at
   * about 1.6 degrees, generated once from a land mask). Markers glow;
   * arcs draw great-circle routes with a 0..1 progress each. Redraws only
   * when its inputs change and only while on screen.
   */
  import { onMount } from 'svelte';

  export let lon = -80;
  export let lat = 10;
  export let scale = 1;
  /** 'globe' (orthographic) or 'flat' (equirectangular, centred on `lon`). */
  export let mode: 'globe' | 'flat' = 'globe';
  export let markers: { lon: number; lat: number; on?: boolean; label?: string }[] = [];
  export let arcs: { from: [number, number]; to: [number, number]; t: number }[] = [];
  export let dot = 'rgba(255,255,255,0.55)';
  export let accent = '#02b5bb';

  let canvas: HTMLCanvasElement;
  let dots: Float32Array | null = null;
  let visible = true;
  let raf = 0;
  const RAD = Math.PI / 180;

  onMount(() => {
    fetch('/landing/land-dots.json')
      .then((r) => r.json())
      .then((a: number[]) => {
        dots = new Float32Array(a);
        queue();
      })
      .catch(() => {});
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) queue();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => queue());
    ro.observe(canvas);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  $: lon, lat, scale, mode, markers, arcs, queue();

  function queue() {
    if (typeof window === 'undefined' || raf || !visible) return;
    raf = requestAnimationFrame(draw);
  }

  function draw() {
    raf = 0;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (mode === 'globe') drawGlobe(g, w, h);
    else drawFlat(g, w, h);
  }

  function project(l: number, p: number, cx: number, cy: number, R: number) {
    const l0 = lon * RAD, p0 = lat * RAD;
    const L = l * RAD, P = p * RAD;
    const cosc = Math.sin(p0) * Math.sin(P) + Math.cos(p0) * Math.cos(P) * Math.cos(L - l0);
    const x = cx + R * Math.cos(P) * Math.sin(L - l0);
    const y = cy - R * (Math.cos(p0) * Math.sin(P) - Math.sin(p0) * Math.cos(P) * Math.cos(L - l0));
    return { x, y, z: cosc };
  }

  function drawGlobe(g: CanvasRenderingContext2D, w: number, h: number) {
    const R = (Math.min(w, h) / 2) * 0.92 * scale;
    const cx = w / 2, cy = h / 2;
    // sphere
    const grad = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    grad.addColorStop(0, 'rgba(2,181,187,0.20)');
    grad.addColorStop(1, 'rgba(2,181,187,0.03)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(2,181,187,0.35)'; g.lineWidth = 1; g.stroke();
    if (dots) {
      const size = Math.max(1, R / 260);
      g.fillStyle = dot;
      for (let i = 0; i < dots.length; i += 2) {
        const q = project(dots[i], dots[i + 1], cx, cy, R);
        if (q.z <= 0) continue;
        g.globalAlpha = 0.25 + 0.75 * q.z;
        g.fillRect(q.x - size / 2, q.y - size / 2, size * 1.6, size * 1.6);
      }
      g.globalAlpha = 1;
    }
    for (const a of arcs) drawArc(g, a, (l, p) => project(l, p, cx, cy, R), R * 0.18);
    for (const m of markers) {
      const q = project(m.lon, m.lat, cx, cy, R);
      if (q.z <= 0.05) continue;
      marker(g, q.x, q.y, m.on, m.label);
    }
  }

  function flat(l: number, p: number, w: number, h: number) {
    let d = l - lon;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    const sx = w / 360, sy = h / 160;
    const s = Math.min(sx, sy) * scale;
    return { x: w / 2 + d * s, y: h / 2 - (p - 8) * s, z: 1 };
  }

  function drawFlat(g: CanvasRenderingContext2D, w: number, h: number) {
    if (dots) {
      const size = Math.max(1.2, w / 700);
      g.fillStyle = dot;
      for (let i = 0; i < dots.length; i += 2) {
        const q = flat(dots[i], dots[i + 1], w, h);
        g.fillRect(q.x, q.y, size, size);
      }
    }
    for (const a of arcs) drawArc(g, a, (l, p) => flat(l, p, w, h), Math.min(w, h) * 0.18, true);
    for (const m of markers) {
      const q = flat(m.lon, m.lat, w, h);
      marker(g, q.x, q.y, m.on, m.label);
    }
  }

  function drawArc(g: CanvasRenderingContext2D, a: { from: [number, number]; to: [number, number]; t: number }, proj: (l: number, p: number) => { x: number; y: number; z: number }, lift: number, flatMode = false) {
    if (a.t <= 0) return;
    const STEPS = 64;
    // interpolate along the great circle (flat mode: along the shortest longitude)
    let l1 = a.from[0], l2 = a.to[0];
    if (flatMode) {
      let d = l2 - l1;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      l2 = l1 + d;
    }
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    let started = false;
    let last = { x: 0, y: 0 };
    // Shorter routes get a lower arc.
    const span = Math.hypot(l2 - l1, a.to[1] - a.from[1]);
    const h = lift * Math.min(1, 0.25 + span / 90);
    const wrapGap = g.canvas.clientWidth / 2;
    const n = Math.max(1, Math.round(STEPS * a.t));
    for (let k = 0; k <= n; k++) {
      const s = k / STEPS;
      const l = l1 + (l2 - l1) * s;
      const p = a.from[1] + (a.to[1] - a.from[1]) * s;
      const q = proj(l, p);
      if (!flatMode && q.z <= 0) { started = false; continue; }
      const y = q.y - Math.sin(Math.PI * s) * h;
      if (started && flatMode && Math.abs(q.x - last.x) > wrapGap) started = false;
      if (!started) { g.moveTo(q.x, y); started = true; } else g.lineTo(q.x, y);
      last = { x: q.x, y };
    }
    g.stroke();
    if (a.t < 1) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(last.x, last.y, 4, 0, Math.PI * 2); g.fill();
    }
  }

  function marker(g: CanvasRenderingContext2D, x: number, y: number, on = false, label?: string) {
    g.fillStyle = on ? accent : 'rgba(255,255,255,0.85)';
    if (on) {
      g.globalAlpha = 0.25;
      g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.beginPath(); g.arc(x, y, on ? 6 : 3.5, 0, Math.PI * 2); g.fill();
    if (label && on) {
      g.font = '600 12px "Helvetica Neue", Arial, sans-serif';
      g.fillStyle = '#fff';
      g.fillText(label, x + 12, y - 10);
    }
  }
</script>

<canvas bind:this={canvas} class="globe" aria-hidden="true"></canvas>

<style>
  .globe { width: 100%; height: 100%; display: block; }
</style>
