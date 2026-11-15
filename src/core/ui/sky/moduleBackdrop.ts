import type { KnownModule } from "@/core/app/hooks";
import { moduleColor } from "@/core/contract/colors";
import type { ModuleFacet } from "@/core/contract/types";
import type { BackdropKind } from "./Backdrop";

// What a module's screens stand on (docs/tasarim/ilkeler.md, decision 4; docs/06, "Modülün
// zemini"). Pure: the screens ask for what this says.

/** The module page: the module's own backdrop if it gives one, else the shell's (calm). */
export function modulePageBackdrop(mod: KnownModule): BackdropKind | null {
  const Backdrop = mod.definition?.ui.backdrop;
  if (!Backdrop) return null;
  return { kind: "module", id: mod.row.slug, color: moduleColor(mod), Backdrop };
}

/**
 * A scene: the module's own backdrop if it gives one, else the tone's (docs/tasarim/ekranlar/
 * sahne.md): calm is the hour's full landscape, focus dark and flat, energy the work's colour
 * fading into the dark.
 */
export function sceneBackdrop(
  mod: KnownModule,
  tone: NonNullable<ModuleFacet["tone"]>,
  color: string,
): BackdropKind {
  const Backdrop = mod.definition?.ui.backdrop;
  if (Backdrop) return { kind: "module", id: mod.row.slug, color, Backdrop };
  if (tone === "focus") return { kind: "focus" };
  if (tone === "energy") return { kind: "energy", color };
  return { kind: "full" };
}
