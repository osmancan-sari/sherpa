"use client";

import type { BlockViewProps } from "@/core/contract/types";

/** A lesson's view, opened from its fixed block (step 7). */
export function LessonView({ block }: BlockViewProps) {
  return <div data-testid="okul-lesson" data-block={block.id} />;
}
