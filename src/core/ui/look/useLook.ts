"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEVICE_QUERY,
  LOOK_ATTRIBUTE,
  LOOK_STORAGE_KEY,
  type LookChoice,
  type LookKey,
  parseChoice,
  reduced,
} from "./look";

// The device's look preferences as React state. Every reader on the page sees the same value:
// a change in Settings, or in the device's own preference, reaches them all.

const listeners = new Set<() => void>();
let cache: { raw: string | null; device: string; value: LookState } | null = null;

export type LookState = Record<LookKey, { on: boolean; device: boolean; choice: boolean | null }>;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(LOOK_STORAGE_KEY);
  } catch {
    return null;
  }
}

function deviceOf(key: LookKey): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DEVICE_QUERY[key]).matches;
}

function snapshot(): LookState {
  const raw = readRaw();
  const device = `${deviceOf("transparency")}${deviceOf("motion")}`;
  if (cache && cache.raw === raw && cache.device === device) return cache.value;
  const choice = parseChoice(raw);
  const value = Object.fromEntries(
    (["transparency", "motion"] as const).map((key) => {
      const fromDevice = deviceOf(key);
      return [
        key,
        { on: reduced(choice[key], fromDevice), device: fromDevice, choice: choice[key] },
      ];
    }),
  ) as LookState;
  cache = { raw, device, value };
  return value;
}

const SERVER: LookState = {
  transparency: { on: false, device: false, choice: null },
  motion: { on: false, device: false, choice: null },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  const queries = (["transparency", "motion"] as const).map((key) =>
    typeof window.matchMedia === "function" ? window.matchMedia(DEVICE_QUERY[key]) : null,
  );
  queries.forEach((query) => query?.addEventListener("change", listener));
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    queries.forEach((query) => query?.removeEventListener("change", listener));
    window.removeEventListener("storage", listener);
  };
}

function apply(state: LookState) {
  for (const key of ["transparency", "motion"] as const) {
    if (state[key].on) document.documentElement.setAttribute(LOOK_ATTRIBUTE[key], "reduced");
    else document.documentElement.removeAttribute(LOOK_ATTRIBUTE[key]);
  }
}

/** The look of this device, and a way to set one of its switches. */
export function useLook(): [LookState, (key: LookKey, on: boolean) => void] {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER);

  useEffect(() => {
    apply(state);
  }, [state]);

  const set = useCallback((key: LookKey, on: boolean) => {
    const choice: LookChoice = parseChoice(readRaw());
    // Back to "follow the device" when the switch lands where the device already is.
    choice[key] = on === deviceOf(key) ? null : on;
    try {
      window.localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Private mode: the switch still works for this page.
    }
    apply(snapshot());
    listeners.forEach((listener) => listener());
  }, []);

  return [state, set];
}

/** Whether motion is reduced on this device (for code that moves things itself). */
export function useReducedMotion(): boolean {
  return useLook()[0].motion.on;
}

/** Whether transparency is reduced on this device. */
export function useReducedTransparency(): boolean {
  return useLook()[0].transparency.on;
}
