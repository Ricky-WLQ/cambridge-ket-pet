# Cambridge KET / PET Exam-Prep

A web app for Chinese K-12 students preparing for Cambridge English **KET** (A2 Key) and **PET** (B1 Preliminary) exams, with teacher monitoring and AI-generated practice tests that are strictly consistent with the real Cambridge exam format, exam points (考点), and difficulty points (难点).

## Status

**Phase 1 — Reading & Writing — in active development.**

Phased rollout:

| Phase | Scope |
|---|---|
| 1 | Reading + Writing (KET + PET), student + teacher, practice + mock, auth, progress, history |
| 2 | Listening (on-demand TTS audio via CosyVoice2; browser TTS fallback) |
| 3 | Speaking (Qwen3.5-Omni realtime, Cambridge 4-criteria rubric) |
| 4 | Vocab + Grammar (seeded from Cambridge A2/B1 official lists) |

Deployment to Zeabur Singapore happens **only after all four phases are complete and validated locally**.

## Structure

```
cambridge-ket-pet/
├── apps/
│   └── web/            # Next.js 15 + React 19 + TS + Tailwind 4 + Prisma
└── services/
    └── ai/             # Python FastAPI + Pydantic AI + DeepSeek
```

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop (for local PostgreSQL)
- Python 3.13+

## Quickstart

See `apps/web/README.md` and `services/ai/README.md` once each service has been scaffolded. UI language: **Simplified Chinese** (`zh-CN`).

## License

Private — all rights reserved.
