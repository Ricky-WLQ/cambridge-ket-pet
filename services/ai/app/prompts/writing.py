"""Cambridge-spec writing-test system prompts.

Sources (cambridgeenglish.org):
- KET Part 6 (guided email, 25+ words, 3 content points)
- KET Part 7 (picture story, 35+ words; in MVP the 3 pictures are textual
  scene descriptions — real images are Phase 2+)
- PET Part 1 (email response, ~100+ words, 3 content points)
- PET Part 2 (choice: informal letter OR story, ~100+ words)
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.writing import ExamType, WritingTaskType


@dataclass(frozen=True)
class WritingPartSpec:
    label: str
    cefr: str
    task_type: WritingTaskType
    brief: str
    min_words: int
    exam_point_id: str
    content_points_needed: int
    scene_descriptions_needed: int
    specific_rules: list[str]


PART_SPECS: dict[tuple[ExamType, int], WritingPartSpec] = {
    ("KET", 6): WritingPartSpec(
        label="KET Reading & Writing Part 6",
        cefr="A2",
        task_type="EMAIL",
        brief="Write a short guided email in response to a simple scenario.",
        min_words=25,
        exam_point_id="KET.RW.P6",
        content_points_needed=3,
        scene_descriptions_needed=0,
        specific_rules=[
            "Provide EXACTLY 3 content points (5-10 words each) that the student must include.",
            "Each content point is a concrete action/question in English, e.g. 'Say when you'll arrive', 'Ask what to bring', 'Thank them for the invitation'.",
            "Scenarios: school trips, birthday invitations, replying to friends, arranging meetings, asking family to do something.",
            "`prompt` describes WHO the student writes to and WHY in 2-3 short sentences.",
            "`scene_descriptions` MUST be an empty array.",
            "`min_words` MUST be exactly 25.",
        ],
    ),
    ("KET", 7): WritingPartSpec(
        label="KET Reading & Writing Part 7",
        cefr="A2",
        task_type="PICTURE_STORY",
        brief="Write a short story based on 3 pictures (described in text for MVP).",
        min_words=35,
        exam_point_id="KET.RW.P7",
        content_points_needed=0,
        scene_descriptions_needed=3,
        specific_rules=[
            "Provide EXACTLY 3 scene descriptions (15-25 words each) — they replace the actual exam pictures.",
            "The 3 scenes must form a clear beginning / middle / end sequence.",
            "Topics familiar to K-12 students (school, friends, pets, a funny mishap, a surprise, etc.)",
            "`prompt` is a short instruction like 'Look at the three pictures below. Write the story shown in the pictures.'",
            "`content_points` MUST be an empty array.",
            "`min_words` MUST be exactly 35.",
        ],
    ),
    ("PET", 1): WritingPartSpec(
        label="PET Writing Part 1",
        cefr="B1",
        task_type="EMAIL",
        brief="Reply to an email, covering 3 content points, in about 100 words.",
        min_words=100,
        exam_point_id="PET.W.P1",
        content_points_needed=3,
        scene_descriptions_needed=0,
        specific_rules=[
            "Provide EXACTLY 3 content points (5-10 words each) the student's reply must address.",
            "`prompt` MUST include the email TO WHICH the student is replying (30-60 words inline). Follow it with a blank line and then the reply instruction.",
            "Example content points: 'Thank him for inviting you', 'Explain why you can't come on Saturday', 'Suggest another day'.",
            "Topics: invitations, school events, travel plans, replying to a pen-pal, asking for information.",
            "`scene_descriptions` MUST be an empty array.",
            "`min_words` MUST be exactly 100.",
        ],
    ),
    ("PET", 2): WritingPartSpec(
        label="PET Writing Part 2",
        cefr="B1",
        task_type="LETTER_OR_STORY",
        brief="Give the student a choice between an informal letter OR a story, ~100 words.",
        min_words=100,
        exam_point_id="PET.W.P2",
        content_points_needed=0,
        scene_descriptions_needed=0,
        specific_rules=[
            "`prompt` MUST present TWO clearly labeled options (A) and (B) in ONE string:",
            "  Option (A) is an informal letter task: brief scenario (~20 words) where the student writes to an English-speaking friend.",
            "  Option (B) is a story task with EITHER a required first sentence OR a required title (~15 words).",
            "Format example:\\n\\nChoose ONE of the following tasks.\\n\\n(A) You recently visited an interesting place. Write an email to your English friend telling them about your visit.\\n\\n(B) Your English teacher has asked you to write a story. The story must begin with this sentence: 'As soon as I opened the door, I knew something was different.'",
            "`content_points` MUST be an empty array; `scene_descriptions` MUST be an empty array.",
            "`min_words` MUST be exactly 100.",
        ],
    ),
}


class UnsupportedWritingPart(ValueError):
    """Raised when we don't have a spec for (exam_type, part) as a Writing part."""


def build_system_prompt(exam_type: ExamType, part: int) -> str:
    spec = PART_SPECS.get((exam_type, part))
    if spec is None:
        raise UnsupportedWritingPart(
            f"No writing spec registered for {exam_type} Part {part}"
        )

    rules_block = "\n".join(f"- {r}" for r in spec.specific_rules)

    return f"""You are an expert Cambridge English exam item writer for {exam_type} (CEFR {spec.cefr}).
Your only job is to produce writing practice tasks that are STRICTLY CONSISTENT with the real Cambridge exam format.

Current task: generate a {spec.label} practice task.

Task-type: "{spec.task_type}".
Brief: {spec.brief}

Part-specific rules:
{rules_block}

Global rules:
- Vocabulary MUST be at CEFR {spec.cefr} level. Avoid higher-level words.
- Topics should be familiar to Chinese K-12 students (school, family, food, travel, hobbies, technology, daily life).
- Set `exam_point_id` = "{spec.exam_point_id}".
- Use natural, idiomatic English; keep the scenario practical and concrete.
- Return JSON matching the provided schema EXACTLY. No preamble, no Markdown fences, no commentary outside the JSON.
"""
