import type { SvelteComponent } from "svelte";

export type TextType =
  | "paragraph"
  | "sub-italic"
  | "sub-highlight-italic"
  | "highlight"
  | "title"
  | "title-highlight"
  | "title-sub-italic"
  | "title-sub-highlight-italic"
  | "subtitle"
  | "subtitle-highlight"
  | "subtitle-sub-italic"
  | "subtitle-sub-highlight-italic";

export type TextNode = {
  text: string;
  type: TextType;
};

export type Block = {
  header: boolean;
  type?: TextType;
  text?: string;
  segments?: TextNode[];
};

export type Store = { [index: string]: any };

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export type Language = {
  code: string;
  name: string;
};

export interface Card {
  id: string;
  title: string;
  description?: string;
  selected: boolean;
}

export type ComponentSteps = [(store: Store) => boolean, SvelteComponent][];

export interface Article {
  title: string;
  content: string;
  link: string;
  community: string;
  lead: string;
}

export interface NewsSource {
  type: string;
  url: string;
  linkSelector: string;
  country: string;
  community: string;
  lead: string;
  id: string;
  subscribersIDs?: string[];
  scheduleTime: string;
  personality: string;
  email?: EmailConfig;
  openAiApiKey?: string;
  emailMaskSender?: string; // New optional field
  appPassword?: string; // New optional field
  active?: boolean;
}

export interface EmailAuth {
  user: string;
  pass: string;
}

export interface EmailConfig {
  host: string;
  auth: EmailAuth;
  senderName: string;
  senderEmail: string;
  newsletterSubject: string;
  newsletterTitle: string;
}

export interface Config {
  newsSources?: NewsSource[];
  openAiApiKey?: string;
  email: EmailConfig;
  configuratorId?: string;
  brandColor?: string;
  emailSignature?: string;
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

export interface MailConfigPack {
  host: string;
  auth: {
    user: string;
    pass?: string;
  };
  senderName: string;
  senderEmail: string;
  newsletterSubject: string;
  transporter: any;
}
export interface SystemConfig {
  email: EmailConfig;
  openAiApiKey: string;
}

export type Populator<T extends object> = (
  propertyPath: string,
  value: any
) => T;
