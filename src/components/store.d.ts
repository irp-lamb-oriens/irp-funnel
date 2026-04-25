import type { Store } from "./types.ts";
import type { Socket } from "socket.io-client";
export declare const latestMessage: import("svelte/store").Writable<string>;
export declare const socket: import("svelte/store").Writable<Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap> | null>;
export declare const isScrollingDown: import("svelte/store").Writable<boolean>;
export interface Funnel {
    country: string;
    videoSrc: string;
    copy: string;
    thankYouSrc: string;
    brand?: string;
    eyebrow?: string;
    headline?: string;
    subhead?: string;
    ratingValue?: string;
    ratingCount?: string;
}
export declare const funnels: import("svelte/store").Writable<Record<string, Record<string, Funnel>>>;
export declare const funnelsLoaded: import("svelte/store").Writable<boolean>;
export declare const currentFunnelId: import("svelte/store").Writable<string | null>;
export declare const currentFunnelVersion: import("svelte/store").Writable<string | null>;
export declare const currentFunnel: import("svelte/store").Writable<Funnel | null>;
declare const store: import("svelte/store").Writable<Store>;
export declare const emptyStoreSnapshot: any;
export default store;
export declare function incrementStepsIndex(): void;
export declare function saveToStore(objectValue: {
    [index: string]: any;
}): void;
export declare function populateToStore(propertyPath: string, value: any): void;
export declare function getFromStore(propertyPath: string): any;
export declare function setStorageFromKeysToSave(): void;
export declare function saveAllKeysToSaveInLocalStorage(): void;
