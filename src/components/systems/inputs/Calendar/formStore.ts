import { writable } from "svelte/store";

export type FormState = {
  name: string;
  email: string;
  destinationCountry: string;
  originCountry: string;
  phone: string;
  referredBy: string;
  budget: string;
  propertyTypeFrom: string;
  propertyTypeTo: string;
  size: string;
  immigrationStatus: string;
  scheduling: string[];
};

// Define a store for the form state
export const formState = writable<FormState>({
  name: "",
  email: "",
  destinationCountry: "",
  originCountry: "",
  phone: "",
  referredBy: "",
  budget: "",
  propertyTypeFrom: "",
  propertyTypeTo: "",
  size: "",
  immigrationStatus: "",
  scheduling: [],
});

// Update the form state on input change
export function updateField(
  value: string | string[],
  field: keyof FormState
) {
  // Update form state
  formState.update((state) => {
    return { ...state, [field]: value };
  });
}
