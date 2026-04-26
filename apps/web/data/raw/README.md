# Source materials — Phase 4 vocab + grammar

This directory holds the raw Cambridge source PDFs and external data
(EVP CSV) used to seed the Word and GrammarTopic tables.

**PDFs are gitignored** — they are © UCLES / © CUPA. Keep them locally
under `data/raw/` for the seed scripts to find.

## Files expected here

| File | Source | Used by | SHA256 |
|---|---|---|---|
| `506886-a2-key-2020-vocabulary-list.pdf` | https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf | parse-cambridge-pdfs.ts | `2abe174d067cd17ffa061cfc4bbbc0e5a55185ac696a5ef8ba49372c753a3ad6` |
| `506887-b1-preliminary-vocabulary-list.pdf` | https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf | parse-cambridge-pdfs.ts | `df5e3c31bb26205c2cfc2e7a94a0171d4f4769d5c1e42a3615fe6aa1b5fdab29` |
| `504505-a2-key-handbook-2020.pdf` | https://www.cambridgeenglish.org/images/504505-a2-key-handbook-2020.pdf | (Slice 4b) | — |
| `168150-b1-preliminary-teachers-handbook.pdf` | https://www.cambridgeenglish.org/Images/168150-b1-preliminary-teachers-handbook.pdf | (Slice 4b) | — |
| `evp-cefr.csv` | englishprofile.org (free registration) | fetch-evp-cefr-tags.ts | — |
| `word-tier-overrides.csv` | hand-curated (IN GIT) | apply-tier-overrides.ts | — |

## Annual refresh runbook

1. Re-download all four PDFs from the URLs above.
2. Compute new SHA256:
   ```
   sha256sum data/raw/*.pdf
   ```
   Update the table above with new hashes.
3. Re-run the seed pipeline (see `apps/web/scripts/README.md`).
4. Spot-check 20 words for unexpected wording changes, especially CORE-tier.
5. Commit the updated SHA256 table.
