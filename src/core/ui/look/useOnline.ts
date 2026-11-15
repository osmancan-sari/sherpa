"use client";

import { useSyncExternalStore } from "react";

// Whether the device is connected (docs/tasarim/ekranlar/bos-ve-hata.md, "Bağlantı koptu"):
// while it is not, a small pill says so at the right of the screen's top line and the last
// known plan stays on the screen.

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
