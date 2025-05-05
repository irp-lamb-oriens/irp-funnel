/**
 * Returns the ordinal suffix for a given number (e.g., "st", "nd", "rd", "th").
 */
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Generic function to describe a cron field (minute, hour, second, etc.) using common patterns.
 * Handles wildcards, steps, ranges, lists, and single values.
 *
 * @param expression - The cron field expression.
 * @param unit - The name of the unit (e.g., "minute", "hour").
 * @param min - The minimum value for the unit.
 * @param max - The maximum value for the unit.
 * @returns A natural language description for that field.
 */
function describeField(
  expression: string,
  unit: string,
  min: number,
  max: number
): string {
  // Wildcard or "any" indicator.
  if (expression === "*" || expression === "?") {
    return `every ${unit}`;
  }

  // Step values like "*/5".
  if (expression.startsWith("*/")) {
    const step = expression.substring(2);
    return `every ${step} ${unit}${parseInt(step) > 1 ? "s" : ""}`;
  }

  // Step values on a range like "10-50/5".
  if (expression.includes("/")) {
    const parts = expression.split("/");
    const base = parts[0];
    const step = parts[1];
    if (base === "*") {
      return `every ${step} ${unit}${parseInt(step) > 1 ? "s" : ""}`;
    } else if (base.includes("-")) {
      const [start, end] = base.split("-");
      return `every ${step} ${unit}${
        parseInt(step) > 1 ? "s" : ""
      } between ${start} and ${end}`;
    }
  }

  // Ranges like "10-20".
  if (expression.includes("-") && !expression.includes(",")) {
    const [start, end] = expression.split("-");
    return `${unit} between ${start} and ${end}`;
  }

  // Lists like "5,10,15".
  if (expression.includes(",")) {
    const parts = expression.split(",");
    return `${unit} at ${parts.join(", ")}`;
  }

  // Single fixed value.
  return `at ${unit} ${expression}`;
}

/**
 * Converts the day-of-month field to a natural language description.
 * Supports special characters such as L and W.
 *
 * @param expression - The cron day-of-month field.
 * @returns A natural language description.
 */
function describeDayOfMonth(expression: string): string {
  if (expression === "*" || expression === "?") {
    return "every day";
  }
  if (expression === "L") {
    return "the last day of the month";
  }
  if (/^\d+W$/.test(expression)) {
    // e.g. "15W"
    const day = expression.slice(0, -1);
    return `the weekday nearest day ${day} of the month`;
  }
  if (expression.includes(",")) {
    const parts = expression.split(",");
    return `on days ${parts.join(", ")}`;
  }
  if (expression.includes("-") || expression.includes("/")) {
    return `on days specified by "${expression}"`;
  }
  return `on day ${expression} of the month`;
}

/**
 * Converts the month field to a natural language description.
 * Converts numeric months to month names.
 *
 * @param expression - The cron month field.
 * @returns A natural language description.
 */
function describeMonth(expression: string): string {
  const monthNames = [
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
  if (expression === "*" || expression === "?") {
    return "every month";
  }
  if (expression.includes(",")) {
    const parts = expression.split(",").map((p) => {
      const num = parseInt(p);
      return isNaN(num) ? p : monthNames[num - 1] || p;
    });
    return `in ${parts.join(", ")}`;
  }
  if (expression.includes("-") || expression.includes("/")) {
    return `in months specified by "${expression}"`;
  }
  const num = parseInt(expression);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return `in ${monthNames[num - 1]}`;
  }
  return `in month ${expression}`;
}

/**
 * Converts the day-of-week field to a natural language description.
 * Supports special cases like "L" (last) and "#" (nth occurrence).
 *
 * @param expression - The cron day-of-week field.
 * @returns A natural language description.
 */
function describeDayOfWeek(expression: string): string {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  if (expression === "*" || expression === "?") {
    return "every day of the week";
  }
  if (expression.includes("#")) {
    // Format like "2#1" means the 1st Monday (if 2 corresponds to Monday, assuming Sunday = 0).
    const [day, nth] = expression.split("#");
    const dayIndex = parseInt(day) % 7;
    const nthNum = parseInt(nth);
    return `on the ${nthNum}${getOrdinal(nthNum)} ${dayNames[dayIndex]}`;
  }
  if (expression.endsWith("L")) {
    // e.g. "5L" means the last Thursday (if 5 corresponds to Thursday)
    const dayPart = expression.slice(0, -1);
    const dayIndex = parseInt(dayPart) % 7;
    return `on the last ${dayNames[dayIndex]} of the week`;
  }
  if (expression.includes(",")) {
    const parts = expression.split(",").map((p) => {
      const num = parseInt(p);
      if (!isNaN(num)) {
        const dayIndex = num % 7;
        return dayNames[dayIndex];
      }
      return p;
    });
    return `on ${parts.join(", ")}`;
  }
  if (expression.includes("-") || expression.includes("/")) {
    return `on days specified by "${expression}"`;
  }
  const num = parseInt(expression);
  if (!isNaN(num)) {
    const dayIndex = num % 7;
    return `on ${dayNames[dayIndex]}`;
  }
  return `on day ${expression}`;
}

/**
 * Converts a cron expression into a detailed natural language description.
 * Supports both 5-field and 6-field cron expressions.
 *
 * @param cron - The cron expression string.
 * @returns A human-readable description of the cron schedule.
 */
export function cronToNaturalLanguage(cron: string): string {
  // Split the cron expression into its parts.
  const parts = cron.trim().split(/\s+/);
  let hasSeconds = false;
  if (parts.length === 6) {
    hasSeconds = true;
  } else if (parts.length !== 5) {
    return "Invalid cron expression: expected 5 or 6 fields.";
  }

  let secondsExpr = "";
  let minuteExpr = "";
  let hourExpr = "";
  let dayOfMonthExpr = "";
  let monthExpr = "";
  let dayOfWeekExpr = "";

  if (hasSeconds) {
    [
      secondsExpr,
      minuteExpr,
      hourExpr,
      dayOfMonthExpr,
      monthExpr,
      dayOfWeekExpr,
    ] = parts;
  } else {
    [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] = parts;
  }

  const secondsDesc = hasSeconds
    ? describeField(secondsExpr, "second", 0, 59)
    : "";
  const minuteDesc = describeField(minuteExpr, "minute", 0, 59);
  const hourDesc = describeField(hourExpr, "hour", 0, 23);
  const dayOfMonthDesc = describeDayOfMonth(dayOfMonthExpr);
  const monthDesc = describeMonth(monthExpr);
  const dayOfWeekDesc = describeDayOfWeek(dayOfWeekExpr);

  // Combine the descriptions. Only include fields that don't indicate "every" unit if possible.
  const partsDesc: string[] = [];
  if (hasSeconds && secondsDesc !== "every second") {
    partsDesc.push(secondsDesc);
  }
  if (minuteDesc !== "every minute") {
    partsDesc.push(minuteDesc);
  }
  if (hourDesc !== "every hour") {
    partsDesc.push(hourDesc);
  }
  if (dayOfMonthDesc !== "every day") {
    partsDesc.push(dayOfMonthDesc);
  }
  if (monthDesc !== "every month") {
    partsDesc.push(monthDesc);
  }
  if (dayOfWeekDesc !== "every day of the week") {
    partsDesc.push(dayOfWeekDesc);
  }

  if (partsDesc.length === 0) {
    return "Runs every minute of every day.";
  }

  return partsDesc.join(", ") + ".";
}
