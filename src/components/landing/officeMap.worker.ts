/// <reference lib="webworker" />
/**
 * Draws the offices map off the main thread (OffscreenCanvas), so scrolling
 * and the rest of the page never wait on map rendering. The page posts the
 * camera position each frame; only the latest request is drawn, and the
 * screen positions of the pins and the plane are posted back for the HTML
 * overlays, so they always match the frame on screen.
 */
import { MapRenderer, type Frame, type MapData, type Pin, type Stop } from './mapRender.ts';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; stops: Stop[]; pins: Pin[]; overview: Stop; dataUrl: string }
  | ({ type: 'frame' } & Frame);

const scope = self as unknown as DedicatedWorkerGlobalScope;
let renderer: MapRenderer | null = null;
let pending: Frame | null = null;
let last: Frame | null = null;
let scheduled = false;

const nextFrame: (cb: () => void) => void =
  typeof scope.requestAnimationFrame === 'function'
    ? (cb) => scope.requestAnimationFrame(() => cb())
    : (cb) => setTimeout(cb, 0);

function pump() {
  scheduled = false;
  if (!renderer || !pending) return;
  const f = pending;
  pending = null;
  last = f;
  scope.postMessage(renderer.render(f));
}

function request(f: Frame) {
  pending = f;
  if (!scheduled) {
    scheduled = true;
    nextFrame(pump);
  }
}

scope.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === 'init') {
    renderer = new MapRenderer(m.canvas, m.stops, m.pins, m.overview);
    fetch(m.dataUrl)
      .then((r) => r.json())
      .then((d: MapData) => {
        renderer?.setData(d);
        // Redraw whatever is on screen now that the coastlines are in.
        const f = pending ?? last;
        if (f) request(f);
      })
      .catch(() => {});
  } else if (m.type === 'frame') {
    request({ t: m.t, W: m.W, H: m.H, dpr: m.dpr });
  }
};
