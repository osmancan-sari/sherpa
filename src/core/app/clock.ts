// One clock for every screen. "Now" is re-read every half minute, when the window comes back to
// the front, and whenever data changes (docs/11-yayin-ve-cihazlar.md: the "now" state is
// recomputed every minute and on every change). Screens read it with useNow(); nothing keeps a
// clock of its own, so two components never disagree about the time.

const TICK_MS = 30_000;
/** What the server render sees; the screens that show time render in the browser only. */
const EPOCH = new Date(0);

let current: Date | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

/** Re-reads the clock and tells every screen. */
export function touchClock(): void {
  current = new Date();
  for (const listener of listeners) listener();
}

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(touchClock, TICK_MS);
    document.addEventListener("visibilitychange", touchClock);
    window.addEventListener("focus", touchClock);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", touchClock);
      window.removeEventListener("focus", touchClock);
    }
  };
}

export function readClock(): Date {
  current ??= new Date();
  return current;
}

export function readServerClock(): Date {
  return EPOCH;
}
