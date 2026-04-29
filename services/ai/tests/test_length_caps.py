from app.validators._length_caps import (
    PROFESSIONAL_NARRATIVE_CAP,
    MAX_PRIORITY_ACTIONS,
    MAX_STRENGTHS,
    MAX_WEAKNESSES,
    narrative_cap_for,
)


def test_narrative_cap_ket():
    assert narrative_cap_for("KET") == 90


def test_narrative_cap_pet():
    assert narrative_cap_for("PET") == 110


def test_list_caps():
    assert MAX_STRENGTHS == 2
    assert MAX_WEAKNESSES == 2
    assert MAX_PRIORITY_ACTIONS == 3


def test_professional_cap():
    assert PROFESSIONAL_NARRATIVE_CAP == 160
