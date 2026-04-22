// Difficulty-point (难点) seed data. Cross-paper, cross-skill grammar/vocab
// issues that examiners and Cambridge teacher guides repeatedly cite as
// top sources of lost marks across KET and PET.
//
// `examType` is null when the point applies to both KET and PET.
// Categories: "grammar" | "vocab" | "pronunciation" | "discourse".

export type DifficultyPointSeed = {
  id: string;
  examType: "KET" | "PET" | null;
  code: string;
  label: string;
  descriptionZh: string;
  category: "grammar" | "vocab" | "pronunciation" | "discourse";
};

export const difficultyPoints: DifficultyPointSeed[] = [
  {
    id: "present-perfect-vs-past-simple",
    examType: null,
    code: "present_perfect_vs_past_simple",
    label: "Present Perfect vs Past Simple distinction",
    descriptionZh: "现在完成时 vs 一般过去时的区分",
    category: "grammar",
  },
  {
    id: "phrasal-verbs",
    examType: null,
    code: "phrasal_verbs",
    label: "Phrasal verbs (separable/inseparable, particle placement)",
    descriptionZh: "短语动词（可分离/不可分离、介词位置）",
    category: "grammar",
  },
  {
    id: "prepositions-of-time-place",
    examType: null,
    code: "prepositions_time_place",
    label: "Prepositions of time and place (in/on/at, etc.)",
    descriptionZh: "时间与地点介词 (in/on/at 等)",
    category: "grammar",
  },
  {
    id: "articles",
    examType: null,
    code: "articles",
    label: "Articles (a/an/the/zero article)",
    descriptionZh: "冠词 (a/an/the/零冠词)",
    category: "grammar",
  },
  {
    id: "passive-voice",
    examType: "PET",
    code: "passive_voice",
    label: "Passive voice (formation and agent expression)",
    descriptionZh: "被动语态（构成与施事者表达）",
    category: "grammar",
  },
  {
    id: "question-formation",
    examType: null,
    code: "question_formation",
    label: "Question formation (word order, indirect questions)",
    descriptionZh: "疑问句结构（语序、间接疑问句）",
    category: "grammar",
  },
  {
    id: "collocations",
    examType: null,
    code: "collocations",
    label: "Collocations and fixed expressions",
    descriptionZh: "搭配与固定表达",
    category: "vocab",
  },
  {
    id: "reported-speech",
    examType: "PET",
    code: "reported_speech",
    label: "Reported speech (tense shift, word order)",
    descriptionZh: "间接引语（时态变化、语序）",
    category: "grammar",
  },
  {
    id: "spelling-accuracy",
    examType: null,
    code: "spelling_accuracy",
    label: "Spelling accuracy (especially gap-fill and writing)",
    descriptionZh: "拼写准确性（听力填空与写作）",
    category: "vocab",
  },
  {
    id: "gerunds-vs-infinitives",
    examType: null,
    code: "gerunds_vs_infinitives",
    label: "Gerunds vs infinitives (verb + -ing vs verb + to)",
    descriptionZh: "动名词 vs 动词不定式（verb + -ing vs verb + to）",
    category: "grammar",
  },
];
