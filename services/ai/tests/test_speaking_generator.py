from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_generator import generate_speaking_prompts
from app.schemas.speaking import SpeakingPrompts


@pytest.mark.asyncio
async def test_ket_generator_returns_two_parts():
    fake_output = SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina. Let's begin.",
        parts=[
            {
                "partNumber": 1,
                "title": "Interview",
                "targetMinutes": 3,
                "examinerScript": ["What's your name?", "Where do you live?"],
                "coachingHints": "Encourage full sentences.",
                "photoKey": None,
            },
            {
                "partNumber": 2,
                "title": "Photo description",
                "targetMinutes": 5,
                "examinerScript": ["Describe this photo.", "What do you see in the background?"],
                "coachingHints": "Prompt 'what else' if the student stops early.",
                "photoKey": "speaking/photos/park-03.jpg",
            },
        ],
    )

    with patch("app.agents.speaking_generator.run_pydantic_agent", new=AsyncMock(return_value=fake_output)):
        out = await generate_speaking_prompts(
            level="KET",
            photo_briefs=[
                {"key": "speaking/photos/park-03.jpg", "description": "people playing chess in a park"},
            ],
        )

    assert out.level == "KET"
    assert len(out.parts) == 2
    assert out.parts[1].photoKey == "speaking/photos/park-03.jpg"


@pytest.mark.asyncio
async def test_pet_generator_returns_four_parts():
    fake_output = SpeakingPrompts(
        level="PET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {"partNumber": i, "title": f"Part {i}", "targetMinutes": 3,
             "examinerScript": ["q1", "q2"], "coachingHints": "", "photoKey": None}
            for i in range(1, 5)
        ],
    )
    with patch("app.agents.speaking_generator.run_pydantic_agent", new=AsyncMock(return_value=fake_output)):
        out = await generate_speaking_prompts(level="PET", photo_briefs=[])
    assert len(out.parts) == 4
