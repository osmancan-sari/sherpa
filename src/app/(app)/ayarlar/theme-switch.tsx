"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const options = [
  { value: "light", label: "Açık" },
  { value: "dark", label: "Koyu" },
  { value: "system", label: "Sistem" },
] as const;

const subscribe = () => () => {};

/** The chosen theme lives in the browser, so the active option is only known after hydration. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div role="group" aria-label="Tema" className="flex gap-2">
      {options.map(({ value, label }) => {
        const active = hydrated && theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            className="h-11 min-w-20 md:h-9"
            onClick={() => setTheme(value)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
