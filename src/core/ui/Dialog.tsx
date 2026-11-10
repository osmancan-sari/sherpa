"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * The core's dialog: centred on the second screen, a sheet from the bottom edge on the phone,
 * where the thumb is. Closes with Escape, the backdrop or the close button.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          initialFocus={initialFocus}
          className={cn(
            "bg-background border-border fixed z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto border p-5 shadow-xl outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
            "md:inset-x-auto md:top-[12vh] md:bottom-auto md:left-1/2 md:w-[min(42rem,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-2xl md:pb-5",
            "transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted-foreground text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Kapat"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-2 flex size-11 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-3 md:size-9"
            >
              <X aria-hidden className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
