/**
 * Dashboard Evo — shared store + API client.
 *
 * All Evo dashboard panels read/write through here. Single source of truth
 * for filters (so the graph, leaderboard, segments and explorer all stay in sync).
 */
export type Granularity = 'day' | 'week' | 'month' | 'year';
export type WinnerVerdict = 'insufficient_sample' | 'not_significant' | 'candidate_winner' | 'confirmed_winner' | 'baseline';
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
    sortBy: 'conversionRate' | 'paidVisitors' | 'exposures' | 'engagementRate' | 'revenueUsd';
    attributionWindowDays: number;
    paidOriginCountry: string;
    paidDestinationCountry: string;
    segmentBy: '' | 'originCountry' | 'destinationCountry' | 'pagePath';
}
export declare const DEFAULT_FILTERS: EvoFilters;
export declare const evoFilters: import("svelte/store").Writable<EvoFilters>;
export declare const evoComponents: import("svelte/store").Writable<EvoComponentDoc[]>;
export declare const evoTimeline: import("svelte/store").Writable<TimelinePoint[]>;
export declare const evoLeaderboard: import("svelte/store").Writable<LeaderboardResult | null>;
export declare const evoSegmented: import("svelte/store").Writable<SegmentedLeaderboard | null>;
export declare const evoNodeDrilldown: import("svelte/store").Writable<NodeDrillDown | null>;
export declare const evoExplorerQuery: import("svelte/store").Writable<string>;
export declare const evoExplorerResult: import("svelte/store").Writable<{
    query: string;
    parsed: {
        filters: EvoFilters;
        explanation: string[];
        unresolved: string[];
    };
    rows: AttributionRow[];
    totals: LeaderboardResult["totals"];
    segmented?: SegmentedLeaderboard;
} | null>;
export declare const evoLoading: import("svelte/store").Writable<boolean>;
export declare const evoError: import("svelte/store").Writable<string | null>;
export declare function fetchComponents(): Promise<void>;
export declare function fetchTimeline(): Promise<void>;
export declare function fetchLeaderboard(): Promise<void>;
export declare function fetchSegments(): Promise<void>;
export declare function fetchNode(componentKey: string, versionKey: string, commitHash: string, bucket: string): Promise<void>;
export declare function runExplorer(query: string, useLLM?: boolean): Promise<void>;
export declare const timelineByVariant: import("svelte/store").Readable<Map<string, TimelinePoint[]>>;
export declare function fmtPct(n: number): string;
export declare function fmtSignedPct(n: number): string;
export declare function fmtUsd(n: number): string;
export declare function winnerBadgeLabel(v: WinnerVerdict): string;
export declare function winnerBadgeColor(v: WinnerVerdict): string;
