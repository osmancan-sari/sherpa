import { z } from "zod";

// The module's reader of pasted text (the contract's `extractors`): a list of things to do
// becomes suggested records. The core runs the AI; the module shows the suggestions and adds
// the ones the user keeps.

export const extractedItem = z.object({
  title: z.string().min(1).max(200),
  /** yyyy-MM-dd, or null. */
  due_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  minutes: z.number().int().min(5).max(600).nullable(),
});

export type ExtractedItem = z.infer<typeof extractedItem>;

export const EXTRACTOR = "kayitlar";

export const kayitReader = {
  key: EXTRACTOR,
  version: "1",
  instructions: `The text is a list of things the user wants to do (a note, a message). Each
thing to do is one suggestion: a short Turkish title, its day (due_on, yyyy-MM-dd) if the text
names one, and its length in minutes if the text names one. Leave out greetings and anything that
is not a thing to do.`,
  item: extractedItem,
  max: 20,
};
