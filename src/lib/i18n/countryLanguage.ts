/**
 * src/lib/i18n/countryLanguage.ts
 * ────────────────────────────────────────────────────────────────────────────
 * A single one-way COUNTRY → LANGUAGE map, plus a helper that inverts it into a
 * LANGUAGE → COUNTRIES map on demand. We never hand-duplicate the data: the
 * reverse index is derived with `invertOneToMany()`.
 *
 * Used by the provider RFQ ("Sondeo") composer to recommend a language for a
 * given destination country. English is always the safe default.
 *
 * Country keys are ISO-3166 alpha-2 codes (uppercase). Language values are the
 * codes used by the RFQ pre-translated template set (see lib/rfq/sondeoTemplates).
 */

/** Language codes that have a hand-made RFQ template. English is the fallback. */
export const SUPPORTED_RFQ_LANGS = [
  'en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'zh', 'ja', 'ko', 'hi',
] as const;
export type SupportedRfqLang = (typeof SUPPORTED_RFQ_LANGS)[number];

export function isSupportedRfqLang(code: string): code is SupportedRfqLang {
  return (SUPPORTED_RFQ_LANGS as readonly string[]).includes(code);
}

/**
 * ONE-WAY source of truth: ISO-2 country code → primary language code.
 * Only the corridors IRP actually serves need to be exhaustive; anything not
 * listed simply falls back to English.
 */
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // ── Spanish ──────────────────────────────────────────────────────────────
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  MX: 'es', // Mexico
  ES: 'es', // Spain
  AR: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', CO: 'es', PE: 'es',
  CL: 'es', EC: 'es', BO: 'es', PY: 'es', UY: 'es', VE: 'es', DO: 'es',
  CU: 'es',
  // ── Portuguese ─────────────────────────────────────────────────────────────
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
  // ── French ─────────────────────────────────────────────────────────────────
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CD: 'fr',
  // ── German ─────────────────────────────────────────────────────────────────
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  // ── Italian ────────────────────────────────────────────────────────────────
  IT: 'it', SM: 'it', VA: 'it',
  // ── Russian ────────────────────────────────────────────────────────────────
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
  // ── Chinese ────────────────────────────────────────────────────────────────
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  // ── Japanese ───────────────────────────────────────────────────────────────
  JP: 'ja',
  // ── Korean ─────────────────────────────────────────────────────────────────
  KR: 'ko', KP: 'ko',
  // ── Hindi ──────────────────────────────────────────────────────────────────
  IN: 'hi',
  // ── English (explicit — everything else defaults to English too) ──────────
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en', ZA: 'en',
};

/**
 * Common country NAME → ISO-2 code, so callers can pass either the code
 * ("CR") or the human name ("Costa Rica") that consultations tend to store.
 * Lower-cased on lookup.
 */
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'costa rica': 'CR',
  'panama': 'PA', 'panamá': 'PA',
  'mexico': 'MX', 'méxico': 'MX',
  'spain': 'ES', 'españa': 'ES',
  'portugal': 'PT',
  'brazil': 'BR', 'brasil': 'BR',
  'france': 'FR', 'francia': 'FR',
  'germany': 'DE', 'alemania': 'DE',
  'italy': 'IT', 'italia': 'IT',
  'russia': 'RU', 'rusia': 'RU',
  'china': 'CN',
  'taiwan': 'TW', 'hong kong': 'HK', 'singapore': 'SG',
  'japan': 'JP', 'japón': 'JP',
  'south korea': 'KR', 'korea': 'KR',
  'india': 'IN',
  'united states': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB',
  'canada': 'CA', 'canadá': 'CA',
  'australia': 'AU', 'new zealand': 'NZ', 'ireland': 'IE',
  'argentina': 'AR', 'colombia': 'CO', 'peru': 'PE', 'perú': 'PE',
  'chile': 'CL', 'ecuador': 'EC', 'guatemala': 'GT', 'honduras': 'HN',
  'el salvador': 'SV', 'nicaragua': 'NI', 'dominican republic': 'DO',
  'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT', 'netherlands': 'NL',
};

/**
 * Invert a one-to-one map into a one-to-many map, WITHOUT hand-duplicating the
 * data. e.g. { CR:'es', PA:'es' } → { es: ['CR','PA'] }.
 */
export function invertOneToMany<V extends string>(
  map: Record<string, V>,
): Record<V, string[]> {
  const out = {} as Record<V, string[]>;
  for (const [key, val] of Object.entries(map)) {
    (out[val] ||= []).push(key);
  }
  return out;
}

/** LANGUAGE → COUNTRIES, derived on demand from the one-way source of truth. */
export const LANGUAGE_TO_COUNTRIES: Record<string, string[]> =
  invertOneToMany(COUNTRY_TO_LANGUAGE);

/** Normalize a country code OR name into an ISO-2 code (uppercase) or ''. */
export function normalizeCountryCode(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_CODE[raw.toLowerCase()] ?? '';
}

/**
 * Recommend an RFQ language for a destination country (code or name).
 * Always returns a language that has a template; defaults to English.
 */
export function recommendedLanguageForCountry(
  input: string | null | undefined,
): SupportedRfqLang {
  const code = normalizeCountryCode(input);
  const lang = code ? COUNTRY_TO_LANGUAGE[code] : '';
  return lang && isSupportedRfqLang(lang) ? lang : 'en';
}
