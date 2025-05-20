import { get, writable } from "svelte/store";
import type { Populator, Store } from "./types.ts";
import type { Socket } from "socket.io-client";
import { derived } from "svelte/store";

export const latestMessage = writable<string>("");

export const socket = writable<Socket | null>(null);
export const isScrollingDown = writable<boolean>(false); // Add state for scroll direction

// Define Funnel types based on API structure
export interface Funnel {
  country: string; // from API object's title
  videoSrc: string; // from API version's cloudflare_video_src
  copy: string; // from API version's copy
}

interface ApiFunnelVersion {
  cloudflare_video_src: string;
  copy: string;
}

interface ApiFunnelObject {
  slug: string;
  title: string;
  type: string; // "funnels"
  metadata: {
    versions: ApiFunnelVersion[];
  };
}

interface ApiResponse {
  objects: ApiFunnelObject[];
  total: number;
}

export const funnels = writable<Record<string, Record<string, Funnel>>>({});
export const funnelsLoaded = writable<boolean>(false); // Store to track if funnels are loaded

// Function to load funnels from the API
async function loadFunnelsFromAPI() {
  const apiUrl = "https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22type%22:%22funnels%22%7D&limit=10&skip=0&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type";
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ApiResponse = await response.json();

    const transformedFunnels: Record<string, Record<string, Funnel>> = {};
    data.objects.forEach((apiObject) => {
      const funnelVersions: Record<string, Funnel> = {};
      apiObject.metadata.versions.forEach((version, index) => {
        funnelVersions[index.toString()] = { // Use index as string for the version key
          country: apiObject.title,
          videoSrc: version.cloudflare_video_src,
          copy: version.copy,
        };
      });
      transformedFunnels[apiObject.slug] = funnelVersions;
    });
    funnels.set(transformedFunnels);
    funnelsLoaded.set(true); // Indicate that funnels have been loaded
    console.log("Funnels loaded from API:", get(funnels));
  } catch (error) {
    console.error("Failed to load funnels from API:", error);
    // Optionally, set funnels to a default state or handle error appropriately
    funnels.set({}); // Set to empty if fetch fails
    funnelsLoaded.set(true); // Still set to true to allow dependent logic to proceed, even if with empty data
  }
}

// Load funnels when the store is initialized
loadFunnelsFromAPI();

import { browser } from '$app/environment';

// Initialize currentFunnelId and currentFunnelVersion from localStorage if in browser
const initialFunnelId = browser ? localStorage.getItem('currentFunnelId') : null;
export const currentFunnelId = writable<string | null>(initialFunnelId);

const initialFunnelVersion = browser ? localStorage.getItem('currentFunnelVersion') : null;
export const currentFunnelVersion = writable<string | null>(initialFunnelVersion);

if (browser) {
  currentFunnelId.subscribe(value => {
    if (value !== null) {
      localStorage.setItem('currentFunnelId', value);
    } else {
      localStorage.removeItem('currentFunnelId');
    }
  });

  currentFunnelVersion.subscribe(value => {
    if (value !== null) {
      localStorage.setItem('currentFunnelVersion', value);
    } else {
      localStorage.removeItem('currentFunnelVersion');
    }
  });
}

// Derived store for the currently selected funnel object
export const currentFunnel = derived(
  [funnels, currentFunnelId, currentFunnelVersion],
  ([$funnels, $currentFunnelId, $currentFunnelVersion]) =>
    $currentFunnelId && $currentFunnelVersion && $funnels[$currentFunnelId]?.[$currentFunnelVersion]
      ? $funnels[$currentFunnelId][$currentFunnelVersion]
      : null
);

const store = writable<Store>({
  keysToSave: ["name", "email", "age", "sex", "budget", "reasonsForMoving"],
  name: "",
  email: "",
  age: null,
  sex: "",
  budget: null,
  reasonsForMoving: [],
  appLanguage: "en",
  apiURL: () => window.location.origin.startsWith('http://localhost') ? "http://localhost:8000" : "https://irp-funnel-server.onrender.com",
});

export const emptyStoreSnapshot = JSON.parse(JSON.stringify(get(store)));

export default store;

// Function to increment the step index
export function incrementStepsIndex() {
  console.log("increment", get(store))
  store.update(s => ({ ...s, stepsIndex: s.stepsIndex + 1 }));
}

export function saveToStore(objectValue: { [index: string]: any }) {
  store.set({
    ...get(store),
    ...objectValue,
  });
}

export function populateToStore(propertyPath: string, value: any) {
  store.set({
    ...createObjectPopulator(get(store))(propertyPath, value),
  });
}

export function getFromStore(propertyPath: string) {
  return createObjectGetter(get(store))(propertyPath);
}

function createObjectPopulator<T extends object>(obj: T): Populator<T> {
  return function (propertyPath: string, value: any): T {
    const keys = propertyPath.split(".");

    // Recursive helper that builds a new nested object for the given chain.
    const updateNested = (current: any, keys: string[]): any => {
      // Take the first key from the chain
      const [first, ...rest] = keys;

      // If there are no more keys, assign the value to this key.
      if (rest.length === 0) {
        return {
          ...current,
          [first]: value,
        };
      }
      // Otherwise, recursively update the nested object.
      return {
        ...current,
        [first]: updateNested(
          current && current[first] ? current[first] : {},
          rest
        ),
      };
    };

    // Return a new object with the updated chain.
    return updateNested(obj, keys);
  };
}

function createObjectGetter<T extends object>(
  obj: T
): (propertyPath: string) => any {
  return function (propertyPath: string): any {
    // Split the property path into individual keys.
    const keys = propertyPath.split(".");

    // Recursive helper function to traverse the object.
    const getNested = (current: any, keys: string[]): any => {
      const [first, ...rest] = keys;

      // If the current object is nullish or the key doesn't exist, return undefined.
      if (current == null || !(first in current)) {
        return undefined;
      }

      // If no further keys remain, return the value at the key.
      if (rest.length === 0) {
        return current[first];
      }

      // Otherwise, recursively traverse deeper.
      return getNested(current[first], rest);
    };

    return getNested(obj, keys);
  };
}

export function setStorageFromKeysToSave() {
  for (const key of get(store).keysToSave) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "");

      if (!value) continue;

      populateToStore(key, value);
    } catch {
      continue;
    }
  }
}

export function saveAllKeysToSaveInLocalStorage() {
  store.subscribe((currentStore: Store) => {
    for (const key of currentStore.keysToSave) {
      localStorage.setItem(key, JSON.stringify(getFromStore(key)));
    }
  });
}
