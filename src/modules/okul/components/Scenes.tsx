"use client";

import type { SceneProps } from "@/core/contract/types";

/** The module's scene (step 6). */
export function OkulScene({ subject }: SceneProps) {
  return <div data-testid="okul-scene" data-kind={subject.kind} />;
}
