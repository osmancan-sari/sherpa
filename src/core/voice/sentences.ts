// Long text cut into sentences: some browsers stop a long utterance part way.

/** At most this many characters in one piece; a longer sentence is cut at a comma or a space. */
export const MAX_PIECE = 180;

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) ?? [clean];
  const pieces: string[] = [];
  for (const raw of sentences) {
    let sentence = raw.trim();
    while (sentence.length > MAX_PIECE) {
      const window = sentence.slice(0, MAX_PIECE);
      const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(" "));
      const at = cut > MAX_PIECE / 3 ? cut + 1 : MAX_PIECE;
      pieces.push(sentence.slice(0, at).trim());
      sentence = sentence.slice(at).trim();
    }
    if (sentence) pieces.push(sentence);
  }
  return pieces;
}
