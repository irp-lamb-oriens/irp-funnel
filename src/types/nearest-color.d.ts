// Type declarations for nearest-color

declare module 'nearest-color' {
  interface ColorMatch {
    name: string;
    value: string; // The original hex value from the input map
    distance: number;
  }

  // Define the types of input the library accepts for a color
  type ColorSpec = string | { r: number; g: number; b: number } | { h: number; s: number; l: number } | { h: number; s: number; v: number };

  // Define the types for the map of colors provided to 'from'
  type Colors = Record<string, ColorSpec> | Array<{ name: string; value: ColorSpec }>;

  // Define the function returned by 'from'
  type NearestColorFunction = (color: ColorSpec) => ColorMatch | undefined;

  // Define the 'from' function itself
  function from(colors: Colors): NearestColorFunction;

  // Define the main export of the module, including STANDARD_COLORS
  const nearestColor: {
    from: typeof from;
    STANDARD_COLORS: Record<string, string>; // Add the missing property definition
  };

  export default nearestColor;
}

// Remove the incorrect declaration for the non-existent subpath
