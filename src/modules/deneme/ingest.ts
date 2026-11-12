import { z } from "zod";
import type { IngestType } from "@/core/contract/types";
import { addItem } from "./rules";

// Data from outside (Ç3d; docs/06-modul-sozlesmesi.md, "Sunucu zemini"): a record posted to
// /api/ingest/deneme/kayit with a device token. It runs on the server, in the token owner's
// name, and does what the quick add does: the record, its work, its event.
//
// A real module would write the outside source's own id with each record (an upsert), so a
// body sent twice without an Idempotency-Key does not make two; this one keeps it simple.

const KINDS = ["hedef", "aliskanlik", "etkinlik", "antrenman", "odak"] as const;

export const kayitBody = z
  .object({
    title: z.string().trim().min(1).max(120),
    kind: z.enum(KINDS).optional(),
    minutes: z.number().int().min(5).max(600).optional(),
    due_on: z.iso.date().optional(),
  })
  .strict();

export const ingest: IngestType[] = [
  {
    kind: "kayit",
    label: "Kayıt",
    schema: kayitBody,
    async handle(payload, ctx) {
      const body = payload as z.infer<typeof kayitBody>;
      await addItem(ctx, {
        title: body.title,
        kind: body.kind ?? "hedef",
        minutes: body.minutes ?? null,
        due_on: body.due_on ?? null,
      });
    },
  },
];
