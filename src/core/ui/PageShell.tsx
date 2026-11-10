import type { ReactNode } from "react";

/** Common frame of a screen: a title and the content under it. */
export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
      {children}
    </div>
  );
}

/** What a screen shows while it has nothing to show. One plain sentence, nothing to feel bad about. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="border-border text-muted-foreground rounded-xl border border-dashed px-5 py-10 text-center text-sm">
      {children}
    </p>
  );
}
