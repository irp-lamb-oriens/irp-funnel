/**
 * extractClientFields.ts
 *
 * Client-side Gemini extraction agent.
 * Sends a spoken transcript → Gemini structured JSON output.
 * Returns a ClientFieldExtraction matching the /api/dashboard/clients/manual schema.
 */

export interface ClientFieldExtraction {
  name:               string;
  surname:            string;
  email:              string;
  phone:              string;
  originCountry:      string;
  originCity:         string;
  destinationCountry: string;
  destinationCity:    string;
  /** Normalized to one of the budget dropdown values, or empty */
  budget:             string;
  /** Normalized to one of the size dropdown values, or empty */
  size:               string;
  immigrationStatus:  string;
  /** Clean prose summary of anything not captured in the fields above */
  notes:              string;
  /** Any extra structured facts: { moveDate, pets, vehicles, propertyType, ... } */
  customFields:       Record<string, string>;
}

const EXTRACTION_PROMPT = `
You are a relocation intake specialist. A staff member dictated the following voice note about a new client.
Extract the relevant data and return ONLY a valid JSON object (no markdown, no commentary).

JSON schema (all fields are strings, omit or leave empty if not mentioned):
{
  "name":               "First name",
  "surname":            "Last name",
  "email":              "email address (lowercase, exactly as said)",
  "phone":              "phone number with country code if mentioned",
  "originCountry":      "country they are moving FROM",
  "originCity":         "city/state they are moving from",
  "destinationCountry": "country they want to move TO",
  "destinationCity":    "city they want to move to",
  "budget":             "one of: Under $5k | $5-10k | $10-15k | $15-20k | $20-30k | Over $30k — pick closest, or empty",
  "size":               "one of: LCL / Partial | 20ft container | 40ft container — pick closest, or empty",
  "immigrationStatus":  "e.g. Pensionado visa, no visa, citizen, etc.",
  "notes":              "anything important not captured above — clean prose",
  "customFields":       {
    "moveDate":      "target move date if mentioned",
    "vehicles":      "vehicles to ship if mentioned",
    "pets":          "pets if mentioned",
    "propertyFrom":  "property type at origin (house, apartment, …)",
    "propertyTo":    "property type at destination",
    "referredBy":    "referral source if mentioned"
  }
}

Remove any customFields keys whose value is empty or null.
Voice note follows:
`.trim();

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name:               { type: 'string' },
    surname:            { type: 'string' },
    email:              { type: 'string' },
    phone:              { type: 'string' },
    originCountry:      { type: 'string' },
    originCity:         { type: 'string' },
    destinationCountry: { type: 'string' },
    destinationCity:    { type: 'string' },
    budget:             { type: 'string' },
    size:               { type: 'string' },
    immigrationStatus:  { type: 'string' },
    notes:              { type: 'string' },
    customFields: {
      type: 'object',
      properties: {
        moveDate:     { type: 'string' },
        vehicles:     { type: 'string' },
        pets:         { type: 'string' },
        propertyFrom: { type: 'string' },
        propertyTo:   { type: 'string' },
        referredBy:   { type: 'string' },
      },
    },
  },
};

function forgivingParse(raw: string): Record<string, unknown> {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/m, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last resort: return empty
    return {};
  }
}

export async function extractClientFields(
  transcript: string,
  geminiUrl: string,
): Promise<ClientFieldExtraction> {
  const empty: ClientFieldExtraction = {
    name: '', surname: '', email: '', phone: '',
    originCountry: '', originCity: '',
    destinationCountry: '', destinationCity: '',
    budget: '', size: '', immigrationStatus: '', notes: '',
    customFields: {},
  };

  if (!transcript.trim()) return empty;

  const body = {
    contents: [{
      parts: [{ text: `${EXTRACTION_PROMPT}\n\n"${transcript}"` }],
    }],
    generationConfig: {
      temperature:      0.1,
      responseMimeType: 'application/json',
      responseSchema:   RESPONSE_SCHEMA,
    },
  };

  let res: Response;
  try {
    res = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (e: any) {
    throw new Error(`Network error: ${e.message}`);
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);

  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = forgivingParse(raw) as Partial<ClientFieldExtraction>;

  // Sanitize + merge with empty defaults
  const cf: Record<string, string> = {};
  if (parsed.customFields && typeof parsed.customFields === 'object') {
    for (const [k, v] of Object.entries(parsed.customFields)) {
      if (v && typeof v === 'string' && v.trim()) cf[k] = v.trim();
    }
  }

  return {
    name:               String(parsed.name               || '').trim(),
    surname:            String(parsed.surname             || '').trim(),
    email:              String(parsed.email               || '').trim().toLowerCase(),
    phone:              String(parsed.phone               || '').trim(),
    originCountry:      String(parsed.originCountry       || '').trim(),
    originCity:         String(parsed.originCity          || '').trim(),
    destinationCountry: String(parsed.destinationCountry  || '').trim(),
    destinationCity:    String(parsed.destinationCity     || '').trim(),
    budget:             String(parsed.budget              || '').trim(),
    size:               String(parsed.size                || '').trim(),
    immigrationStatus:  String(parsed.immigrationStatus   || '').trim(),
    notes:              String(parsed.notes               || '').trim(),
    customFields:       cf,
  };
}
