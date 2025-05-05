const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_NAMES_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_NAMES_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Maps for easy lookup
const monthMap = new Map<string | number, number>(); // name/num -> 0-11
MONTH_NAMES.forEach((name, i) => monthMap.set(name.toUpperCase(), i));
MONTH_NAMES_SHORT.forEach((name, i) => monthMap.set(name, i));
for (let i = 1; i <= 12; i++) {
  monthMap.set(i, i - 1);
  monthMap.set(i.toString(), i - 1);
}

const dayMap = new Map<string | number, number>(); // name/num -> 0-6
DAY_NAMES.forEach((name, i) => dayMap.set(name.toUpperCase(), i));
DAY_NAMES_SHORT.forEach((name, i) => dayMap.set(name, i));
for (let i = 0; i <= 7; i++) {
  // Handle 0-7 for Sunday/Saturday
  dayMap.set(i, i % 7);
  dayMap.set(i.toString(), i % 7);
}

// --- Helper Functions ---

/**
 * Adds ordinal suffix to a number (e.g., 1 -> 1st, 2 -> 2nd).
 */
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Converts a list of numbers/names into a human-readable string.
 */
function listToSentence(
  list: (string | number)[],
  type: "AND" | "OR" = "AND"
): string {
  if (list.length === 0) return "";
  if (list.length === 1) return list[0].toString();
  if (list.length === 2) return `${list[0]} ${type.toLowerCase()} ${list[1]}`;

  const conjunction = type === "AND" ? ", and " : ", or ";
  return list.slice(0, -1).join(", ") + conjunction + list[list.length - 1];
}

function parseSegment(
  segment: string,
  min: number,
  max: number,
  names: string[] | null = null, // e.g., MONTH_NAMES or DAY_NAMES
  map: Map<string | number, number> | null = null // e.g., monthMap or dayMap
): { values: number[]; description: string; isRange: boolean; step?: number } {
  if (segment === "*" || segment === "?") {
    // Treat ? like *
    return {
      values: [],
      description: `every ${names ? "item" : "value"}`,
      isRange: false,
    };
  }

  // Step value (e.g., */2)
  if (segment.startsWith("*/")) {
    const step = parseInt(segment.substring(2), 10);
    if (!isNaN(step) && step > 0) {
      const values = [];
      for (let i = min; i <= max; i += step) {
        values.push(i);
      }
      return {
        values,
        description: `every ${getOrdinal(step)} value`,
        isRange: false,
        step,
      };
    } else {
      throw new Error(`Invalid step value in segment: ${segment}`);
    }
  }

  // Range (e.g., 1-5, MON-FRI)
  if (segment.includes("-")) {
    const [startStr, endStr] = segment.split("-");
    let start =
      names && map
        ? map.get(startStr.toUpperCase()) ?? parseInt(startStr, 10)
        : parseInt(startStr, 10);
    let end =
      names && map
        ? map.get(endStr.toUpperCase()) ?? parseInt(endStr, 10)
        : parseInt(endStr, 10);

    // Handle names case where map returns 0-based index but min/max are 1-based etc.
    if (names && map) {
      const startLookup = map.get(startStr.toUpperCase());
      const endLookup = map.get(endStr.toUpperCase());
      // Adjust if names used (map returns 0-based typically)
      if (startLookup !== undefined) start = startLookup;
      if (endLookup !== undefined) end = endLookup;
    }

    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      // Allow SUN-FRI (0-5) type ranges if dayMap handles 7->0
      if (!(names === DAY_NAMES && start === 0 && end < max)) {
        // Simple validation - more complex name ranges need careful checking
        if (isNaN(start) || isNaN(end) || start > end) {
          // Try harder for names
          const startIdx =
            names && map ? map.get(startStr.toUpperCase()) : undefined;
          const endIdx =
            names && map ? map.get(endStr.toUpperCase()) : undefined;
          if (
            startIdx === undefined ||
            endIdx === undefined ||
            startIdx > endIdx
          ) {
            throw new Error(`Invalid range segment: ${segment}`);
          }
          start = startIdx;
          end = endIdx;
        } else if (start < min || end > max) {
          // Allow day names like 7 (Sunday) to map correctly if using numbers
          if (!(names === DAY_NAMES && (start === 7 || end === 7))) {
            throw new Error(
              `Range values out of bounds [${min}-${max}] in segment: ${segment}`
            );
          }
          // Adjust 7 to 0 for Sunday if needed for internal logic consistency
          if (start === 7) start = 0;
          if (end === 7) end = 0; // This case (range ending in 7) is complex. Assume 7 means Sunday (0).
          if (start > end) {
            // e.g. FRI-TUE (5-2) - wrap around? Standard cron doesn't wrap range.
            throw new Error(`Invalid range sequence (start > end): ${segment}`);
          }
        }
      }
    }

    const values = [];
    for (let i = start; i <= end; i++) {
      values.push(i);
    }
    const startName = names ? names[start] : start.toString();
    const endName = names ? names[end] : end.toString();
    return {
      values,
      description: `${startName} through ${endName}`,
      isRange: true,
    };
  }

  // Single value (e.g., 5, TUE)
  let value =
    names && map
      ? map.get(segment.toUpperCase()) ?? parseInt(segment, 10)
      : parseInt(segment, 10);
  // Adjust if names used
  if (names && map) {
    const lookup = map.get(segment.toUpperCase());
    if (lookup !== undefined) value = lookup;
  }

  if (isNaN(value) || value < min || value > max) {
    // Allow day names like 7 (Sunday)
    if (!(names === DAY_NAMES && value === 7)) {
      throw new Error(`Invalid single value segment: ${segment}`);
    }
    value = 0; // Treat 7 as Sunday (0)
  }

  const name = names ? names[value] : value.toString();
  return { values: [value], description: name, isRange: false };
}

/**
 * Parses a full cron field (e.g., "1,5,10-15", "*", "MON-FRI")
 */
function parseField(
  field: string,
  min: number,
  max: number,
  names: string[] | null = null,
  map: Map<string | number, number> | null = null
): {
  description: string;
  isEvery: boolean;
  isSingleSpecific: boolean;
  isList: boolean;
  isRange: boolean;
  step?: number;
} {
  if (field === "*" || field === "?") {
    return {
      description: "",
      isEvery: true,
      isSingleSpecific: false,
      isList: false,
      isRange: false,
    };
  }

  if (field.startsWith("*/")) {
    const seg = parseSegment(field, min, max);
    const unit = names ? names[0].toLowerCase() : "unit"; // Use first name for unit type guess
    let pluralUnit = unit;
    // Basic pluralization
    if (!unit.endsWith("s")) pluralUnit += "s";
    if (unit === "day") pluralUnit = "days"; // handle day -> days

    return {
      description: `every ${seg.step} ${pluralUnit}`,
      isEvery: false,
      isSingleSpecific: false,
      isList: false,
      isRange: false,
      step: seg.step,
    };
  }

  const parts = field.split(",");
  const descriptions: string[] = [];
  let isRange = false;
  let step: number | undefined = undefined;

  for (const part of parts) {
    const parsed = parseSegment(part, min, max, names, map);
    descriptions.push(parsed.description);
    if (parsed.isRange) isRange = true;
    // Note: step applies to the whole field (e.g. */5), not individual parts of a list
  }

  const fullDescription = listToSentence(descriptions);
  const isSingleSpecific = parts.length === 1 && !isRange && step === undefined;

  return {
    description: fullDescription,
    isEvery: false,
    isSingleSpecific: isSingleSpecific,
    isList: parts.length > 1,
    isRange: isRange && parts.length === 1, // Only true range if it's the only element
    step: step,
  };
}

// --- Main Conversion Function ---

export default function cronToSentence(cronString: string): string {
  if (!cronString || typeof cronString !== "string") {
    throw new Error("Invalid cron string provided.");
  }

  const parts = cronString.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(
      `Invalid cron string format. Expected 5 or 6 parts, got ${parts.length}.`
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const year = parts.length === 6 ? parts[5] : "*";

  try {
    // --- Parse each field ---
    const minuteData = parseField(minute, 0, 59);
    const hourData = parseField(hour, 0, 23);
    const dayOfMonthData = parseField(dayOfMonth, 1, 31);
    const monthData = parseField(month, 1, 12, MONTH_NAMES, monthMap);
    const dayOfWeekData = parseField(dayOfWeek, 0, 6, DAY_NAMES, dayMap); // Internal logic uses 0-6
    const yearData = parseField(year, 1970, 2099); // Adjust range if needed

    // --- Build the sentence ---
    let sentence = "";

    // 1. Time Part (Minute and Hour)
    if (minuteData.isEvery && hourData.isEvery) {
      sentence = "Every minute";
    } else if (minuteData.isEvery && !hourData.isEvery) {
      if (hourData.step) {
        sentence = `Every minute past every ${getOrdinal(hourData.step)} hour`;
      } else {
        sentence = `Every minute past hour ${hourData.description}`;
      }
    } else if (!minuteData.isEvery && hourData.isEvery) {
      if (minuteData.step) {
        sentence = `Every ${getOrdinal(minuteData.step)} minute`; // Implies of every hour
      } else if (minuteData.description === "0") {
        sentence = `At the top of every hour`; // "At minute 0 of every hour"
      } else {
        sentence = `At minute ${minuteData.description} past every hour`;
      }
    } else {
      // Both minute and hour are specific
      let timeStr = "";
      if (minuteData.description === "0" && hourData.description === "0") {
        timeStr = "At midnight";
      } else if (
        minuteData.description === "0" &&
        hourData.description === "12"
      ) {
        timeStr = "At noon";
      } else if (minuteData.description === "0") {
        if (hourData.step) {
          timeStr = `At the top of every ${getOrdinal(hourData.step)} hour`;
        } else {
          timeStr = `At the top of hour ${hourData.description}`; // "At 0 minutes past hour X"
        }
      } else if (hourData.step) {
        timeStr = `At minute ${minuteData.description} past every ${getOrdinal(
          hourData.step
        )} hour`;
      } else {
        // Format like HH:MM if single specific time
        let hourPart = hourData.description;
        let minutePart = minuteData.description;

        if (hourData.isSingleSpecific && minuteData.isSingleSpecific) {
          const hourNum = parseInt(hourPart, 10);
          const minuteNum = parseInt(minutePart, 10);
          if (!isNaN(hourNum) && !isNaN(minuteNum)) {
            hourPart = hourNum.toString().padStart(2, "0");
            minutePart = minuteNum.toString().padStart(2, "0");
            timeStr = `At ${hourPart}:${minutePart}`;
          } else {
            // Fallback if parsing failed (e.g., names used unexpectedly?)
            timeStr = `At minute ${minuteData.description} past hour ${hourData.description}`;
          }
        } else {
          timeStr = `At minute ${minuteData.description} past hour ${hourData.description}`;
        }
      }
      sentence = timeStr;
    }

    // 2. Date Part (DayOfMonth, Month, DayOfWeek)

    // Store date constraint clauses
    const dateClauses: string[] = [];
    let dayOfMonthClause = "";
    let dayOfWeekClause = "";

    // Day of Month and Month Clause
    if (!dayOfMonthData.isEvery || !monthData.isEvery) {
      let monthPart = "";
      if (!monthData.isEvery) {
        if (monthData.step) {
          monthPart = `of every ${getOrdinal(monthData.step)} month`;
        } else {
          monthPart = `in ${monthData.description}`;
        }
      } else {
        monthPart = "of every month";
      }

      let dayPart = "";
      if (!dayOfMonthData.isEvery) {
        if (dayOfMonthData.step) {
          dayPart = `on every ${getOrdinal(dayOfMonthData.step)} day`;
        } else {
          // Use ordinals for day of month if it's a single number or list of numbers
          const dayValues = dayOfMonth.split(",").map((p) => p.trim());
          const useOrdinals = dayValues.every(
            (p) => /^\d+$/.test(p) || /^\d+-\d+$/.test(p)
          ); // Check if all parts are numeric or numeric ranges

          if (useOrdinals && !dayOfMonthData.isRange && !dayOfMonthData.step) {
            const nums = dayOfMonth.split(",").flatMap((part) => {
              if (part.includes("-")) {
                const [start, end] = part.split("-").map(Number);
                const range = [];
                for (let i = start; i <= end; i++) range.push(i);
                return range;
              }
              return [Number(part)];
            });
            dayPart = `on the ${listToSentence(nums.map(getOrdinal))}`;
          } else {
            // Handle ranges or steps more generically
            dayPart = `on day ${dayOfMonthData.description}`;
          }
        }
        dayOfMonthClause = `${dayPart} ${monthPart}`;
      } else {
        // Day of Month is *, Month is specific
        dayOfMonthClause = `of every day ${monthPart}`;
      }
    }

    // Day of Week Clause (Independent of Month/DOM for sentence structure)
    if (!dayOfWeekData.isEvery) {
      if (dayOfWeekData.step) {
        // Calculate specific days for step
        const days = [];
        for (let i = 0; i <= 6; i += dayOfWeekData.step) {
          days.push(DAY_NAMES[i]);
        }
        dayOfWeekClause = `on ${listToSentence(days)}`;
      } else {
        dayOfWeekClause = `on ${dayOfWeekData.description}`;
      }
    }

    // Combine date clauses considering the OR logic for DOM/DOW
    if (dayOfMonthClause && dayOfWeekClause) {
      // Both DOM/Month and DOW have constraints -> OR logic
      sentence += `, ${dayOfMonthClause}, and also ${dayOfWeekClause}`;
    } else if (dayOfMonthClause) {
      // Only DOM/Month has constraints
      sentence += `, ${dayOfMonthClause}`;
    } else if (dayOfWeekClause) {
      // Only DOW has constraints
      sentence += `, ${dayOfWeekClause}`;
    } else if (sentence === "Every minute") {
      // If time is "Every minute" and no date constraints, leave it as is.
    } else {
      // Time is specific, but no date constraints - implies every day
      sentence += ", every day";
    }

    // 3. Year Part
    if (!yearData.isEvery) {
      if (yearData.step) {
        sentence += ` of every ${getOrdinal(yearData.step)} year`;
      } else {
        sentence += ` in year ${yearData.description}`;
      }
    }

    return sentence + ".";
  } catch (e: any) {
    // Re-throw parsing errors with more context
    throw new Error(
      `Failed to parse cron string "${cronString}": ${e.message}`
    );
  }
}

// --- Example Usage ---
// const testCrons = [
//     "* * * * *",         // Every minute.
//     "*/5 * * * *",       // Every 5 minutes.
//     "0 * * * *",         // At the top of every hour.
//     "0 */2 * * *",       // At the top of every 2nd hour.
//     "15,45 * * * *",     // At minute 15 and 45 past every hour.
//     "0 9 * * *",         // At 09:00, every day.
//     "0 9-17 * * *",      // At the top of hour 9 through 17, every day.
//     "0 9,17 * * *",      // At the top of hour 9 and 17, every day.
//     "30 10 * * 1-5",     // At 10:30 on Monday through Friday.
//     "0 0 1 * *",         // At midnight on the 1st of every month.
//     "0 0 1,15 * *",    // At midnight on the 1st and 15th of every month.
//     "0 0 * * MON",       // At midnight on Monday.
//     "0 0 * * 0,6",       // At midnight on Sunday and Saturday.
//     "0 0 1 * 1",         // At midnight on the 1st of every month, and also on Monday. (OR condition)
//     "0 0 1 JAN 1",       // At midnight on the 1st in January, and also on Monday. (OR, but constrained by month) -> Refined phrasing needed?
//     "0 12 15 */2 *",     // At noon on the 15th of every 2nd month.
//     "* * * 1,2,3 *",     // Every minute of every day in January, February, and March.
//     "0 8 1-7 * 1",       // At 08:00 on day 1st through 7th of every month, and also on Monday.
//     "0 0 1 * * 2025",    // At midnight on the 1st of every month in year 2025.
//     "0 0 L * *",        // Quartz 'L' - Not supported by this basic parser
//     "0 0 ? * MON",       // Quartz '?' - Treated as *
//     "*/10 * 1-5 JAN-MAR MON,TUE", // Every 10 minutes on day 1st through 5th in January through March, and also on Monday and Tuesday.
//     "0 0 */3 * *",     // At midnight on every 3rd day of every month.
// ];

// testCrons.forEach(cron => {
//     try {
//         console.log(`"${cron}"\n  => ${cronToSentence(cron)}\n`);
//     } catch (error: any) {
//         console.log(`"${cron}"\n  => Error: ${error.message}\n`);
//     }
// });

// // Example with Quartz 'L' (will likely throw error or misinterpret)
// try {
//      console.log(`"0 0 L * *"\n  => ${cronToSentence("0 0 L * *")}\n`);
//  } catch (error: any) {
//      console.log(`"0 0 L * *"\n  => Error: ${error.message}\n`);
//  }
