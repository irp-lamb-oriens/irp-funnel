import { get, writable } from "svelte/store";
import type { Populator, Store } from "./types.ts";
import type { Socket } from "socket.io-client";

export const latestMessage = writable<string>("");

export const socket = writable<Socket | null>(null);
export const isScrollingDown = writable<boolean>(false); // Add state for scroll direction

const store = writable<Store>({
  keysToSave: ["name", "email", "budget", "countryFrom", "countryTo", "stepsIndex", "age", "sex", "reasonsForMoving"], // Added new keys
  stepsIndex: 0, // Renamed from stepsIndex
  name: "",
  email: "",
  budget: null, // Use null or 0 for initial budget? null might be better to indicate not set.
  age: null, // Added age
  sex: "", // Added sex (string, e.g., 'Male', 'Female')
  countryFrom: null, // Use null for initial country codes
  countryTo: null,
  reasonsForMoving: [""], // Added reasons (array of strings)
  appLanguage: "en", // Added for global language setting
  apiURL: () => window.location.origin.startsWith('http://localhost') ? "http://localhost:8000" : "https://irp-funnel.onrender.com",
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
