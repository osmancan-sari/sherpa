"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";

// The sheet and the window (docs/tasarim/parcalar.md, "Alttan açılan sayfa / yan panel" and
// "Pencere"; frames Parca2, ET1, EP1). Forms and editing open in the sheet: from the bottom on the
// phone (handle, title, "Kapat"), as a 440 px panel from the right on the board; its content
// scrolls and its bottom line stays (extra action on the left, "Vazgeç" and the primary on the
// right). A confirmation opens in the window: centred, at most 440 px, "Vazgeç" always there and
// the primary on the right. Behind both the screen darkens (45%). Escape, the backdrop and
// "Kapat" close them.

const BACKDROP =
  "bg-scrim fixed inset-0 z-40 transition-opacity duration-(--motion-base) data-ending-style:opacity-0 data-starting-style:opacity-0";

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  footer,
  children,
  className,
  bare = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialFocus?: RefObject<HTMLElement | null>;
  /** The bottom line: extra action at the left, "Vazgeç" and the primary at the right. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The children draw the body and the bottom line themselves (SheetBody, SheetFooter). */
  bare?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={BACKDROP} />
        <DialogPrimitive.Popup
          initialFocus={initialFocus}
          data-testid="sheet"
          className={cn(
            "glass-sheet text-ink fixed z-50 flex flex-col outline-none",
            // Phone: from the bottom edge; at its tallest it stops short of the top as in the
            // frames (94%), and always under the clock and island.
            "rounded-t-panel inset-x-0 bottom-0 max-h-[min(94dvh,calc(100dvh-(env(safe-area-inset-top)+--spacing(2))))] border-b-0",
            "ease-glass transition-transform duration-(--motion-base) data-ending-style:translate-y-full data-starting-style:translate-y-full",
            // Board: a 440 px panel from the right edge.
            "md:w-sheet md:rounded-l-panel md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-tr-none md:border-r-0 md:border-b",
            "md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0",
            className,
          )}
        >
          <span
            aria-hidden
            className="bg-fill-handle mt-2 h-1.25 w-10 shrink-0 self-center rounded-sm md:hidden"
          />
          <div className="flex shrink-0 items-center gap-3 py-1.5 pr-2.5 pl-4.5 md:pt-4.5 md:pr-3.5 md:pb-2.5 md:pl-6">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogPrimitive.Title className="text-heading md:text-side-title font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-ink-2 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              render={
                <IconButton label="Kapat">
                  <X aria-hidden />
                </IconButton>
              }
            />
          </div>
          {bare ? children : <SheetBody>{children}</SheetBody>}
          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The sheet's scrolling body, when the form draws its own (inside a <form>). */
export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4.5 pt-2 pb-4 md:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The sheet's bottom line, when the form draws its own (inside a <form>). */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-line flex shrink-0 flex-wrap items-center gap-2 border-t px-4 pt-3 pb-[calc(--spacing(6.5)+env(safe-area-inset-bottom))] md:px-6 md:pt-3.5 md:pb-5.5">
      {children}
    </div>
  );
}

/** The window: a confirmation. "Vazgeç" is always there; the primary sits at the right. */
export function Window({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  role = "alertdialog",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The buttons, "Vazgeç" first; each fills half the row. */
  actions: ReactNode;
  role?: "dialog" | "alertdialog";
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={BACKDROP} />
        <DialogPrimitive.Popup
          role={role}
          data-testid="window"
          className={cn(
            "glass-dialog rounded-panel text-ink max-w-sheet fixed inset-x-6 top-1/2 z-50 mx-auto flex -translate-y-1/2 flex-col gap-2.5 px-4.5 pt-5.5 pb-4 outline-none",
            "transition-opacity duration-(--motion-base) data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <DialogPrimitive.Title className="text-heading font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-note text-ink-2 leading-relaxed">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
          <div className="mt-2 flex gap-2.5 *:h-12.5 *:flex-1">{actions}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The close of a sheet or a window, for a "Vazgeç" button in its bottom line. */
export const OverlayClose = DialogPrimitive.Close;
