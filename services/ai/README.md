# `services/ai` — Pydantic AI service

Python FastAPI + Pydantic AI service for the Cambridge KET/PET app. Generates and grades practice tests on demand, and produces teacher-style diagnostics, called internally by the Next.js app over HTTP with a shared-secret Bearer header.

For overall architecture and run order, see the [root README](../../README.md).

## API surface (Phase 1 + Phase 2)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/health` | public | Liveness (Docker/Zeabur healthcheck). |
| GET | `/ready` | public | Booleans: which AI providers are configured. |
| GET | `/v1/ping` | Bearer secret | Auth handshake smoke test. |
| POST | `/v1/reading/generate` | Bearer secret | Fresh KET/PET reading test (validator-enforced format; 3-retry regenerate on validation failure). |
| POST | `/v1/writing/generate` | Bearer secret | Fresh KET/PET writing prompt (content points, word limits, part-specific format). |
| POST | `/v1/writing/grade` | Bearer secret | 4-criteria Cambridge rubric scoring + Chinese feedback + suggestions. |
| POST | `/v1/analysis/student` | Bearer secret | Teacher-style 4-field diagnostic (strengths / weaknesses / priority_actions / narrative_zh). |
| POST | `/v1/listening/generate` | Bearer secret | **Phase 2.** Fresh KET/PET listening test (script + questions + per-segment voice tags). No audio bytes produced here — the Node side handles TTS + ffmpeg + R2. |

All non-health endpoints require `Authorization: Bearer <INTERNAL_SHARED_SECRET>`. When the env var is empty/unset, auth is disabled so curl smoke tests work without the header — set it in any deployed environment.

### `POST /v1/listening/generate`

**Request body** (`ListeningGenerateRequest`):

| Field | Type | Notes |
|---|---|---|
| `exam_type` | `"KET" \| "PET"` | required |
| `scope` | `"FULL" \| "PART"` | required |
| `part` | `int \| null` | required when `scope=PART` (KET 1–5, PET 1–4); ignored when `scope=FULL` |
| `mode` | `"PRACTICE" \| "MOCK"` | default `"PRACTICE"` |
| `seed_exam_points` | `list[str]` | optional exam-point ids to bias generation |

**Response**: `ListeningTestResponse` — the full v2 listening payload (see `app/schemas/listening.py`): parts with `part_number`, `kind`, `instruction_zh`, `preview_sec`, `play_rule`, `audio_script` (per-segment `voice_tag`, `kind`, `text`, `duration_ms`), and per-part `questions`.

**Error codes**:
- `401 Unauthorized` — missing/incorrect `Authorization: Bearer <INTERNAL_SHARED_SECRET>`
- `400 Bad Request` — `scope=PART` without a `part` number
- `422 Unprocessable Entity` — the generator produced content that failed validation 3 times in a row (the validator message is included in the response body)

## Agent details

All agents are Pydantic AI agents backed by `deepseek-chat` (DeepSeek V3.2) via the OpenAI-compatible endpoint at <https://api.deepseek.com/v1>.

- `deepseek-reasoner` (R1) is NOT used — it rejects the `tool_choice` parameter Pydantic AI needs for structured output (verified 2026-04-23).

Every generator is paired with a post-generation validator. If the validator finds issues (wrong item count, missing content points, percentage scores written as "X 分" in the analysis output, invented teacher names, etc.), the agent regenerates up to 3 times, surfacing the prior errors in the retry prompt. After 3 failed attempts the endpoint either returns 422 (generators) or best-effort output (analysis).

## Local development

```bash
cd services/ai
python -m venv .venv
source .venv/Scripts/activate        # Windows bash / Git Bash
# or:    source .venv/bin/activate    # macOS / Linux
pip install --upgrade pip
pip install -e ".[dev]"

# Copy the root .env.example into services/ai/.env and fill keys.
uvicorn app.main:app --reload --host :: --port 8001
```

`--host ::` binds IPv6 dual-stack, which matters on Windows where `localhost` resolves to `::1` first. On Linux/Mac `--host 0.0.0.0` is equivalent. Local port is `8001` to avoid colliding with other Docker projects that bind `8000`; Docker/Zeabur deploys use `8000` (see `Dockerfile`).

## Tests

```bash
cd services/ai && source .venv/Scripts/activate
python -m pytest -q
```

**46 tests** covering:
- Reading validators (12) — per-part item counts, question types, MATCHING passage bank
- Writing validators (17) — content-points count, min-words, part-specific shape rules
- Analysis schemas (4) — request/response Pydantic round-trips
- Analysis validators (13) — percent-as-points misreading, bad 满分 denominators, invented teacher names, rubric-band phrasing allow-listing

No live DeepSeek calls in unit tests — tests run in under 200ms.

### Listening tests (Phase 2)

To run only the listening suites:

```bash
pytest tests/test_listening_*.py
```

These cover the Pydantic schema round-trips (`app/schemas/listening.py`), the KET + PET per-part validators (`app/validators/listening.py` — item counts per part, question-type matching, `audio_script` voice-tag coverage), and the 3-retry regenerate loop on validation failure.

## Environment variables

See the repo-root [`.env.example`](../../.env.example) for the full list. Relevant to this service:

| Key | Purpose |
|---|---|
| `INTERNAL_SHARED_SECRET` | Must match the web app's `INTERNAL_AI_SHARED_SECRET`. Required header for `/v1/*` in non-dev. |
| `DEEPSEEK_API_KEY` | DeepSeek direct API — text generation + grading + analysis. Required. |
| `SILICONFLOW_API_KEY` | Legacy Phase-2 TTS slot. Not used — Phase 2 ships with `node-edge-tts` on the Node side (no Python TTS). |
| `DASHSCOPE_API_KEY` | Phase 3: Qwen3.5-Omni Realtime (Speaking). Not used in Phases 1–2. |

## Docker

```bash
docker build -t ketpet-ai:dev services/ai
docker run --rm -p 8000:8000 --env-file services/ai/.env ketpet-ai:dev
```

## Project structure

```
app/
├── main.py                      # FastAPI entry + bearer auth dependency + route registrations
├── agents/                      # Pydantic AI agents
│   ├── reading.py               # reading test generator
│   ├── writing.py               # writing prompt generator + writing grader
│   ├── analysis.py              # student-analysis agent (retry loop + pre-formatted summary)
│   └── listening_generator.py   # Phase 2 — listening test generator (3-retry regenerate)
├── prompts/                     # System prompts encoding Cambridge exam spec + scoring rules
│   ├── reading.py
│   ├── writing.py
│   ├── analysis.py              # DO/DON'T examples forcing '25%' not '25 分'
│   └── listening.py             # Phase 2 — per-part listening spec + voice-tag conventions
├── schemas/                     # Pydantic request + response models
│   ├── reading.py
│   ├── writing.py
│   ├── analysis.py
│   └── listening.py             # Phase 2 — ListeningTestResponse (mirrors apps/web/src/lib/audio/types.ts)
└── validators/                  # Post-generation format + anti-hallucination validators
    ├── reading.py
    ├── writing.py
    ├── analysis.py
    └── listening.py             # Phase 2 — per-part item counts, question-type matching, script coverage
```

## Smoke test

With the service running, a quick round-trip against the analysis endpoint:

```bash
curl -s -X POST http://localhost:8001/v1/analysis/student \
  -H "Authorization: Bearer $INTERNAL_SHARED_SECRET" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "student_name": "Test",
    "class_name": "smoke",
    "stats": {"total_graded": 1, "avg_score": 60, "best_score": 60, "worst_score": 60},
    "recent_attempts": [
      {"date": "2026-04-23T00:00:00Z", "exam_type": "KET", "kind": "READING", "part": 3, "mode": "PRACTICE", "score": 60}
    ]
  }'
```

Expected: a JSON response with `strengths`, `weaknesses`, `priority_actions`, `narrative_zh` — all in Simplified Chinese, no `25 分（满分 25）`-style misreadings.
