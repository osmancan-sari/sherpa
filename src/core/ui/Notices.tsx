"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Toast } from "./kit/Feedback";
import { TOKENS } from "./tokens";

// One quiet line at the bottom of the screen: "Gelen kutusuna eklendi", "Kaydedilemedi".
// No badges, no stacking, nothing that asks for attention; the newest line replaces the last.

type Notice = { id: number; text: string };

const NoticeContext = createContext<((text: string) => void) | null>(null);

/** Shows a short line for a few seconds. */
export function useNotify(): (text: string) => void {
  const notify = useContext(NoticeContext);
  if (!notify) throw new Error("NoticeProvider is missing above this component.");
  return notify;
}

/** What the interface says when a write fails and the screen has been put back. */
export const SAVE_FAILED = "Kaydedilemedi. Değişiklik geri alındı.";

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), parseFloat(TOKENS["toast-time"]) * 1000);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => notify, [notify]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {/* At the bottom centre, above the phone's menu bar (docs/tasarim/parcalar.md, "Bildirim"). */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-nav)+--spacing(9)+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
      >
        {notice ? (
          <Toast key={notice.id} className="max-w-sheet">
            {notice.text}
          </Toast>
        ) : null}
      </div>
    </NoticeContext.Provider>
  );
}
