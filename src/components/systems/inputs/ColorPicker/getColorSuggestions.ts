// colorSuggestions.ts

import { get } from "svelte/store";
import { complementaryColor } from "../../../ThemeChanger/theme-store.ts";
import store from "../../../store.ts";

// -----------------------------
// Helper Functions: HEX ↔ HSL
// -----------------------------

/**
 * Converts a HEX color string to an HSL object.
 * @param hex - The color in HEX format (e.g., "#6C48EA").
 * @returns An object with h (0-360), s (0-100), and l (0-100).
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace("#", "");

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts HSL values to a HEX color string.
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns The HEX color string (e.g., "#6C48EA").
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
  } else if (120 <= h && h < 180) {
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// -----------------------------
// Generate Color Suggestions
// -----------------------------

/**
 * Generates candidate color suggestions based on a given HEX color.
 * Applies classic color harmony rules (Complementary, Analogous, Triadic, Tetradic, Monochromatic).
 *
 * @param hex - The base HEX color (e.g., "#6C48EA").
 * @returns Array of suggestion objects with a scheme and an array of candidate HEX colors.
 */
function generateColorSuggestions(
  hex: string
): { scheme: string; colors: string[] }[] {
  const { h, s, l } = hexToHsl(hex);

  const suggestions = [
    { scheme: "Complementary", colors: [hslToHex((h + 180) % 360, s, l)] },
    {
      scheme: "Analogous",
      colors: [
        hslToHex((h - 30 + 360) % 360, s, l),
        hslToHex((h + 30) % 360, s, l),
      ],
    },
    {
      scheme: "Triadic",
      colors: [
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l),
      ],
    },
    {
      scheme: "Tetradic",
      colors: [
        hslToHex((h + 90) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 270) % 360, s, l),
      ],
    },
    {
      scheme: "Monochromatic",
      colors: [
        hslToHex(h, s, Math.min(100, l + 20)),
        hslToHex(h, s, Math.max(0, l - 20)),
      ],
    },
  ];

  return suggestions;
}

// -----------------------------
// Type Definitions
// -----------------------------

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface Suggestion {
  scheme: string;
  colors: string[]; // Candidate colors in HEX
}

export interface CandidateScore {
  candidate: string; // The candidate color in HEX
  scheme: string; // The scheme from which this candidate came
  score: number; // Higher score indicates a better suggestion
}

// -----------------------------
// Precursor Functions for Palette Context
// -----------------------------

/**
 * Converts an array of HEX colors to an array of HSL objects.
 * @param hexColors - Array of HEX color strings.
 * @returns Array of HSL objects.
 */
function convertPaletteToHSL(hexColors: string[]): HSL[] {
  return hexColors.map((hex) => hexToHsl(hex));
}

/**
 * Computes the average (mean) hue, saturation, and lightness of an array of HSL colors.
 * @param hslColors - Array of HSL objects.
 * @returns An object containing avgH, avgS, and avgL.
 */
function computePaletteStats(hslColors: HSL[]): {
  avgH: number;
  avgS: number;
  avgL: number;
} {
  const total = hslColors.reduce(
    (acc, color) => ({
      h: acc.h + color.h,
      s: acc.s + color.s,
      l: acc.l + color.l,
    }),
    { h: 0, s: 0, l: 0 }
  );
  const count = hslColors.length;
  return {
    avgH: total.h / count,
    avgS: total.s / count,
    avgL: total.l / count,
  };
}

/**
 * Computes the minimal difference between two hues, accounting for the circular nature of hue.
 * @param h1 - First hue in degrees.
 * @param h2 - Second hue in degrees.
 * @returns The smallest difference between h1 and h2.
 */
function hueDifference(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}

/**
 * Computes a weighted Euclidean distance between two HSL colors.
 * @param color1 - First HSL color.
 * @param color2 - Second HSL color.
 * @param wH - Weight for the hue component (default: 1).
 * @param wS - Weight for the saturation component (default: 1).
 * @param wL - Weight for the lightness component (default: 1).
 * @returns The computed distance.
 */
function hslDistance(
  color1: HSL,
  color2: HSL,
  wH: number = 1,
  wS: number = 1,
  wL: number = 1
): number {
  const dH = hueDifference(color1.h, color2.h);
  const dS = Math.abs(color1.s - color2.s);
  const dL = Math.abs(color1.l - color2.l);
  return Math.sqrt(wH * (dH * dH) + wS * (dS * dS) + wL * (dL * dL));
}

/**
 * Calculates the minimum distance between a candidate HSL color and all colors in the palette.
 * @param candidate - The candidate HSL color.
 * @param palette - Array of HSL colors representing the current palette.
 * @param wH - Weight for hue difference (default: 1).
 * @param wS - Weight for saturation difference (default: 1).
 * @param wL - Weight for lightness difference (default: 1).
 * @returns The smallest distance value.
 */
function minDistanceToPalette(
  candidate: HSL,
  palette: HSL[],
  wH: number = 1,
  wS: number = 1,
  wL: number = 1
): number {
  return palette.reduce(
    (min, color) => Math.min(min, hslDistance(candidate, color, wH, wS, wL)),
    Infinity
  );
}

// -----------------------------
// Contextual Candidate Ranking
// -----------------------------

/**
 * Given an array of candidate suggestions (each with a color scheme) and an existing palette (array of HEX colors),
 * returns a ranked list of candidate suggestions that best fit the palette.
 *
 * Scoring is based on:
 *  - The minimal weighted distance between the candidate (in HSL) and each palette color.
 *  - A bonus based on the candidate's hue distance from the palette’s average hue.
 *
 * @param suggestions - Array of suggestions (each containing a scheme and candidate HEX colors).
 * @param paletteHex - Array of existing palette colors in HEX.
 * @returns Array of candidate suggestions with their scores, sorted descending by score.
 */
function getNextBestSuggestions(
  suggestions: Suggestion[],
  paletteHex: string[]
): CandidateScore[] {
  // Convert the existing palette from HEX to HSL.
  const paletteHSL: HSL[] = convertPaletteToHSL(paletteHex);

  // Compute the average hue, saturation, and lightness of the current palette.
  const { avgH } = computePaletteStats(paletteHSL);

  const candidateScores: CandidateScore[] = [];

  // Evaluate each candidate from the suggestions.
  for (const suggestion of suggestions) {
    for (const candidateHex of suggestion.colors) {
      // Convert candidate to HSL.
      const candidateHSL: HSL = hexToHsl(candidateHex);

      // Compute the minimal distance from candidate to the palette.
      const minDist: number = minDistanceToPalette(
        candidateHSL,
        paletteHSL,
        1,
        1,
        1
      );

      // Bonus: How far the candidate's hue is from the average hue.
      const hueDiffFromAvg: number = hueDifference(candidateHSL.h, avgH);

      // Combine scores (you can tune the weights as needed).
      const score: number = minDist + hueDiffFromAvg / 10;

      candidateScores.push({
        candidate: candidateHex,
        scheme: suggestion.scheme,
        score: score,
      });
    }
  }

  // Sort candidates by score (higher score means a better contextual suggestion).
  candidateScores.sort((a, b) => b.score - a.score);
  return candidateScores;
}

// -----------------------------
// Exported Function: Get Final Suggestions
// -----------------------------

/**
 * Generates and ranks new color suggestions based on a base HEX color and an existing palette.
 * It uses classic color harmony rules to generate candidate suggestions and then
 * ranks them contextually based on the existing palette.
 *
 * @param paletteHex - Array of existing palette colors in HEX.
 * @param baseHex - The base HEX color used to generate candidate suggestions.
 * @returns Ranked candidate suggestions with their scores.
 */
export default function getColorSuggestions(
  paletteHex: string[],
  baseHex: string
): CandidateScore[] {
  // Generate candidate suggestions based on the base color.
  const suggestions: Suggestion[] = generateColorSuggestions(baseHex);

  // Rank and return the best suggestions in the context of the existing palette.
  return getNextBestSuggestions(suggestions, paletteHex);
}

// -----------------------------
// Example Usage (Uncomment to test)
// -----------------------------
// const existingPalette = ["#6C48EA", "#EACD48", "#48EAE1"];
// const baseColor = "#6C48EA";
// console.log(getColorSuggestions(existingPalette, baseColor));

export function getContrastColor(hexColor: string) {
  // Remove the '#' if it exists
  hexColor = hexColor.replace(/^#/, "");

  // Convert the hex values to integers for red, green, and blue
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);

  // Calculate the brightness using the YIQ formula
  // A higher value indicates a lighter color
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  // Return black for light backgrounds and white for dark backgrounds
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

export function getComplementaryColor(selectedColor: string): string {
  return (
    getColorSuggestions(get(store).colorPalette, selectedColor).filter(
      ({ scheme, candidate }) => {
        return (
          scheme === "Analogous" && getContrastColor(candidate) === "#000000"
        );
      }
    )[0]?.candidate || get(complementaryColor)
  );
}
