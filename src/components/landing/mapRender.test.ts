import { describe, expect, it } from 'vitest';
import { camera, leg, landing, mx, my, type Stop } from './mapRender.ts';

const stops: Stop[] = [
  { lon: -99.13, lat: 19.43, width: 16, at: { lon: -99.17, lat: 19.43 } },
  { lon: -84.85, lat: 10.0, width: 5.2, at: { lon: -84.17, lat: 10.0 } },
  { lon: -80.9, lat: 8.75, width: 6.2, at: { lon: -79.52, lat: 8.98 } }
];
const overview: Stop = { lon: -45, lat: 24, width: 118 };

describe('offices map flights', () => {
  it('lands each flight exactly on the office, not the framing centre', () => {
    for (let k = 0; k < stops.length - 1; k++) {
      const [x, y] = leg(landing(stops[k]), landing(stops[k + 1])).at(1);
      expect(x).toBeCloseTo(mx(stops[k + 1].at!.lon), 9);
      expect(y).toBeCloseTo(my(stops[k + 1].at!.lat), 9);
    }
  });

  it('still frames each stop on its own centre when the plane has landed', () => {
    stops.forEach((s, i) => {
      const c = camera(i, stops, overview);
      expect(c.cx).toBeCloseTo(mx(s.lon), 9);
      expect(c.cy).toBeCloseTo(my(s.lat), 9);
    });
  });

  it('moves the camera continuously through a flight', () => {
    let prev = camera(0, stops, overview);
    for (let i = 1; i <= 400; i++) {
      const c = camera((i / 400) * (stops.length - 1), stops, overview);
      expect(Math.abs(c.cx - prev.cx)).toBeLessThan(0.01);
      expect(Math.abs(c.cy - prev.cy)).toBeLessThan(0.01);
      prev = c;
    }
  });
});
