"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { normalizeClock, typingClock } from "@/lib/clock-input";

/**
 * A clock time typed as text ("HH:mm"). The phone's number pad has no ":", so digits alone do:
 * four digits become "08:00" at once, and leaving the field turns "800" into 08:00 and "24" into
 * 24:00 (src/lib/clock-input.ts). A colon, a dot or a comma typed by hand works too.
 */
export function TimeInput({
  value,
  onChange,
  onBlur,
  placeholder = "SS:dd",
  ...rest
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(typingClock(event.target.value))}
      onBlur={(event) => {
        const finished = normalizeClock(value);
        if (finished !== value) onChange(finished);
        onBlur?.(event);
      }}
    />
  );
}
