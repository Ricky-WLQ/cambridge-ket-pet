# `apps/web/scripts/`

One-off + maintenance scripts run via `pnpm tsx scripts/<name>.ts` from
`apps/web`. All scripts read `apps/web/.env` via `dotenv`.

---

## Phase 4a — vocab seed pipeline

Seed the `Word` table from official Cambridge KET/PET wordlists, then enrich
with Chinese glosses, examples, and pre-rendered Edge-TTS audio.

Run in order — each step is idempotent and gates on the previous step's data:

| # | Script                          | Effect                                                           | Cost / Time          |
|---|---------------------------------|------------------------------------------------------------------|----------------------|
| 1 | `parse-cambridge-pdfs.ts`       | Cambridge PDFs → ~4,624 `Word` rows                              | free, seconds        |
| 2 | `apply-tier-overrides.ts`       | 15 manual editorial CORE picks → `Word.tier`                     | free, instant        |
| 3 | `generate-vocab-glosses.ts`     | DeepSeek → `glossZh` + `example` + `cefrLevel`-derived `tier`    | ~$5-7, ~30-60 min    |
| 4 | `generate-vocab-audio.ts`       | Edge-TTS → R2 → `audioKey` (concurrency 5)                       | free, ~15-20 min     |

Step 3 also requires the AI service to be running locally:

```
cd services/ai && uvicorn app.main:app --port 8001 --reload
```

> Task 12 (Cambridge EVP fetch for IPA + part-of-speech enrichment) was in the
> original plan but was skipped — DeepSeek's `cefrLevel` rating in step 3 covers
> tier derivation more accurately than the EVP frequency band would.

### Re-running

All four scripts are safe to re-run. They filter by:

- `parse-cambridge-pdfs.ts` — upserts on `[examType, cambridgeId]`
- `apply-tier-overrides.ts`  — sets tier on the explicit list
- `generate-vocab-glosses.ts` — only rows where `glossZh = ''`
- `generate-vocab-audio.ts`   — only rows where `audioKey IS NULL`

So if a step partially fails, just re-run the same command — only the missing
rows get re-processed.

### Verifying final state

```
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const total = await p.word.count();
  const glossed = await p.word.count({where: { NOT: { glossZh: '' } }});
  const audio = await p.word.count({where: { audioKey: { not: null } }});
  console.log('total', total, 'glossed', glossed, 'audio', audio);
  await p.\$disconnect();
}
main();
"
```

Expected: `total 4624  glossed 4624  audio 4624`.

---

## Phase 3 — speaking photo seed

| Script                       | Effect                                                  |
|------------------------------|---------------------------------------------------------|
| `fetch-speaking-photos.ts`   | Pull Pexels photos by topic → `apps/web/prisma/data`    |
| `seed-speaking-photos.ts`    | Upload to R2 + insert `SpeakingPhoto` rows              |
