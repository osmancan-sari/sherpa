"use client";

import type { ModuleViewProps } from "@/core/contract/types";

/** An assessment's page (step 5). */
export function AssessmentPage({ params }: ModuleViewProps) {
  return <div data-testid="okul-assessment" data-id={params.id} />;
}

/** A course's attendance (step 5). */
export function AttendancePage({ params }: ModuleViewProps) {
  return <div data-testid="okul-attendance" data-course={params.course} />;
}
