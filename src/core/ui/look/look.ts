// "Saydamlığı azalt" and "Hareketi azalt" (docs/tasarim/ilkeler.md, decision 1): two switches of
// this device. Each follows the device's own accessibility preference until the user sets it;
// what the user set wins. Stored in the browser, applied as attributes on <html> that the glass
// and motion rules read (src/core/ui/kit/glass.css).

export type LookKey = "transparency" | "motion";

/** What the user set on this device; null: follow the device. */
export type LookChoice = Record<LookKey, boolean | null>;

export const LOOK_STORAGE_KEY = "sherpa.look";

export const DEVICE_QUERY: Record<LookKey, string> = {
  transparency: "(prefers-reduced-transparency: reduce)",
  motion: "(prefers-reduced-motion: reduce)",
};

export const LOOK_ATTRIBUTE: Record<LookKey, string> = {
  transparency: "data-transparency",
  motion: "data-motion",
};

/** Whether the reduced look is on: the user's choice, else the device's preference. */
export function reduced(choice: boolean | null | undefined, device: boolean): boolean {
  return choice ?? device;
}

export function parseChoice(raw: string | null): LookChoice {
  const none: LookChoice = { transparency: null, motion: null };
  if (!raw) return none;
  try {
    const value = JSON.parse(raw) as Partial<Record<LookKey, unknown>>;
    const pick = (v: unknown) => (typeof v === "boolean" ? v : null);
    return { transparency: pick(value.transparency), motion: pick(value.motion) };
  } catch {
    return none;
  }
}

/**
 * Runs before the page paints (an inline script in the root layout), so a reduced look never
 * flashes the full glass first. Kept dependency-free: it is sent as text.
 */
export const LOOK_BOOT_SCRIPT = `(function(){try{var c={};try{c=JSON.parse(localStorage.getItem(${JSON.stringify(
  LOOK_STORAGE_KEY,
)})||"{}")||{}}catch(e){}var q=${JSON.stringify(DEVICE_QUERY)},a=${JSON.stringify(
  LOOK_ATTRIBUTE,
)};for(var k in q){var on=typeof c[k]==="boolean"?c[k]:window.matchMedia(q[k]).matches;if(on)document.documentElement.setAttribute(a[k],"reduced");}}catch(e){}})();`;
