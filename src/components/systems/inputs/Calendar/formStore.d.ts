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
};
export declare const formState: import("svelte/store").Writable<FormState>;
export declare function updateField(value: string | string[] | Vehicle[] | {
    role: string;
    content: string;
}[], field: keyof FormState): void;
