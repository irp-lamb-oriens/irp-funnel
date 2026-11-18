/**
 * Globe camera for the guides page. Eases the globe's longitude and latitude
 * toward a target each frame (always the short way round), or turns it
 * slowly on its own while idle. One requestAnimationFrame loop per camera,
 * running only while it is moving. Reduced motion: jumps, never turns.
 */
const wrap = (d: number) => {
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

export function camera(
  onFrame: (lon: number, lat: number) => void,
  start: [number, number],
  { ease = 0.075, limit = 40 }: { ease?: number; limit?: number } = {}
) {
  let [lon, lat] = start;
  let tLon = lon;
  let tLat = lat;
  let drift = 0;
  let raf = 0;
  let dead = false;
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tick = () => {
    raf = 0;
    if (dead) return;
    if (drift && !reduce) tLon += drift;
    const dl = wrap(tLon - lon);
    const dp = tLat - lat;
    if (reduce) {
      lon = tLon;
      lat = tLat;
    } else {
      lon += dl * ease;
      lat += dp * ease;
    }
    onFrame(lon, lat);
    if ((drift && !reduce) || Math.abs(dl) > 0.02 || Math.abs(dp) > 0.02) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf && !dead) raf = requestAnimationFrame(tick);
  };

  return {
    /** Turn to a point and hold there. */
    to(l: number, p: number) {
      drift = 0;
      tLon = lon + wrap(l - lon);
      tLat = Math.max(-limit, Math.min(limit, p));
      kick();
    },
    /** Turn slowly on its own, settling back toward a gentle tilt. */
    idle(speed = -0.05, tilt = 14) {
      drift = speed;
      tLat = tilt;
      kick();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
    }
  };
}
