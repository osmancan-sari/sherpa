import {
  incomingFields,
  mergeProposal,
  parseProposal,
  proposalTarget,
} from "@/core/contract/envelope";
import type { ModuleFacet, ProposalResult, ProposalTarget } from "@/core/contract/types";
import { check, DataError, type Db, type ModuleRow, type Provenance, unwrap } from "@/core/types";
import { stopSessionsOnItem } from "./sessions";

// The only way a module creates work (docs/06-modul-sozlesmesi.md): the core validates the
// envelope, finds the record with the same key, and writes only what may be written.

const TABLE: Record<ProposalTarget, "work_items" | "rhythms" | "blocks"> = {
  work_item: "work_items",
  rhythm: "rhythms",
  block: "blocks",
};

const UNIQUE_VIOLATION = "23505";

/**
 * Told about every stored proposal. The browser registers one that asks the server to estimate
 * the empty judgement fields (`size`); the data layer itself never calls the AI.
 */
export type ProposalListener = (result: ProposalResult) => void;

const listeners = new Set<ProposalListener>();

/** Adds a listener; returns the function that removes it. */
export function onProposal(listener: ProposalListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function told(result: ProposalResult): ProposalResult {
  for (const listener of listeners) {
    try {
      listener(result);
    } catch {
      // A listener's failure never fails the proposal.
    }
  }
  return result;
}

/**
 * Who closed a record is kept next to the other field sources: "user" when the user did it,
 * this mark when the module took its proposal back. Only the module's own closing is undone
 * by a new proposal.
 */
const WITHDRAWN = "module" as const;

type Row = Record<string, unknown> & { id: string; provenance: unknown };

async function findByKey(
  db: Db,
  table: (typeof TABLE)[ProposalTarget],
  moduleId: string,
  key: string,
) {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("module_id", moduleId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new DataError(error.message, error.code);
  return data as Row | null;
}

/** Resolves dependency keys to the ids of the module's work items that exist so far. */
async function resolveDependencies(db: Db, moduleId: string, keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = unwrap(
    await db.from("work_items").select("id, key").eq("module_id", moduleId).in("key", keys),
  );
  return keys.flatMap((key) => rows.filter((row) => row.key === key).map((row) => row.id));
}

/** A new item may be the dependency others were waiting for: fill it in on their side. */
async function resolveDependents(db: Db, moduleId: string, key: string): Promise<void> {
  const waiting = unwrap(
    await db
      .from("work_items")
      .select("id, depends_on_keys")
      .eq("module_id", moduleId)
      .contains("depends_on_keys", [key]),
  );
  for (const item of waiting) {
    const depends_on = await resolveDependencies(db, moduleId, item.depends_on_keys);
    check(await db.from("work_items").update({ depends_on }).eq("id", item.id));
  }
}

/**
 * Creates the work a proposal describes, or updates the record that already carries its key.
 * The same proposal sent twice leaves one record. A field the user changed is kept.
 * `facets` (Ç3e): the module's facet list now; null or absent for a module without facets.
 */
export async function propose(
  db: Db,
  mod: ModuleRow,
  input: unknown,
  facets: readonly ModuleFacet[] | null = null,
): Promise<ProposalResult> {
  const proposal = parseProposal(input, facets);
  const target = proposalTarget(proposal);
  const table = TABLE[target];
  const incoming = incomingFields(proposal, { withFacet: facets !== null });

  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await findByKey(db, table, mod.id, proposal.key);

    // The key belongs to one kind of record for good; a module that changes its mind about
    // the kind has to withdraw the old one under a new key.
    if (!existing) {
      for (const other of Object.values(TABLE).filter((name) => name !== table)) {
        if (await findByKey(db, other, mod.id, proposal.key)) {
          throw new DataError(
            `key "${proposal.key}" already belongs to a record in ${other}; it cannot become a ${target}`,
          );
        }
      }
    }

    const stored = existing
      ? { values: existing, provenance: (existing.provenance ?? {}) as Provenance }
      : null;
    const merged = mergeProposal(stored, incoming);
    const patch: Record<string, unknown> = { ...merged.patch };

    if (target === "work_item" && ("depends_on_keys" in patch || !existing)) {
      patch.depends_on = await resolveDependencies(db, mod.id, proposal.depends_on ?? []);
    }

    if (!existing) {
      const { data, error } = await db
        .from(table)
        .insert({ ...patch, module_id: mod.id, key: proposal.key } as never)
        .select("id")
        .single();
      // Two proposals of the same new key at once: the other one won; go round and update.
      if (error?.code === UNIQUE_VIOLATION && attempt === 0) continue;
      if (error) throw new DataError(error.message, error.code);
      if (target === "work_item") await resolveDependents(db, mod.id, proposal.key);
      return told({
        target,
        id: data.id,
        created: true,
        changed: merged.changed,
        kept: merged.kept,
      });
    }

    // A record the module withdrew comes back when it is proposed again. One the user closed
    // does not: `withdraw` leaves its own mark, and only that mark is undone here.
    const provenance = merged.provenance;
    const closedBy = target === "rhythm" ? provenance.active : provenance.status;
    const closed =
      target === "work_item"
        ? existing.status === "dropped"
        : target === "rhythm"
          ? existing.active === false
          : existing.status === "cancelled";
    if (closed && closedBy === WITHDRAWN) {
      const field = target === "rhythm" ? "active" : "status";
      patch[field] = target === "work_item" ? "active" : target === "rhythm" ? true : "planned";
      delete provenance[field];
      patch.provenance = provenance;
      merged.changed.push(field);
    }

    if (Object.keys(patch).length > 0) {
      check(
        await db
          .from(table)
          .update(patch as never)
          .eq("id", existing.id),
      );
    }
    return told({
      target,
      id: existing.id,
      created: false,
      changed: merged.changed,
      kept: merged.kept,
    });
  }
  throw new DataError(`could not save proposal "${proposal.key}"`);
}

/**
 * Takes a proposal back (its source record is gone). Nothing is deleted: the work item and its
 * open sittings are dropped, the rhythm goes quiet, the block is cancelled. A record that is
 * already finished stays as it is.
 */
export async function withdraw(db: Db, mod: ModuleRow, key: string): Promise<void> {
  const mark = (row: Row, field: string) => ({
    ...((row.provenance ?? {}) as Provenance),
    [field]: WITHDRAWN,
  });

  const item = await findByKey(db, "work_items", mod.id, key);
  if (item) {
    if (item.status !== "done" && item.status !== "dropped") {
      await stopSessionsOnItem(db, item.id);
      check(
        await db
          .from("tasks")
          .update({ status: "dropped" })
          .eq("work_item_id", item.id)
          .in("status", ["todo", "doing", "waiting"]),
      );
      check(
        await db
          .from("work_items")
          .update({ status: "dropped", provenance: mark(item, "status") })
          .eq("id", item.id),
      );
    }
    return;
  }
  const rhythm = await findByKey(db, "rhythms", mod.id, key);
  if (rhythm) {
    if (rhythm.active !== false) {
      check(
        await db
          .from("rhythms")
          .update({ active: false, provenance: mark(rhythm, "active") })
          .eq("id", rhythm.id),
      );
    }
    return;
  }
  const block = await findByKey(db, "blocks", mod.id, key);
  if (block && block.status === "planned") {
    check(
      await db
        .from("blocks")
        .update({ status: "cancelled", provenance: mark(block, "status") })
        .eq("id", block.id),
    );
  }
}
