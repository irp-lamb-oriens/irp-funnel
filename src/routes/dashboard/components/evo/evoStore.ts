/**
 * Dashboard Evo — shared store + API client.
 *
 * All Evo dashboard panels read/write through here. Single source of truth
 * for filters (so the graph, leaderboard, segments and explorer all stay in sync).
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { authToken } from '../../store.ts';

// ─── Types mirror the server-side definitions ─────────────────────────────
export type Granularity = 'day' | 'week' | 'month' | 'year';

export type WinnerVerdict =
	| 'insufficient_sample'
	| 'not_significant'
	| 'candidate_winner'
	| 'confirmed_winner'
	| 'baseline';

export interface EvoVariantDef {
	key: string;
	label?: string;
	introducedIn?: string;
	retiredIn?: string | null;
	hypothesis?: string;
}

export interface EvoComponentDoc {
	componentKey: string;
	variants: EvoVariantDef[];
	updatedAt: string;
}

export interface TimelinePoint {
	bucket: string;
	componentKey: string;
	versionKey: string;
	commitHash: string;
	commitMessage: string;
	exposures: number;
	interactions: number;
	uniqueVisitors: number;
}

export interface PaidAttributionDetail {
	email: string;
	name: string;
	paidAt: string;
	budget: string;
	originCountry?: string;
	destinationCountry?: string;
	stage?: string;
}

export interface VariantFunnel {
	exposed: number;
	interacted: number;
	ctaClicked: number;
	emailSubmitted: number;
	paid: number;
	custom: Record<string, number>;
}

export interface AttributionRow {
	componentKey: string;
	versionKey: string;
	commitHash: string;
	commitMessage: string;
	exposures: number;
	interactions: number;
	uniqueVisitors: number;
	paidVisitors: number;
	paidEmails: PaidAttributionDetail[];
	conversionRate: number;
	engagementRate: number;
	liftVsControl: number;
	// Phase 2 fields
	revenueUsd: number;
	funnel: VariantFunnel;
	pValue: number;
	zScore: number;
	winner: WinnerVerdict;
	isBaseline: boolean;
}

export interface LeaderboardResult {
	rows: AttributionRow[];
	totals: {
		exposures: number;
		interactions: number;
		uniqueVisitors: number;
		paidVisitors: number;
		revenueUsd: number;
	};
}

export interface SegmentedLeaderboard {
	segmentBy: 'originCountry' | 'destinationCountry' | 'pagePath';
	segments: Array<{
		segment: string;
		rows: AttributionRow[];
		totals: LeaderboardResult['totals'];
	}>;
}

export interface NodeDrillDown {
	row: AttributionRow | null;
	visitors: Array<{
		visitorId: string;
		email: string | null;
		firstSeen: string;
		interactions: number;
	}>;
	events: number;
	bucket: string;
}

export interface EvoFilters {
	granularity: Granularity;
	componentKey: string;
	versionKey: string;
	commitHash: string;
	from: string;
	to: string;
	minSampleSize: number;
	sortBy:
		| 'conversionRate'
		| 'paidVisitors'
		| 'exposures'
		| 'engagementRate'
		| 'revenueUsd';
	attributionWindowDays: number;
	paidOriginCountry: string;
	paidDestinationCountry: string;
	segmentBy: '' | 'originCountry' | 'destinationCountry' | 'pagePath';
}

export const DEFAULT_FILTERS: EvoFilters = {
	granularity: 'month',
	componentKey: '',
	versionKey: '',
	commitHash: '',
	from: '',
	to: '',
	minSampleSize: 0,
	sortBy: 'conversionRate',
	attributionWindowDays: 30,
	paidOriginCountry: '',
	paidDestinationCountry: '',
	segmentBy: ''
};

// ─── Stores ────────────────────────────────────────────────────────────────
export const evoFilters = writable<EvoFilters>({ ...DEFAULT_FILTERS });
export const evoComponents = writable<EvoComponentDoc[]>([]);
export const evoTimeline = writable<TimelinePoint[]>([]);
export const evoLeaderboard = writable<LeaderboardResult | null>(null);
export const evoSegmented = writable<SegmentedLeaderboard | null>(null);
export const evoNodeDrilldown = writable<NodeDrillDown | null>(null);
export const evoExplorerQuery = writable<string>('');
export const evoExplorerResult = writable<
	| null
	| {
			query: string;
			parsed: { filters: EvoFilters; explanation: string[]; unresolved: string[] };
			rows: AttributionRow[];
			totals: LeaderboardResult['totals'];
			segmented?: SegmentedLeaderboard;
	  }
>(null);
export const evoLoading = writable<boolean>(false);
export const evoError = writable<string | null>(null);

// ─── API helpers ──────────────────────────────────────────────────────────
function getApiUrl(): string {
	if (browser && window.location.origin.startsWith('http://localhost')) return 'http://localhost:8000';
	return 'https://irp-funnel-server.onrender.com';
}

function toQuery(f: Partial<EvoFilters>): string {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(f)) {
		if (v === undefined || v === null || v === '') continue;
		if (typeof v === 'number' && v === 0 && k !== 'minSampleSize') continue;
		params.set(k, String(v));
	}
	const s = params.toString();
	return s ? `?${s}` : '';
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const token = get(authToken);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...((init.headers as Record<string, string>) || {})
	};
	if (token) headers['x-dashboard-token'] = token;
	const res = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
	return data as T;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────
export async function fetchComponents(): Promise<void> {
	try {
		const data = await api<{ components: EvoComponentDoc[] }>('/api/evo/components');
		evoComponents.set(data.components || []);
	} catch (e: any) {
		evoError.set(e.message);
	}
}

export async function fetchTimeline(): Promise<void> {
	evoLoading.set(true);
	try {
		const f = get(evoFilters);
		const data = await api<{ points: TimelinePoint[] }>(`/api/evo/timeline${toQuery(f)}`);
		evoTimeline.set(data.points || []);
	} catch (e: any) {
		evoError.set(e.message);
	} finally {
		evoLoading.set(false);
	}
}

export async function fetchLeaderboard(): Promise<void> {
	evoLoading.set(true);
	try {
		const f = get(evoFilters);
		const data = await api<LeaderboardResult>(`/api/evo/leaderboard${toQuery(f)}`);
		evoLeaderboard.set(data);
	} catch (e: any) {
		evoError.set(e.message);
	} finally {
		evoLoading.set(false);
	}
}

export async function fetchSegments(): Promise<void> {
	evoLoading.set(true);
	try {
		const f = get(evoFilters);
		if (!f.segmentBy) {
			evoSegmented.set(null);
			return;
		}
		const data = await api<SegmentedLeaderboard>(`/api/evo/segments${toQuery(f)}`);
		evoSegmented.set(data);
	} catch (e: any) {
		evoError.set(e.message);
	} finally {
		evoLoading.set(false);
	}
}

export async function fetchNode(
	componentKey: string,
	versionKey: string,
	commitHash: string,
	bucket: string
): Promise<void> {
	evoLoading.set(true);
	try {
		const f = get(evoFilters);
		const q = toQuery({ ...f, componentKey, versionKey, commitHash });
		const sep = q ? '&' : '?';
		const data = await api<NodeDrillDown>(
			`/api/evo/node${q}${sep}bucket=${encodeURIComponent(bucket)}`
		);
		evoNodeDrilldown.set(data);
	} catch (e: any) {
		evoError.set(e.message);
	} finally {
		evoLoading.set(false);
	}
}

export async function runExplorer(query: string, useLLM = true): Promise<void> {
	evoLoading.set(true);
	try {
		const data = await api<{
			query: string;
			parsed: { filters: EvoFilters; explanation: string[]; unresolved: string[] };
			rows: AttributionRow[];
			totals: LeaderboardResult['totals'];
			segmented?: SegmentedLeaderboard;
		}>(`/api/evo/explore`, {
			method: 'POST',
			body: JSON.stringify({ query, useLLM })
		});
		evoExplorerResult.set(data);
		if (data?.parsed?.filters) {
			evoFilters.update((f) => ({ ...f, ...data.parsed.filters }));
		}
		if (data?.segmented) evoSegmented.set(data.segmented);
	} catch (e: any) {
		evoError.set(e.message);
	} finally {
		evoLoading.set(false);
	}
}

// ─── Derived: timeline grouped by component → version → buckets ────────────
export const timelineByVariant = derived(evoTimeline, ($pts) => {
	const grouped = new Map<string, TimelinePoint[]>();
	for (const p of $pts) {
		const key = `${p.componentKey}|${p.versionKey}`;
		const arr = grouped.get(key) || [];
		arr.push(p);
		grouped.set(key, arr);
	}
	for (const arr of grouped.values()) arr.sort((a, b) => a.bucket.localeCompare(b.bucket));
	return grouped;
});

// ─── UI helpers ────────────────────────────────────────────────────────────
export function fmtPct(n: number): string {
	if (!isFinite(n)) return '—';
	return `${(n * 100).toFixed(1)}%`;
}

export function fmtSignedPct(n: number): string {
	if (!isFinite(n)) return '—';
	const v = n * 100;
	const s = v >= 0 ? '+' : '';
	return `${s}${v.toFixed(1)}%`;
}

export function fmtUsd(n: number): string {
	if (!isFinite(n) || n <= 0) return '$0';
	if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
	return `$${Math.round(n).toLocaleString()}`;
}

export function winnerBadgeLabel(v: WinnerVerdict): string {
	switch (v) {
		case 'confirmed_winner':
			return '🏆 Confirmed winner (p<.01)';
		case 'candidate_winner':
			return '✨ Candidate winner (p<.05)';
		case 'baseline':
			return '⚪ Baseline';
		case 'insufficient_sample':
			return '⏳ Not enough samples yet';
		default:
			return '— Not significant';
	}
}

export function winnerBadgeColor(v: WinnerVerdict): string {
	switch (v) {
		case 'confirmed_winner':
			return '#10b981';
		case 'candidate_winner':
			return '#fbbf24';
		case 'baseline':
			return '#94a3b8';
		case 'insufficient_sample':
			return '#64748b';
		default:
			return '#64748b';
	}
}
