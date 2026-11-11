import type { ModuleContext } from "@/core/contract/types";

// The module's own queries and mutations. When the module gets its own tables (migration:
// supabase/migrations/<timestamp>_<slug>_*.sql, with user_id and RLS like every table), they
// are read and written here through `ctx.db`. Core tables are never written directly: work is
// created with `ctx.propose` (rules.ts) and read with `ctx.work`.

/** The module's work as the core holds it. */
export async function listOpenWork(ctx: ModuleContext) {
  const [items, tasks] = await Promise.all([ctx.work.items(), ctx.work.tasks()]);
  return [
    ...items.filter((item) => item.status === "active"),
    ...tasks.filter((task) => task.status === "todo" || task.status === "doing"),
  ];
}
