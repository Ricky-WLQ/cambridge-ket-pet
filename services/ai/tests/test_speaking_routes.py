from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app, verify_internal_auth
from app.schemas.speaking import (
    SpeakingPrompts,
    SpeakingExaminerReply,
    SpeakingScore,
    SpeakingWeakPoint,
)


@pytest.fixture
async def client():
    # Bypass Authorization: Bearer <INTERNAL_SHARED_SECRET> in tests.
    # Production still enforces the dependency via the route decorators.
    app.dependency_overrides[verify_internal_auth] = lambda: None
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(verify_internal_auth, None)


@pytest.mark.asyncio
async def test_warmup(client: AsyncClient):
    r = await client.post("/speaking/examiner-warmup")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.asyncio
async def test_generate_happy_path(client: AsyncClient):
    fake = SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {"partNumber": 1, "title": "Interview", "targetMinutes": 3,
             "examinerScript": ["What's your name?"], "coachingHints": "", "photoKey": None},
            {"partNumber": 2, "title": "Photo", "targetMinutes": 5,
             "examinerScript": ["Describe this photo."], "coachingHints": "",
             "photoKey": "speaking/photos/park-01.jpg"},
        ],
    )
    with patch("app.main.generate_speaking_prompts", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/generate", json={
            "level": "KET",
            "photo_briefs": [
                {"key": "speaking/photos/park-01.jpg", "description": "park"},
            ],
        })
    assert r.status_code == 200
    assert r.json()["level"] == "KET"
    assert len(r.json()["parts"]) == 2


@pytest.mark.asyncio
async def test_examiner_turn(client: AsyncClient):
    fake = SpeakingExaminerReply(reply="Where do you live?", advancePart=None, sessionEnd=False)
    with patch("app.main.run_examiner_turn", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/examiner", json={
            "prompts": {
                "level": "KET",
                "initialGreeting": "Hi",
                "parts": [
                    {"partNumber": 1, "title": "Interview", "targetMinutes": 3,
                     "examinerScript": ["What's your name?"], "coachingHints": "", "photoKey": None},
                    {"partNumber": 2, "title": "Photo", "targetMinutes": 5,
                     "examinerScript": ["Describe this photo."], "coachingHints": "",
                     "photoKey": "speaking/photos/park-01.jpg"},
                ],
            },
            "history": [{"role": "user", "content": "My name is Li Wei."}],
            "current_part": 1,
        })
    assert r.status_code == 200
    assert r.json()["reply"] == "Where do you live?"


@pytest.mark.asyncio
async def test_score_happy_path(client: AsyncClient):
    fake = SpeakingScore(
        grammarVocab=3, discourseManagement=3, pronunciation=3, interactive=4,
        overall=3.25, justification="ok",
        weakPoints=[SpeakingWeakPoint(tag="grammar.past_simple",
                                      quote="I go yesterday", suggestion="went")],
    )
    with patch("app.main.score_speaking_attempt", new=AsyncMock(return_value=fake)):
        r = await client.post("/speaking/score", json={
            "level": "KET",
            "transcript": [{"role": "user", "content": "I go yesterday", "part": 1}],
        })
    assert r.status_code == 200
    assert r.json()["overall"] == pytest.approx(3.25)
    assert len(r.json()["weakPoints"]) == 1
