"""User agents name the project and the public site, never an email address (research/README.md section 9, ORPH-7).

A run once sent the owner's email address to Wikidata in its User-Agent header: the method page told researchers to give "a
descriptive user agent with a contact". These tests pin both halves: no user-agent string in the code holds an address, and no
method or agent page asks for a contact in the user agent.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

CODE_DIRS = ["core/src", "core/bin", "tools", "web/scripts", "web/lib"]
CODE_SUFFIXES = {".ts", ".mts", ".mjs", ".js", ".py", ".sh"}
SKIP_PARTS = {"node_modules", ".cache", "test", "tests", "__pycache__"}

# a product token with a version and a comment, the shape every user agent here has: name/1.0 (...)
UA_LITERAL = re.compile(r"""["'`]([A-Za-z][\w.-]*/\d+(?:\.\d+)*\s*\([^"'`]*\))["'`]""")
# a header or constant that sets a user agent, with whatever string follows on the line
UA_ASSIGN = re.compile(r"""(?i)(user[-_]?agent|\bUA\b)[^\n]*?["'`]([^"'`\n]+)["'`]""")
EMAIL = re.compile(r"[\w.%+-]+@[\w-]+(?:\.[\w-]+)+|mailto:", re.I)

DOC_GLOBS = ["research/README.md", "research/tools.md", "research/method/**/*.md", ".claude/agents/*.md", ".claude/skills/*/SKILL.md"]
CONTACT_ASK = re.compile(r"(?i)user[\s-]?agent[^.\n]{0,40}\bwith (?:a|an|your) (?:contact|e-?mail)")


def code_files() -> list[Path]:
    out: list[Path] = []
    for d in CODE_DIRS:
        base = ROOT / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.is_file() and p.suffix in CODE_SUFFIXES and not (SKIP_PARTS & set(p.relative_to(ROOT).parts)):
                out.append(p)
    return out


def user_agents(text: str) -> list[str]:
    found = [m.group(1) for m in UA_LITERAL.finditer(text)]
    found += [m.group(2) for m in UA_ASSIGN.finditer(text)]
    return found


def test_the_scanner_finds_the_reference_user_agent() -> None:
    text = (ROOT / "core/src/relevance/signals.ts").read_text(encoding="utf-8")
    assert "travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)" in user_agents(text)


def test_the_scanner_catches_an_email_in_a_user_agent() -> None:
    # the address is joined at run time so this file's own source lines carry no address for web/tests/globe/ua.test.ts to find
    at = "someone" + "@" + "example.org"
    planted = 'UA = {"User-Agent": "travel-capture/1.0 (' + at + ')"}\n'
    assert any(EMAIL.search(ua) for ua in user_agents(planted))
    planted_ts = "const UA = 'travel-thing/1.0 (mailto:" + at + ")';\n"
    assert any(EMAIL.search(ua) for ua in user_agents(planted_ts))


def test_no_user_agent_in_the_code_holds_an_email_address() -> None:
    bad = []
    for p in code_files():
        text = p.read_text(encoding="utf-8", errors="replace")
        for ua in user_agents(text):
            if EMAIL.search(ua):
                bad.append(f"{p.relative_to(ROOT)}: {ua}")
    assert not bad, "user agents must name the project and the public site, never an email:\n" + "\n".join(bad)


def test_the_contact_ask_is_caught() -> None:
    assert CONTACT_ASK.search("a descriptive user agent with a contact; caches for every fetched page")
    assert not CONTACT_ASK.search("a user agent that names the project and the public site, never an email address")


def test_no_method_page_asks_for_a_contact_in_the_user_agent() -> None:
    bad = []
    for g in DOC_GLOBS:
        for p in ROOT.glob(g):
            # the wording is wrapped across lines in Markdown, so read each paragraph as one line
            text = re.sub(r"\s*\n\s*", " ", p.read_text(encoding="utf-8"))
            for m in CONTACT_ASK.finditer(text):
                bad.append(f"{p.relative_to(ROOT)}: ...{m.group(0)}...")
    assert not bad, "a page asks for a contact in the user agent; say: the project name and the public site, never an email:\n" + "\n".join(bad)
