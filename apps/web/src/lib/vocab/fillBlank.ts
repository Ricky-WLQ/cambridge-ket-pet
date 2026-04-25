export type FillBlankSegment =
  | { kind: "letter"; letter: string }
  | { kind: "blank"; length: number; answers: string[] };

export interface FillBlankResult {
  word: string;
  segments: FillBlankSegment[];
  answers: string[];
}

export interface FillBlankOptions {
  blankRatio?: number; // 0..1; fraction of letter positions to blank (skips position 0)
  seed?: number;       // deterministic when set
}

/** Mulberry32 — small, deterministic PRNG. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const isLetter = (ch: string) => /^[A-Za-z]$/.test(ch);

export function generateFillBlank(
  word: string,
  opts: FillBlankOptions = {},
): FillBlankResult {
  const blankRatio = opts.blankRatio ?? 0.4;
  const rng = opts.seed === undefined ? Math.random : makeRng(opts.seed);

  // 1. Identify blankable letter positions (alphabetic chars, not position 0).
  const blankable: number[] = [];
  for (let i = 1; i < word.length; i++) {
    if (isLetter(word[i])) blankable.push(i);
  }

  // 2. Pick `target` positions to blank, randomly.
  const target = Math.min(blankable.length, Math.round(blankable.length * blankRatio));
  const blanked = new Set<number>();
  const pool = [...blankable];
  for (let n = 0; n < target && pool.length > 0; n++) {
    const idx = Math.floor(rng() * pool.length);
    blanked.add(pool.splice(idx, 1)[0]);
  }

  // 3. Walk the word; coalesce consecutive blanks into one segment.
  const segments: FillBlankSegment[] = [];
  const answers: string[] = [];
  let i = 0;
  while (i < word.length) {
    if (blanked.has(i)) {
      const startAnswers: string[] = [];
      while (i < word.length && blanked.has(i)) {
        startAnswers.push(word[i].toLowerCase());
        i++;
      }
      segments.push({ kind: "blank", length: startAnswers.length, answers: startAnswers });
      answers.push(...startAnswers);
    } else {
      segments.push({ kind: "letter", letter: word[i] });
      i++;
    }
  }

  return { word, segments, answers };
}
