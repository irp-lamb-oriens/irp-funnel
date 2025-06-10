// Funnel / Form constants

// Original one-way map for UI components like Options
export const AGE_RANGES_OPTIONS: Record<string, string> = {
  '18 - 35': '18',
  '36 - 55': '36',
  '56 - 65': '56',
  '65+': '65'
};

// Function to create a bidirectional map
export function createBidirectionalMap(input: Record<string, string | number>): Record<string | number, string | number> {
  const bidiMap: Record<string | number, string | number> = {};
  for (const key in input) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const value = input[key];
      bidiMap[key] = value;
      // Ensure value is a valid key (string or number) before assigning the reverse mapping
      if (typeof value === 'string' || typeof value === 'number') {
        // Check if the reverse mapping would overwrite an existing key from the original input
        // This handles cases where a value might be the same as an original key.
        // For AGE_RANGES_OPTIONS, values are numbers (as strings) and keys are strings, so direct overwrite is unlikely to be an issue.
        if (!Object.prototype.hasOwnProperty.call(input, value.toString())) {
             bidiMap[value] = key;
        } else {
            // Potentially log a warning or handle collision if value could be an existing key
            console.warn(`Bidirectional map collision: value "${value}" is also an original key. Reverse mapping for "${key}" <-> "${value}" might be ambiguous if not handled carefully.`);
            // For this specific AGE_RANGES case, values ('18', '36', etc.) are not the same as keys ('18 - 35', etc.)
            // so we can safely add the reverse mapping.
             bidiMap[value] = key;
        }
      }
    }
  }
  return bidiMap;
}

// Bidirectional map for easy lookups (e.g., '18' -> '18 - 35')
export const AGE_RANGES_BIDI = createBidirectionalMap(AGE_RANGES_OPTIONS);

// Add other shared constants here as needed
