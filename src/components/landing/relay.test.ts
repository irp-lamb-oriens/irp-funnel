import { describe, expect, it } from 'vitest';
import { travellerX, formWeights, cameraX, reachedStation, barrierLift, STATIONS, WORLD_W } from './relay.ts';

describe('journey line', () => {
  it('starts at the old house and ends at the new home', () => {
    expect(travellerX(0)).toBe(STATIONS[0].x);
    expect(travellerX(1)).toBe(STATIONS[STATIONS.length - 1].x);
    expect(reachedStation(travellerX(1))).toBe(STATIONS.length - 1);
  });

  it('moves forward only and without jumps while scrubbing', () => {
    let prev = travellerX(0);
    for (let i = 1; i <= 2000; i++) {
      const x = travellerX(i / 2000);
      expect(x).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(x - prev).toBeLessThan(12);
      prev = x;
    }
  });

  it('always shows the traveller in some form, cross-fading between forms', () => {
    for (let x = 0; x <= WORLD_W; x += 5) {
      const w = formWeights(x);
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.99);
      expect(sum).toBeLessThan(1.01);
    }
    expect(formWeights(1200).truck).toBe(1);
    expect(formWeights(2100).ship).toBe(1);
  });

  it('keeps the camera inside the world', () => {
    expect(cameraX(0, 1200)).toBe(0);
    expect(cameraX(WORLD_W, 1200)).toBe(WORLD_W - 1200);
  });

  it('opens the customs barrier only around customs', () => {
    expect(barrierLift(1500)).toBe(0);
    expect(barrierLift(STATIONS[4].x)).toBe(1);
    expect(barrierLift(3600)).toBe(0);
  });
});
