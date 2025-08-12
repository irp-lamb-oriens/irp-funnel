import { get, writable } from "svelte/store";
import type { Populator, Store } from "./types.ts";
import type { Socket } from "socket.io-client";
import { derived } from "svelte/store";

export const latestMessage = writable<string>("");

export const socket = writable<Socket | null>(null);
export const isScrollingDown = writable<boolean>(false); // Add state for scroll direction

// Define Funnel types based on API structure
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

interface ApiFunnelVersion {
  cloudflare_video_src: string;
  copy: string;
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  rating_value?: string;
  rating_count?: string;
}

interface ApiFunnelObject {
  slug: string;
  title: string;
  type: string; // "funnels"
  metadata: {
    versions: ApiFunnelVersion[];
    thank_you_video: string;
    brand?: string;
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
        funnelVersions[index.toString()] = {
          country: apiObject.title,
          videoSrc: version.cloudflare_video_src,
          thankYouSrc: apiObject.metadata.thank_you_video,
          copy: version.copy,
          brand: apiObject.metadata.brand,
          eyebrow: version.eyebrow,
          headline: version.headline,
          subhead: version.subhead,
          ratingValue: version.rating_value,
          ratingCount: version.rating_count,
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

// Initialize currentFunnelId and currentFunnelVersion to null initially.
// They will be populated from localStorage on the client-side after page load.
export const currentFunnelId = writable<string | null>(null);
export const currentFunnelVersion = writable<string | null>(null);

if (browser) {
	// We defer this to run after the initial script evaluation.
	// This ensures that it runs on the client when localStorage is available.
	setTimeout(() => {
		const storedFunnelId = localStorage.getItem('currentFunnelId');
		if (storedFunnelId) {
			currentFunnelId.set(storedFunnelId);
		}

    console.log("storedFunnelId", storedFunnelId)
		const storedFunnelVersion = localStorage.getItem('currentFunnelVersion');
		if (storedFunnelVersion) {
			currentFunnelVersion.set(storedFunnelVersion);
		}

    console.log("storedFunnelVersion", storedFunnelVersion)
	}, 0);
}

export const currentFunnel = writable<Funnel | null>(null);

// Manually derive and update currentFunnel when its dependencies change.
const updateCurrentFunnel = () => {
	const $funnels = get(funnels);
	const $currentFunnelId = get(currentFunnelId);
	const $currentFunnelVersion = get(currentFunnelVersion);

  console.log("$funnels hey", $funnels)
  console.log("$currentFunnelId", $currentFunnelId)
  console.log("$currentFunnelVersion", $currentFunnelVersion)

	const newFunnel =
		$currentFunnelId && $currentFunnelVersion && $funnels[$currentFunnelId]?.[$currentFunnelVersion]
			? $funnels[$currentFunnelId][$currentFunnelVersion]
			: null;

	currentFunnel.set(newFunnel);

  console.log("currentFunnel", get(currentFunnel))
};

// Subscribe to changes in dependencies.
funnels.subscribe(updateCurrentFunnel);
currentFunnelId.subscribe(updateCurrentFunnel);
currentFunnelVersion.subscribe(updateCurrentFunnel);

const store = writable<Store>({
  keysToSave: ["name", "email", "age", "sex", "budget", "reasonsForMoving", "squareFeet", "propertyTypeFrom", "propertyTypeTo"],
  name: "",
  email: "",
  age: null,
  sex: "", // This was part of a previous task to deactivate, but leaving as is for now
  budget: null,
  squareFeet: undefined, // Or null, consistent with other nullable fields like age/budget
  propertyTypeFrom: undefined,
  propertyTypeTo: undefined,
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
