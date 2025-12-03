import { writable } from "svelte/store";

export type Vehicle = {
  year: string;
  make: string;
  model: string;
};

export type FormState = {
  name: string;
  surname: string;
  email: string;
  destinationCountry: string;
  destinationCity: string;
  originCountry: string;
  originCity: string;
  phone: string;
  referredBy: string;
  budget: string;
  propertyTypeFrom: string;
  propertyTypeTo: string;
  size: string;
  immigrationStatus: string;
  scheduling: string[];
  originZip: string;
  destinationZip: string;
  vehicles: Vehicle[];
};

// Define a store for the form state
export const formState = writable<FormState>({
  name: "",
  surname: "",
  email: "",
  destinationCountry: "",
  destinationCity: "",
  originCountry: "",
  originCity: "",
  phone: "",
  referredBy: "",
  budget: "",
  propertyTypeFrom: "",
  propertyTypeTo: "",
  size: "",
  immigrationStatus: "",
  scheduling: [],
  originZip: "",
  destinationZip: "",
  vehicles: [],
});

// Update the form state on input change
export function updateField(
  value: string | string[] | Vehicle[],
  field: keyof FormState
) {
  // Update form state
  formState.update((state) => {
    return { ...state, [field]: value };
  });
}
