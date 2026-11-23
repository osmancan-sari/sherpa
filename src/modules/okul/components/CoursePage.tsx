"use client";

import type { ModuleFacetViewProps } from "@/core/contract/types";

/** A course's page (step 5). */
export function CoursePage({ facet }: ModuleFacetViewProps) {
  return <div data-testid="okul-course" data-facet={facet.key} />;
}
