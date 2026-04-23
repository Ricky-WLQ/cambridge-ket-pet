import pytest
from pydantic import ValidationError

from app.schemas.listening import (
    AudioSegment,
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)


def test_audio_segment_pause_has_duration():
    seg = AudioSegment(id="s1", kind="pause", voice_tag=None, duration_ms=5000)
    assert seg.kind == "pause"
    assert seg.voice_tag is None
    assert seg.duration_ms == 5000


def test_audio_segment_speech_has_text_and_voice():
    seg = AudioSegment(
        id="s2",
        kind="question_stimulus",
        voice_tag="S1_male",
        text="What time is the meeting?",
    )
    assert seg.text == "What time is the meeting?"
    assert seg.voice_tag == "S1_male"


def test_listening_part_ket_part1_valid():
    part = ListeningPart(
        part_number=1,
        kind="MCQ_3_PICTURE",
        instruction_zh="为每个问题，选择正确的图片。",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_PICTURE",
                options=[
                    ListeningOption(id="A", image_description="pic A"),
                    ListeningOption(id="B", image_description="pic B"),
                    ListeningOption(id="C", image_description="pic C"),
                ],
                answer="A",
                explanation_zh="...",
                exam_point_id="KET.L.Part1.gist",
            )
            for i in range(1, 6)
        ],
    )
    assert len(part.questions) == 5


def test_listening_response_version_pinned_to_2():
    with pytest.raises(ValidationError):
        ListeningTestResponse(
            version=1,   # type: ignore[arg-type]
            exam_type="KET",
            scope="FULL",
            parts=[],
            cefr_level="A2",
            generated_by="deepseek-chat",
        )
