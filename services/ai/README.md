# ketpet-ai

Python FastAPI + Pydantic AI service for the Cambridge KET/PET app. Generates and grades practice tests on demand, called internally by the Next.js app over HTTP with a shared-secret Bearer header.

## Current surface (Phase 1, Step 9)

| Method | Path        | Auth          | Purpose                                                |
| ------ | ----------- | ------------- | ------------------------------------------------------ |
| GET    | `/health`   | public        | Liveness (Docker/Zeabur healthcheck).                  |
| GET    | `/ready`    | public        | Booleans: which AI providers are configured.           |
| GET    | `/v1/ping`  | Bearer secret | Verifies Next.js ↔ AI shared-secret handshake.         |

Real generator/grader endpoints land in Step 10+.

## Local development

```bash
cd services/ai
python -m venv .venv
source .venv/Scripts/activate        # Windows bash / Git Bash
# or:    source .venv/bin/activate    # macOS/Linux
pip install --upgrade pip
pip install -e ".[dev]"

# Create a local .env (git-ignored) — copy from the repo-root .env.example
# and fill values as you add provider keys.
uvicorn app.main:app --reload --host :: --port 8000
```

`--host ::` binds IPv6 dual-stack, which matters on Windows where `localhost` resolves to `::1` first. On Linux/Mac `--host 0.0.0.0` is equivalent. Service listens on http://localhost:8000 either way after that.

## Environment variables

See the repo-root `.env.example` for the full list. Relevant to this service:

- `INTERNAL_SHARED_SECRET` — must match the Next.js app's `INTERNAL_AI_SHARED_SECRET`. When set, all `/v1/*` endpoints require a `Bearer` header.
- `DEEPSEEK_API_KEY` — DeepSeek direct API (text generation + writing grading). Used in Step 10+.
- `SILICONFLOW_API_KEY` — SiliconFlow TTS (CosyVoice2). Used in Phase 2 for Listening.
- `DASHSCOPE_API_KEY` — Alibaba DashScope (Qwen3.5-Omni Realtime). Used in Phase 3 for Speaking.

## Docker

```bash
docker build -t ketpet-ai:dev services/ai
docker run --rm -p 8000:8000 --env-file services/ai/.env ketpet-ai:dev
```
