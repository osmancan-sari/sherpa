"use client";

import { createDeviceToken, type DeviceToken, revokeDeviceToken } from "@/core/data/tokens";
import { SAVE_FAILED, useNotify } from "@/core/ui/Notices";
import { keys, list, useCoreMutation } from "./hooks";

// Settings → Bağlantılar (Ç3d): making and revoking device tokens.

/** Makes a token; the result carries the token itself, shown once. */
export function useCreateDeviceToken() {
  const notify = useNotify();
  return useCoreMutation({
    mutate: (db, input: { name: string; scopes: string[] }) => createDeviceToken(db, input),
    invalidate: [keys.deviceTokens],
    onError: () => notify(SAVE_FAILED),
  });
}

/** Revokes a token at once on the screen; the endpoint refuses it from now on. */
export function useRevokeDeviceToken() {
  const notify = useNotify();
  return useCoreMutation({
    mutate: (db, id: string) => revokeDeviceToken(db, id, new Date()),
    optimistic: (id) => [
      {
        key: keys.deviceTokens,
        update: list.patch<DeviceToken>(id, { revoked_at: new Date().toISOString() }),
      },
    ],
    invalidate: [keys.deviceTokens],
    onError: () => notify(SAVE_FAILED),
  });
}
