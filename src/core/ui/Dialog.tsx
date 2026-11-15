"use client";

import type { ReactNode, RefObject } from "react";
import { Sheet } from "./kit/Overlay";

/**
 * The core's form shell (docs/tasarim/parcalar.md, "Alttan açılan sayfa / yan panel"): from the
 * bottom on the phone, a 440 px panel from the right on the board. A form that draws its own
 * bottom line passes `bare` and uses SheetBody and SheetFooter (src/core/ui/kit/Overlay.tsx).
 * Confirmations use the kit's Window instead.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  children,
  className,
  bare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      initialFocus={initialFocus}
      className={className}
      bare={bare}
    >
      {children}
    </Sheet>
  );
}
