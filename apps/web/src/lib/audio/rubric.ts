/**
 * Verbatim Cambridge rubric phrases.
 *
 * Source: KET + PET 2020 official sample tape scripts. These MUST
 * never be AI-generated — the listening_generator agent is explicitly
 * instructed to not invent them.
 */
export const RUBRIC = {
  ket: {
    opening:
      "Cambridge English, Key English Test for Schools – Listening. Sample Test. There are five parts to the test. You will hear each piece twice.",
    partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
    repeatCue: "Now listen again.",
    partEnd: (n: number) => `That is the end of Part ${n}.`,
    transferStart: "You now have six minutes to write your answers on the answer sheet.",
    oneMinuteWarn: "You have one more minute.",
    closing: "That is the end of the test.",
  },
  pet: {
    opening:
      "Cambridge English, Preliminary English Test, Listening. Sample Test. There are four parts to the test. You will hear each part twice.",
    partIntro: (n: number) => `Now look at the instructions for Part ${n}.`,
    repeatCue: "Now listen again.",
    partEnd: (n: number) => `That is the end of Part ${n}.`,
    transferStart: "You now have six minutes to write your answers on the answer sheet.",
    oneMinuteWarn: "You have one more minute.",
    closing: "That is the end of the test.",
  },
} as const;
