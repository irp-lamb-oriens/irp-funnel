// src/lib/naturalCronParser.ts (or your preferred location)

// --- Helper Maps (Internal) ---
const DAY_MAP_REV: { [key: string]: number } = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const MONTH_MAP_REV: { [key: string]: number } = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

// --- Types for Result ---
export interface CronParseResult {
  success: boolean;
  cron?: string;
  error?: string;
}

// --- Main Conversion Function (Exported) ---
export function parseNaturalLanguageToCron(inputStr: string): CronParseResult {
  // Allow empty input without error
  if (!inputStr?.trim()) {
    return { success: true, cron: "" }; // Successfully parsed "nothing" to "nothing"
  }

  // Basic check if it looks like a cron string already - treat as invalid for *conversion*
  if (
    /^(\*|(\d+|\d+-\d+|\*\/\d+))(,\s*(\d+|\d+-\d+|\*\/\d+))*\s/.test(
      inputStr
    ) &&
    inputStr.split(/\s+/).length >= 5
  ) {
    return {
      success: false,
      error: "Input looks like a cron string, please use natural language.",
    };
  }

  const lowerInput = inputStr.toLowerCase().trim();
  let parts = ["*", "*", "*", "*", "*"]; // min, hour, dom, month, dow
  let foundTime = false;
  let foundDow = false;
  let foundDom = false;
  let foundMonth = false;

  try {
    // --- Time Parsing (Minute/Hour) ---
    let match = lowerInput.match(/midnight/);
    if (match) {
      parts[0] = "0";
      parts[1] = "0";
      foundTime = true;
    }

    match = lowerInput.match(/noon/);
    if (match) {
      parts[0] = "0";
      parts[1] = "12";
      foundTime = true;
    }

    match = lowerInput.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (match && !foundTime) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const ampm = match[3];
      if (
        isNaN(hour) ||
        hour < 0 ||
        hour > 23 ||
        isNaN(minute) ||
        minute < 0 ||
        minute > 59
      ) {
        throw new Error(`Invalid time format ${match[0]}`);
      }
      if (ampm === "pm" && hour < 12) hour += 12;
      else if (ampm === "am" && hour === 12) hour = 0; // Midnight case
      if (hour === 24) hour = 0; // Handle 12:xx PM correctly becoming hour 12, not 24
      parts[0] = minute.toString();
      parts[1] = hour.toString();
      foundTime = true;
    }

    match = lowerInput.match(/(?:at|@)\s*(\d{1,2})\s*(am|pm|o'clock)?/);
    if (match && !foundTime) {
      let hour = parseInt(match[1], 10);
      const modifier = match[2];
      // Initial validation for 1-12 range if AM/PM/o'clock used, or 0-23 if not
      if (modifier && (hour < 1 || hour > 12))
        throw new Error(`Invalid hour ${match[1]} for AM/PM`);
      if (!modifier && (hour < 0 || hour > 23))
        throw new Error(`Invalid hour ${match[1]}`);
      // Convert to 24-hour format
      if (modifier === "pm" && hour < 12) hour += 12; // 1 PM to 11 PM
      else if (modifier === "am" && hour === 12) hour = 0; // 12 AM is 0 hour
      // Note: 12 PM (noon) remains 12. If modifier is o'clock, assume 24hr if > 12? (Current logic assumes 1-12 is AM unless PM specified)
      parts[0] = "0";
      parts[1] = hour.toString();
      foundTime = true;
    }

    match = lowerInput.match(/every\s+(\d+)\s+minutes?/);
    if (match) {
      const minStep = parseInt(match[1], 10);
      if (isNaN(minStep) || minStep < 1 || minStep > 59)
        throw new Error(`Invalid minute step ${match[1]}`);
      parts[0] = `*/${minStep}`;
      if (!foundTime && parts[1] === "*") parts[1] = "*"; // Keep hour wildcard if not set
      foundTime = true;
    } else if (lowerInput.includes("every minute")) {
      parts[0] = "*";
      if (!foundTime && parts[1] === "*") parts[1] = "*";
      foundTime = true;
    }

    match = lowerInput.match(/every\s+(\d+)\s+hours?/);
    if (match) {
      const hourStep = parseInt(match[1], 10);
      if (isNaN(hourStep) || hourStep < 1 || hourStep > 23)
        throw new Error(`Invalid hour step ${match[1]}`);
      parts[1] = `*/${hourStep}`;
      if (parts[0] === "*") parts[0] = "0"; // If every X hours, default to minute 0
      foundTime = true;
    } else if (lowerInput.includes("every hour")) {
      parts[1] = "*";
      if (parts[0] === "*") parts[0] = "0"; // If every hour, default to minute 0
      foundTime = true;
    }

    // Default minute to 0 if an hour was specified but not minutes/steps
    if (
      foundTime &&
      parts[0] === "*" &&
      parts[1] !== "*" &&
      !parts[1].startsWith("*/") &&
      !lowerInput.includes("every minute") &&
      !lowerInput.match(/:\d{2}/)
    ) {
      parts[0] = "0";
    }

    // --- Day of Week (DOW) Parsing ---
    match = lowerInput.match(/every\s+(weekday|weekend)/);
    if (match) {
      parts[4] = match[1] === "weekday" ? "1-5" : "0,6";
      foundDow = true;
    }

    const daysFound: number[] = [];
    for (const dayName in DAY_MAP_REV) {
      const regex = new RegExp(`\\b${dayName}\\b`);
      if (regex.test(lowerInput)) {
        const dayNum = DAY_MAP_REV[dayName];
        if (!daysFound.includes(dayNum)) daysFound.push(dayNum);
      }
    }
    if (daysFound.length > 0) {
      parts[4] = daysFound.sort().join(",");
      foundDow = true;
    } else if (lowerInput.includes("every day")) {
      // No specific DOW needed if "every day" and no days like "Monday" found
      foundDow = true; // Signal that a day specifier was found
    }

    // --- Day of Month (DOM) Parsing ---
    // Regex to find "1st", "2nd", "15th", etc., optionally followed by "of the month" or similar
    match = lowerInput.match(
      /(?:on|every)\s+(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+day)?(?:\s+of(?:\s+the)?\s+month)?(?!\s*(?:am|pm|:|minute|hour|o'clock))/
    );
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31)
        throw new Error(`Invalid day of month ${match[1]}`);
      // Avoid setting DOM if a DOW was already explicitly set (e.g., "Monday the 15th" - prefer Monday)
      if (!foundDow) {
        parts[2] = dayNum.toString();
        foundDom = true;
      } else {
        // Log or handle conflict? For now, prioritize DOW if both detected
        console.warn(
          "Both Day of Week and Day of Month detected. Prioritizing Day of Week."
        );
      }
    }

    // --- Month Parsing ---
    const monthsFound: number[] = [];
    for (const monthName in MONTH_MAP_REV) {
      const regex = new RegExp(`\\b${monthName}\\b`);
      if (regex.test(lowerInput)) {
        const monthNum = MONTH_MAP_REV[monthName];
        if (!monthsFound.includes(monthNum)) monthsFound.push(monthNum);
      }
    }
    if (monthsFound.length > 0) {
      parts[3] = monthsFound.sort((a, b) => a - b).join(",");
      foundMonth = true;
    } else if (lowerInput.includes("every month")) {
      // No month constraint
    }

    // --- Conflict Resolution & Defaults ---
    if (foundDom && foundDow) {
      // If user specified both day of month and day of week, cron standard is AND, which is rarely intended.
      // Typically, one should override the other. Common convention: DOW overrides DOM.
      parts[2] = "*"; // Clear DOM constraint if DOW is set
      console.warn(
        "Both Day of Month and Day of Week specified. Using Day of Week constraint only."
      );
    }
    // If only DOM is specified, ensure DOW is wildcard
    if (foundDom && !foundDow) {
      parts[4] = "*";
    }
    // If only DOW is specified, ensure DOM is wildcard
    if (foundDow && !foundDom) {
      parts[2] = "*";
    }

    // --- Final Validation & Output ---
    if (!foundTime && !foundDow && !foundDom && !foundMonth) {
      if (lowerInput === "every minute")
        return { success: true, cron: "* * * * *" }; // Handle edge case
      // Return failure object instead of throwing
      return { success: false, error: "Could not understand the schedule format." };
    }

    // If time wasn't specified, but day/month was, default to midnight? Common expectation.
    if (!foundTime && (foundDow || foundDom || foundMonth)) {
      parts[0] = "0";
      parts[1] = "0";
      console.warn(
        "Date/Day specified without time. Defaulting to midnight (00:00)."
      );
    }

    return { success: true, cron: parts.join(" ") };
  } catch (e: any) {
    console.error("Cron parsing error:", e); // Log the full error for debugging
    return {
      success: false,
      error: e.message || "Could not understand the schedule format.",
    };
  }
}

// --- Helper to check if a string looks like a valid Cron expression ---
export function isCronString(value: string | null | undefined): boolean {
  if (!value) return false;
  const str = value.trim();
  if (!str) return false; // Handle empty or whitespace-only strings

  const parts = str.split(/\s+/);
  // Standard cron has 5 parts. Quartz might have 6 or 7 (seconds, year).
  // Let's allow 5 or 6 for flexibility, but treat 7 as potentially invalid for this parser.
  if (parts.length < 5 || parts.length > 6) return false;

  // Basic validation: Check if parts contain allowed characters (*, -, /, ,, digits, L, W, #, ?)
  // This is a loose check; full validation is complex.
  // Added L, W, #, ? which are common in some cron variants (like Quartz) but might not be parsed correctly by cronToSentence.
  const cronPattern = /^[0-9*\/,L W#?-]+$/i; // Case-insensitive for L, W
  return parts.every((part) => cronPattern.test(part));
}
