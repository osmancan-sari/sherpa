import { findFacet, HEX_COLOR } from "./facets";
import type { ModuleFacet } from "./types";

// Colours (docs/06-modul-sozlesmesi.md, "Bölümler" rule 4; docs/05-arayuz.md, "Renkler ve
// bölümler"; Ç3e). The one place the core turns a module and a facet into a colour. Screens
// never read a module row's colour themselves: work gets `workColor`, module-level places
// (chips, shares, module lists) get `moduleColor`. A test keeps it that way
// (tests/unit/colors-in-one-place.test.ts).

/** What the colour of a module comes from: its row (the user's) and its definition (the default). */
export type ColorSource = {
  row?: { color: string | null; facet_colors?: unknown } | null;
  definition?: { color: string } | null;
};

/** When nothing knows a colour (a row without code and without a colour). */
export const NO_COLOR = "#64748b";

const valid = (value: unknown): value is string =>
  typeof value === "string" && HEX_COLOR.test(value);

/** The user's colour of the module, else the module's default. */
export function moduleColor(source: ColorSource | null | undefined): string {
  if (valid(source?.row?.color)) return source.row.color;
  if (valid(source?.definition?.color)) return source.definition.color;
  return NO_COLOR;
}

/** The user's facet colours as stored (`modules.facet_colors`); anything malformed is skipped. */
export function userFacetColors(row: ColorSource["row"]): Record<string, string> {
  const stored = row?.facet_colors;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored as Record<string, unknown>).filter(([, value]) => valid(value)),
  ) as Record<string, string>;
}

/** A facet's colour: the user's, else the facet's default. */
export function facetColor(row: ColorSource["row"], facet: ModuleFacet): string {
  return userFacetColors(row)[facet.key] ?? (valid(facet.color) ? facet.color : NO_COLOR);
}

/**
 * The colour of a piece of work: the user's facet colour → the facet's default → the user's
 * module colour → the module's default. A facet that is no longer in the list counts as none.
 */
export function workColor(
  source: ColorSource | null | undefined,
  facets: readonly ModuleFacet[] | null | undefined,
  facetKey: string | null | undefined,
): string {
  const facet = findFacet(facets, facetKey);
  return facet ? facetColor(source?.row, facet) : moduleColor(source);
}

// --- The palette and readability ----------------------------------------------------------------

/**
 * The ready colours of the picker: each stays at least 3:1 against the light background and
 * the dark background and card (WCAG non-text contrast), so a dot or a bar can be told apart in
 * both themes. "Görüşün gerek" (docs/05).
 */
export const PALETTE: readonly { name: string; value: string }[] = [
  { name: "Kehribar", value: "#d97706" },
  { name: "Turuncu", value: "#ea580c" },
  { name: "Gül", value: "#e11d48" },
  { name: "Pembe", value: "#db2777" },
  { name: "Eflatun", value: "#c026d3" },
  { name: "Menekşe", value: "#7c3aed" },
  { name: "Lacivert", value: "#4361d8" },
  { name: "Mavi", value: "#2563eb" },
  { name: "Camgöbeği", value: "#0891b2" },
  { name: "Deniz yeşili", value: "#0d9488" },
  { name: "Yeşil", value: "#16a34a" },
  { name: "Kurşuni", value: "#64748b" },
];

/** The themes' backgrounds a colour is drawn on: light page, dark page, dark card. */
export const BACKGROUNDS = ["#ffffff", "#0a0a0a", "#171717"] as const;

export const READABLE_CONTRAST = 3;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Whether a colour can be told apart from every background of both themes. */
export function readable(hex: string): boolean {
  if (!valid(hex)) return false;
  return BACKGROUNDS.every((background) => contrast(hex, background) >= READABLE_CONTRAST);
}

/** "#E8A33D" → "#e8a33d"; null for anything that is not #rrggbb. */
export function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return valid(hex) ? hex.toLowerCase() : null;
}
