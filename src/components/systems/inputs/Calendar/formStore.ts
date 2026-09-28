import { writable } from "svelte/store";

export type Vehicle = {
  year: string;
  make: string;
  model: string;
};

export type Traveler = {
  name: string;
  surname: string;
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
  youtubeVideo: string;
  budget: string;
  propertyTypeFrom: string;
  propertyTypeTo: string;
  size: string;
  immigrationStatus: string;
  scheduling: string[];
  originZip: string;
  destinationZip: string;
  vehicles: Vehicle[];
  notes: string | string[];
  chatHistory: { role: string; content: string }[];
  /** Service category pre-filled by a service landing page (e.g. relocation_tour). */
  serviceCategory: string;
  /** Additive multi-select list (canonical selection from the slide). */
  serviceCategories: string[];
  // ── Relocation-tour fields (additive) ────────────────────────────
  partySize: string;
  occupancy: string;
  roomPreference: string;
  duration: string;
  route: string;
  travelers: Traveler[];
  // ── Immigration-consultancy fields (additive) ────────────────────
  nationality: string;
  residencyPathway: string;
  applicantCount: string;
  residencyTimeline: string;
  // ── Legal-advice fields (additive) ───────────────────────────────
  legalMatter: string;
  legalCountry: string;
  legalUrgency: string;
  legalNotes: string;
  // ── Real-estate-assessment fields (additive) ─────────────────────
  realtyIntent: string;
  realtyBudget: string;
  realtyPropertyType: string;
  realtyTimeline: string;
  realtyNotes: string;
  // ── Intercultural-coaching fields (additive) ─────────────────────
  coachingFocus: string;
  coachingHouseholdSize: string;
  coachingDestination: string;
  coachingTimeline: string;
  coachingNotes: string;
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
  youtubeVideo: "",
  budget: "",
  propertyTypeFrom: "",
  propertyTypeTo: "",
  size: "",
  immigrationStatus: "",
  scheduling: [],
  originZip: "",
  destinationZip: "",
  vehicles: [],
  notes: "",
  chatHistory: [],
  serviceCategory: "",
  serviceCategories: [],
  partySize: "",
  occupancy: "",
  roomPreference: "",
  duration: "",
  route: "",
  travelers: [],
  nationality: "",
  residencyPathway: "",
  applicantCount: "",
  residencyTimeline: "",
  legalMatter: "",
  legalCountry: "",
  legalUrgency: "",
  legalNotes: "",
  realtyIntent: "",
  realtyBudget: "",
  realtyPropertyType: "",
  realtyTimeline: "",
  realtyNotes: "",
  coachingFocus: "",
  coachingHouseholdSize: "",
  coachingDestination: "",
  coachingTimeline: "",
  coachingNotes: "",
});

// Update the form state on input change
export function updateField(
  value:
    | string
    | string[]
    | Vehicle[]
    | Traveler[]
    | { role: string; content: string }[],
  field: keyof FormState
) {
  // Update form state
  formState.update((state) => {
    return { ...state, [field]: value };
  });
}