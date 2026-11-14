"use client";

import type { SceneProps } from "@/core/contract/types";

export function RutinScene({ subject }: SceneProps) {
  return <div data-testid="rutin-scene">{subject.kind}</div>;
}
