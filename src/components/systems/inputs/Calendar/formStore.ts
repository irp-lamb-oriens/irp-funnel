import { writable } from "svelte/store";

export type FormState = {
  scheduling: string[];
};

// Define a store for the form state
export const formState = writable<FormState>({
  scheduling: [],
});

// Update the form state on input change
export function updateField(
  value: string[],
  field: "scheduling"
) {
  // Update form state
  formState.update((state) => {
    return { ...state, [field]: value };
  });
}
