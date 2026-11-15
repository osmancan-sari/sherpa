"use client";

import { OfflinePill } from "@/core/ui/kit/Feedback";
import { useOnline } from "./useOnline";

/** "bağlantı yok", only while the device is offline. */
export function ConnectionPill() {
  return useOnline() ? null : <OfflinePill />;
}
