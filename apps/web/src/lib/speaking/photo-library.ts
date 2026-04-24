/**
 * Curated R2 photo library for Phase 3 Speaking Part 2 prompts.
 * The manifest is bundled at build time (no R2 round-trip for lookup);
 * the underlying JPEGs are uploaded once by scripts/seed-speaking-photos.ts.
 */

export type SpeakingPhotoLevel = "KET" | "PET";

export interface SpeakingPhotoEntry {
  key: string;
  levels: SpeakingPhotoLevel[];
  tags: string[];
  description: string;
}

export const PHOTO_LIBRARY_MANIFEST: readonly SpeakingPhotoEntry[] = [
  // --- KET-weighted (daily-life, family, school, hobbies, food, travel-short) ---
  { key: "speaking/photos/daily-life-01.jpg", levels: ["KET"], tags: ["daily-life", "kitchen"], description: "A family eating breakfast together at a kitchen table." },
  { key: "speaking/photos/daily-life-02.jpg", levels: ["KET"], tags: ["daily-life", "market"], description: "A customer buying fresh fruit at a local market stall." },
  { key: "speaking/photos/family-01.jpg", levels: ["KET"], tags: ["family", "outdoors"], description: "Three generations of a family walking in a park." },
  { key: "speaking/photos/school-01.jpg", levels: ["KET"], tags: ["school", "classroom"], description: "Primary-school students raising hands in a classroom." },
  { key: "speaking/photos/school-02.jpg", levels: ["KET"], tags: ["school", "library"], description: "A student reading at a school library table." },
  { key: "speaking/photos/hobbies-01.jpg", levels: ["KET"], tags: ["hobbies", "sports"], description: "A teenager practising basketball on an outdoor court." },
  { key: "speaking/photos/hobbies-02.jpg", levels: ["KET"], tags: ["hobbies", "music"], description: "A boy playing an acoustic guitar at home." },
  { key: "speaking/photos/hobbies-03.jpg", levels: ["KET"], tags: ["hobbies", "art"], description: "A girl painting a watercolour on an easel." },
  { key: "speaking/photos/food-01.jpg", levels: ["KET", "PET"], tags: ["food", "cafe"], description: "Friends sharing dessert at a cafe window seat." },
  { key: "speaking/photos/food-02.jpg", levels: ["KET"], tags: ["food", "cooking"], description: "Parent and child cooking pasta together in a home kitchen." },
  { key: "speaking/photos/travel-01.jpg", levels: ["KET", "PET"], tags: ["travel", "beach"], description: "Tourists walking along a sandy beach at sunset." },
  { key: "speaking/photos/travel-02.jpg", levels: ["KET"], tags: ["travel", "city"], description: "A small group taking photos in front of a city landmark." },
  { key: "speaking/photos/pets-01.jpg", levels: ["KET"], tags: ["pets", "home"], description: "A child playing with a golden retriever in a living room." },
  { key: "speaking/photos/shopping-01.jpg", levels: ["KET"], tags: ["shopping", "clothes"], description: "Two teenagers choosing T-shirts in a clothing store." },
  { key: "speaking/photos/weather-01.jpg", levels: ["KET"], tags: ["weather", "rain"], description: "People holding umbrellas while walking on a rainy street." },

  // --- KET + PET shared (balanced) ---
  { key: "speaking/photos/park-01.jpg", levels: ["KET", "PET"], tags: ["park", "daily-life"], description: "Joggers and dog-walkers on a tree-lined park path." },
  { key: "speaking/photos/park-02.jpg", levels: ["KET", "PET"], tags: ["park", "family"], description: "A family having a picnic on a grassy hillside." },
  { key: "speaking/photos/park-03.jpg", levels: ["KET", "PET"], tags: ["park", "hobbies"], description: "An elderly couple playing chess at a park table." },
  { key: "speaking/photos/transport-01.jpg", levels: ["KET", "PET"], tags: ["transport", "city"], description: "Commuters waiting at a busy subway platform." },
  { key: "speaking/photos/transport-02.jpg", levels: ["KET", "PET"], tags: ["transport", "bicycle"], description: "Cyclists riding in a dedicated bike lane through a city." },
  { key: "speaking/photos/work-01.jpg", levels: ["PET"], tags: ["work", "office"], description: "Colleagues collaborating over a laptop in an open-plan office." },
  { key: "speaking/photos/work-02.jpg", levels: ["PET"], tags: ["work", "hands-on"], description: "A chef plating dishes at a restaurant pass." },

  // --- PET-weighted (choices, opinions, collaboration scenarios) ---
  { key: "speaking/photos/choice-gifts-01.jpg", levels: ["PET"], tags: ["collaborative", "gifts"], description: "Four different birthday gifts arranged on a table: book, headphones, scarf, plant." },
  { key: "speaking/photos/choice-gifts-02.jpg", levels: ["PET"], tags: ["collaborative", "gifts"], description: "Four different graduation gifts arranged on a desk: watch, wallet, camera, voucher." },
  { key: "speaking/photos/choice-trip-01.jpg", levels: ["PET"], tags: ["collaborative", "travel"], description: "Four holiday-option postcards: beach, mountain, city, countryside." },
  { key: "speaking/photos/choice-weekend-01.jpg", levels: ["PET"], tags: ["collaborative", "free-time"], description: "Four weekend-activity icons: cinema, museum, hiking, shopping." },
  { key: "speaking/photos/choice-club-01.jpg", levels: ["PET"], tags: ["collaborative", "school"], description: "Four after-school club posters: drama, coding, football, environment." },
  { key: "speaking/photos/choice-food-01.jpg", levels: ["PET"], tags: ["collaborative", "food"], description: "Four lunch-option photos: salad, sandwich, noodles, rice bowl." },
  { key: "speaking/photos/opinion-tech-01.jpg", levels: ["PET"], tags: ["opinion", "technology"], description: "Teenagers using smartphones at a coffee shop, laptops closed." },
  { key: "speaking/photos/opinion-environment-01.jpg", levels: ["PET"], tags: ["opinion", "environment"], description: "Volunteers sorting recyclables at a community drop-off centre." },
  { key: "speaking/photos/opinion-health-01.jpg", levels: ["PET"], tags: ["opinion", "health"], description: "A group taking an outdoor fitness class in a park." },
  { key: "speaking/photos/opinion-media-01.jpg", levels: ["PET"], tags: ["opinion", "media"], description: "A family watching a film together on a home TV." },
  { key: "speaking/photos/opinion-learning-01.jpg", levels: ["PET"], tags: ["opinion", "education"], description: "Students attending an online class from their bedrooms." },

  // --- Extra PET depth (doubles up capacity on common topic tags) ---
  { key: "speaking/photos/work-03.jpg", levels: ["PET"], tags: ["work", "creative"], description: "A designer sketching on a drawing tablet at a home studio." },
  { key: "speaking/photos/travel-03.jpg", levels: ["PET"], tags: ["travel", "airport"], description: "Passengers queuing at an airport check-in counter with luggage." },
  { key: "speaking/photos/travel-04.jpg", levels: ["PET"], tags: ["travel", "mountain"], description: "Hikers resting on a ridge overlooking a mountain valley." },
  { key: "speaking/photos/city-01.jpg", levels: ["PET"], tags: ["city", "evening"], description: "Pedestrians on a busy downtown street at dusk." },
  { key: "speaking/photos/city-02.jpg", levels: ["PET"], tags: ["city", "market"], description: "A night market with food stalls and crowds." },
  { key: "speaking/photos/sports-01.jpg", levels: ["PET"], tags: ["sports", "team"], description: "A youth football team celebrating a goal." },
  { key: "speaking/photos/sports-02.jpg", levels: ["PET"], tags: ["sports", "individual"], description: "A swimmer mid-stroke in an outdoor pool." },
  { key: "speaking/photos/volunteer-01.jpg", levels: ["PET"], tags: ["community", "volunteer"], description: "Volunteers serving meals at a community kitchen." },
  { key: "speaking/photos/home-01.jpg", levels: ["KET", "PET"], tags: ["home", "living-room"], description: "A modern living room with a reading nook." },
  { key: "speaking/photos/home-02.jpg", levels: ["KET", "PET"], tags: ["home", "bedroom"], description: "A teenager's bedroom decorated with posters and books." },
  { key: "speaking/photos/event-01.jpg", levels: ["PET"], tags: ["event", "concert"], description: "An outdoor summer concert with a cheering crowd." },
  { key: "speaking/photos/event-02.jpg", levels: ["PET"], tags: ["event", "festival"], description: "A local food festival with stalls and families sitting on benches." },
  { key: "speaking/photos/nature-01.jpg", levels: ["PET"], tags: ["nature", "forest"], description: "Sunlight through pine trees in a quiet forest clearing." },
  { key: "speaking/photos/nature-02.jpg", levels: ["PET"], tags: ["nature", "river"], description: "People kayaking on a calm river at midday." },
  { key: "speaking/photos/reading-01.jpg", levels: ["KET", "PET"], tags: ["reading", "library"], description: "A reader absorbed in a book at a public library." },
  { key: "speaking/photos/technology-01.jpg", levels: ["KET", "PET"], tags: ["technology", "home"], description: "A family video-calling grandparents from a kitchen laptop." },
];

function filterByLevel(level: SpeakingPhotoLevel): SpeakingPhotoEntry[] {
  return PHOTO_LIBRARY_MANIFEST.filter((p) => p.levels.includes(level));
}

export function pickPhotoKeys(args: {
  level: SpeakingPhotoLevel;
  topic?: string;
  count: number;
  seed?: number;
}): string[] {
  const { level, topic, count } = args;
  const byLevel = filterByLevel(level);
  if (byLevel.length < count) {
    throw new Error(
      `photo-library: not enough photos for level ${level} (have ${byLevel.length}, need ${count})`,
    );
  }

  const candidates = topic
    ? byLevel.filter((p) => p.tags.includes(topic))
    : byLevel;

  // Fallback to any-level entries if the topic bucket is too small.
  const pool = candidates.length >= count ? candidates : byLevel;

  // Deterministic, seed-lite shuffle so tests are reproducible when a seed is passed.
  const rng = args.seed != null
    ? mulberry32(args.seed)
    : Math.random;
  const shuffled = [...pool].sort(() => rng() - 0.5);

  return shuffled.slice(0, count).map((p) => p.key);
}

/** Tiny deterministic PRNG for seeded shuffles in tests. */
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
