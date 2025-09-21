import { writable } from 'svelte/store';
import type { MetricsData } from '../../components/types.ts';

export const metricsData = writable<MetricsData | null>(null);
