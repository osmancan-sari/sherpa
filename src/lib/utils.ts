import { createCn } from "cn/config";
import { TOKENS } from "@/core/ui/tokens.gen";

// Class merging that knows Sherpa's design tokens (src/core/ui/tokens.css). Without them the
// merger takes a token it does not know for another group: `text-note` (a size) next to
// `text-ink` (a colour) would be dropped as a second colour. The names come from the tokens'
// mirror, so a new token is known as soon as it exists.

const names = (prefix: string) =>
  Object.keys(TOKENS)
    .filter((name) => name.startsWith(`${prefix}-`) && !name.includes("--"))
    .map((name) => name.slice(prefix.length + 1));

export const cn = createCn({
  extend: {
    theme: {
      color: names("color"),
      text: names("text"),
      radius: names("radius"),
      shadow: names("shadow"),
      blur: names("blur"),
      spacing: names("spacing"),
      tracking: names("tracking"),
    },
  },
});
