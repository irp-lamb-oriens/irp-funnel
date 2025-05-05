// Copied from ai-newsletter-translated/types.ts to resolve import issues

// Minimal EmailConfig for NewsSource reference
export interface EmailConfig {
  host: string;
  // Add other fields if needed by components using NewsSource directly
}

export interface NewsSource {
  type: string;
  url: string;
  linkSelector: string;
  country: string;
  community: string;
  lead: string;
  id: string;
  active?: boolean; // Ensure active property is here
  subscribersIDs?: string[];
  scheduleTime: string;
  personality: string;
  email?: EmailConfig;
  openAiApiKey?: string;
  includeImages?: boolean; // Optional flag to include images in the newsletter
}

export interface NewsletterUser {
  email: string;
  name: string;
  bio: string;
  language: string; // ISO 639-1 language code
  countryOfResidence: string; // Alpha-2 country code
  newsSourcesConfigTuples: {
    newsSourceId: string;
    configId: string;
  }[];
}

// Add other types from the original file if they are directly imported elsewhere in this project
