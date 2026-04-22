"""FastAPI entry point for the Cambridge KET/PET AI service.

Responsibilities right now (Phase 1, Step 9):
  * /health  - public liveness probe (Docker/Zeabur healthcheck).
  * /ready   - public readiness probe; reports whether upstream AI providers
               are configured, WITHOUT revealing any secret values.
  * /v1/ping - internal auth smoke test (Bearer shared-secret); will be
               replaced by real generator/grader endpoints in Step 10+.
"""

from __future__ import annotations

import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status

load_dotenv()

INTERNAL_SHARED_SECRET: str = os.environ.get("INTERNAL_SHARED_SECRET", "")

app = FastAPI(
    title="Cambridge KET/PET AI Service",
    version="0.1.0",
    description=(
        "Pydantic-AI-powered generators and graders for KET (A2 Key) and "
        "PET (B1 Preliminary) practice tests. Called internally by the "
        "Next.js app over HTTP with a shared-secret Bearer header."
    ),
)


async def verify_internal_auth(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Require callers to send `Authorization: Bearer <INTERNAL_SHARED_SECRET>`.

    In local dev, if the env var is empty/unset, auth is treated as disabled
    so curl smoke tests don't need the header. In any environment where the
    secret IS set (CI, staging, prod), the header is required and must match.
    """
    if not INTERNAL_SHARED_SECRET:
        return
    expected = f"Bearer {INTERNAL_SHARED_SECRET}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal shared secret",
        )


@app.get("/health")
def health() -> dict[str, str]:
    """Public liveness probe."""
    return {"status": "ok", "service": "ketpet-ai", "version": app.version}


@app.get("/ready")
def ready() -> dict[str, object]:
    """Public readiness probe. Booleans only — never leaks key values."""
    return {
        "status": "ready",
        "providers": {
            "deepseek": bool(os.environ.get("DEEPSEEK_API_KEY")),
            "siliconflow": bool(os.environ.get("SILICONFLOW_API_KEY")),
            "dashscope": bool(os.environ.get("DASHSCOPE_API_KEY")),
        },
        "internal_auth_enabled": bool(INTERNAL_SHARED_SECRET),
    }


@app.get("/v1/ping", dependencies=[Depends(verify_internal_auth)])
def ping() -> dict[str, str]:
    """Authenticated ping — verifies the Next.js <-> AI shared-secret
    handshake works end-to-end. Real endpoints replace this in Step 10+."""
    return {"pong": "ketpet-ai"}
