"""Parse a Cambridge KET/PET vocabulary list PDF, emit one JSON line per word.

Each line: {"cambridgeId": str, "word": str, "pos": str, "glossEn": str|None,
            "topics": [str], "source": str}

Strategy:
  * The Cambridge vocab PDFs use a 2-column layout. pdfplumber's
    extract_text() reads top-to-bottom but mixes columns and produces
    non-alphabetical output with example sentences attached to the wrong
    headword. We crop each page into LEFT and RIGHT halves and extract
    each independently to preserve column ordering.
  * A word entry is a line of the form "headword (pos)", optionally
    followed by '•'-prefixed example lines that belong to that headword
    (until the next entry).
  * We stop at the first page where "Appendix 1" appears as a real
    section heading (not a passing mention in the introduction).

Usage:
  python parse-cambridge-pdfs.py --pdf <path> --examType KET --source-url <url>
"""
import argparse
import io
import json
import re
import sys

import pdfplumber

# Force UTF-8 stdout — Cambridge attribution string contains '©' which crashes
# on Windows default GBK/CP936 codec.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# Headword line: starts with lowercase letter or apostrophe (skips section
# letters like "A", "B"), allows letters / spaces / hyphens / apostrophes
# / slashes / dots inside the headword (matching things like "all right/alright",
# "a.m.", "boyfriend/girlfriend", "wear sb out"), then "(pos)".
ENTRY_RE = re.compile(
    r"""
    ^                                # start of line
    ([a-z'][a-zA-Z'\-/\.\s]*?)       # 1: headword
    \s+
    \(([^)]+)\)                      # 2: POS in parens, e.g. (adj), (n & v), (phr v)
    \s*$
    """,
    re.VERBOSE,
)

# Footer line we want to skip when iterating column text.
FOOTER_RE = re.compile(r"©\s*UCLES\b|^Page\s+\d+\s+of\s+\d+|Vocabulary List|Key for\s*Schools")

# Marker that we have left the headword section and entered Appendix 1.
APPENDIX_HEADER_RE = re.compile(r"^\s*Appendix\s+1\b")


def make_cambridge_id(exam: str, headword: str, pos: str) -> str:
    """Stable key e.g. 'ket-act-v', 'pet-have-got-to-modal'.

    Spaces and slashes in pos collapse; multi-word headwords keep dashes.
    """
    h = re.sub(r"[^a-z0-9]+", "-", headword.lower()).strip("-")
    p = re.sub(r"[^a-z0-9]+", "-", pos.lower()).strip("-")
    return f"{exam.lower()}-{h}-{p}"


def iter_column_lines(page, x_start, x_end):
    """Yield non-empty lines of a vertical slice of the page."""
    crop = page.crop((x_start, 0, x_end, page.height))
    text = crop.extract_text() or ""
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if FOOTER_RE.search(line):
            continue
        yield line


def parse_pdf(pdf_path: str, exam: str, source: str):
    seen_ids = set()
    with pdfplumber.open(pdf_path) as pdf:
        in_appendix = False
        for page in pdf.pages:
            if in_appendix:
                break
            # Ordered traversal of left column then right column for this page.
            for x_start, x_end in [(0, page.width / 2), (page.width / 2, page.width)]:
                if in_appendix:
                    break
                pending = None  # the most recently yielded entry — examples attach to it
                for line in iter_column_lines(page, x_start, x_end):
                    if APPENDIX_HEADER_RE.match(line):
                        in_appendix = True
                        break

                    m = ENTRY_RE.match(line)
                    if m:
                        headword = m.group(1).strip()
                        pos = m.group(2).strip()
                        # Skip empty headwords and section letters that snuck through.
                        if not headword or len(headword) == 0:
                            continue
                        cid = make_cambridge_id(exam, headword, pos)
                        if cid in seen_ids:
                            # Duplicate within the wordlist (rare); skip.
                            pending = None
                            continue
                        seen_ids.add(cid)
                        pending = {
                            "cambridgeId": cid,
                            "word": headword,
                            "pos": pos,
                            "glossEn": None,
                            "topics": [],
                            "source": source,
                        }
                        yield pending
                    elif pending is not None and line.startswith("•"):
                        # Example sentence — attach to the previous entry. We
                        # keep only the first example (pdfplumber gave us the
                        # entry already, so we mutate its glossEn in-place).
                        # NOTE: yield-before-mutate means consumers receive
                        # the dict by reference and will see the example. That
                        # is what we want: a single yield per entry, with
                        # glossEn populated by the time stdout flushes if the
                        # caller batches output.
                        if pending.get("glossEn") is None:
                            pending["glossEn"] = line.lstrip("•").strip() or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--examType", required=True, choices=["KET", "PET"])
    ap.add_argument("--source-url", required=True)
    args = ap.parse_args()

    source = f"© UCLES 2025; {args.source_url}"
    # Buffer all entries first so example-sentence mutation finishes before
    # we serialize. The wordlists are small (a few thousand entries).
    entries = list(parse_pdf(args.pdf, args.examType, source))
    for entry in entries:
        print(json.dumps(entry, ensure_ascii=False))


if __name__ == "__main__":
    main()
