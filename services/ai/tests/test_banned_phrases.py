from app.validators._banned_phrases import BANNED_PHRASES, find_banned


def test_banned_phrases_complete():
    expected = {
        "决定通过率",
        "属于低分段",
        "未达标",
        "短板",
        "critical 弱项",
        "moderate 弱项",
        "minor 弱项",
        "请重视",
        "切记",
        "不容忽视",
        "亟待提升",
        "[critical]",
        "[moderate]",
        "[minor]",
    }
    assert set(BANNED_PHRASES) == expected


def test_find_banned_returns_matches():
    text = "Reading 仅 33%，属于低分段，是 critical 弱项。"
    matches = find_banned(text)
    assert "属于低分段" in matches
    assert "critical 弱项" in matches


def test_find_banned_returns_empty_for_clean_text():
    text = "本周加油 → 下周再战"
    assert find_banned(text) == []
