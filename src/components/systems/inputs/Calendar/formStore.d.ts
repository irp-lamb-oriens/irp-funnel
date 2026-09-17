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
    chatHistory: {
        role: string;
        content: string;
    }[];
    /** Service category pre-filled by a service landing page (e.g. relocation_tour). */
    serviceCategory: string;
    /** Additive multi-select list (canonical selection from the slide). */
    serviceCategories: string[];
    partySize: string;
    occupancy: string;
    roomPreference: string;
    duration: string;
    route: string;
    travelers: Traveler[];
    nationality: string;
    residencyPathway: string;
    applicantCount: string;
    residencyTimeline: string;
};
export declare const formState: import("svelte/store").Writable<FormState>;
export declare function updateField(value: string | string[] | Vehicle[] | Traveler[] | {
    role: string;
    content: string;
}[], field: keyof FormState): void;
