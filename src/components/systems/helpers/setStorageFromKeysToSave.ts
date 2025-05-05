import { get } from "svelte/store";
import store, { populateToStore } from "../../store.ts";

export default function setStorageFromKeysToSave() {
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
