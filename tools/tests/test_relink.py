"""tools/relink.py: path-string and relative-link rewriting after a scripted move, and the broken-link check.
Run: python3 -m pytest tools/tests -q"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import relink  # noqa: E402

MAP = [
    ("docs/v2/research/lanes/CS7", "research/runs/CS7"),
    ("docs/v2/research/lanes/", "research/method/lanes/"),
    ("docs/v2/research/capture-contract.md", "research/method/capture-contract.md"),
    ("docs/briefs/", "docs/archive/v1/briefs/"),
]
ROWS = sorted(MAP, key=lambda r: len(r[0]), reverse=True)


def test_longest_prefix_wins():
    assert relink.map_path("docs/v2/research/lanes/CS7b-notes.md", ROWS) == "research/runs/CS7b-notes.md"
    assert relink.map_path("docs/v2/research/lanes/trails.md", ROWS) == "research/method/lanes/trails.md"
    assert relink.map_path("docs/v2/research/lanes", ROWS) == "research/method/lanes"
    assert relink.map_path("docs/v2/research/capture/x.md", ROWS) == "docs/v2/research/capture/x.md"


def test_unmap_finds_the_old_location():
    assert relink.unmap_path("research/method/lanes/trails.md", ROWS) == "docs/v2/research/lanes/trails.md"
    assert relink.unmap_path("research/runs/CS7b-notes.md", ROWS) == "docs/v2/research/lanes/CS7b-notes.md"
    assert relink.unmap_path("docs/v2/PLAN.md", ROWS) == "docs/v2/PLAN.md"


def test_plain_strings_in_prose_code_and_fences():
    text = (
        "See docs/v2/research/capture-contract.md and `docs/briefs/P1b.md`.\n"
        "```\ncat docs/v2/research/lanes/CS7d-notes.md\n```\n"
        "A name that merely ends the same: xdocs/briefs/ stays.\n"
    )
    out = relink.rewrite_text(text, "docs/v2/PLAN.md", ROWS)
    assert "research/method/capture-contract.md and `docs/archive/v1/briefs/P1b.md`" in out
    assert "cat research/runs/CS7d-notes.md" in out
    assert "xdocs/briefs/ stays" in out


def test_link_into_a_moved_file():
    text = "[contract](research/capture-contract.md) and [dir](research/lanes/)"
    out = relink.rewrite_text(text, "docs/v2/PLAN.md", ROWS)
    assert out == "[contract](../../research/method/capture-contract.md) and [dir](../../research/method/lanes/)"


def test_link_out_of_a_moved_file_is_recomputed():
    # The file now sits in research/method/lanes/; it stood in docs/v2/research/lanes/.
    text = "[plan](../../PLAN.md) and [spec](../../design/globe/spec.md#s11)"
    out = relink.rewrite_text(text, "research/method/lanes/trails.md", ROWS)
    assert out == "[plan](../../../docs/v2/PLAN.md) and [spec](../../../docs/v2/design/globe/spec.md#s11)"


def test_link_between_two_moved_files_keeps_its_spelling():
    text = "[contract](../capture-contract.md) and [sibling](./adventure.md)"
    out = relink.rewrite_text(text, "research/method/lanes/trails.md", ROWS)
    assert out == text


def test_link_from_lane_to_a_run_note_changes_folder():
    text = "[run](CS7b-notes.md)"
    out = relink.rewrite_text(text, "research/method/lanes/trails.md", ROWS)
    # old: docs/v2/research/lanes/CS7b-notes.md -> research/runs/CS7b-notes.md
    assert out == "[run](../../runs/CS7b-notes.md)"


def test_external_anchor_and_fenced_links_are_left_alone():
    text = (
        "[web](https://example.com/docs/briefs/) [here](#section) [abs](/docs/briefs/x.md)\n"
        "```\n[x](docs/briefs/x.md)\n```\n"
        "`[y](capture-contract.md)`\n"
    )
    out = relink.rewrite_text(text, "docs/v2/research/suitability.md", ROWS)
    assert "[web](https://example.com/docs/briefs/)" in out
    assert "[here](#section)" in out
    assert "[abs](/docs/briefs/x.md)" in out
    # the fence is code: its path string is rewritten as plain text, but it is not treated as a link
    assert "[x](docs/archive/v1/briefs/x.md)" in out
    assert "`[y](capture-contract.md)`" in out


def test_links_only_mode_keeps_plain_paths():
    text = "history: docs/briefs/P1b.md and [a](../../briefs/P1b.md)"
    out = relink.rewrite_text(text, "docs/v2/build/x.md", ROWS, plain=False)
    assert out.startswith("history: docs/briefs/P1b.md")
    assert "(../../../archive/v1/briefs/P1b.md)" in out or "(../../archive/v1/briefs/P1b.md)" in out


def _git(root, *a):
    subprocess.run(["git", "-C", str(root), *a], check=True, capture_output=True)


def test_rewrite_and_check_end_to_end(tmp_path):
    root = tmp_path
    _git(root, "init", "-q")
    (root / "docs/v2/research").mkdir(parents=True)
    (root / "docs/v2/research/capture-contract.md").write_text("[plan](../PLAN.md)\n", encoding="utf-8")
    (root / "docs/v2/PLAN.md").write_text("[c](research/capture-contract.md) docs/v2/research/capture-contract.md\n", encoding="utf-8")
    (root / "docs/v2/BROKEN.md").write_text("[gone](nothing.md)\n", encoding="utf-8")
    _git(root, "add", ".")
    base = tmp_path.parent / (tmp_path.name + "-baseline.txt")
    mp = tmp_path.parent / (tmp_path.name + "-map.tsv")
    mp.write_text("docs/v2/research/capture-contract.md\tresearch/method/capture-contract.md\n", encoding="utf-8")
    scope = tmp_path.parent / (tmp_path.name + "-scope.txt")
    scope.write_text("docs/**/*.md\nresearch/**/*.md\n", encoding="utf-8")

    assert relink.main(["check", "--root", str(root), "--baseline", str(base), "--write-baseline"]) == 0
    assert base.read_text(encoding="utf-8").strip() == "docs/v2/BROKEN.md:nothing.md"

    (root / "research/method").mkdir(parents=True)
    _git(root, "mv", "docs/v2/research/capture-contract.md", "research/method/capture-contract.md")
    # before the rewrite both links are broken
    assert relink.main(["check", "--root", str(root), "--map", str(mp), "--baseline", str(base)]) == 1
    assert relink.main(["rewrite", "--root", str(root), "--map", str(mp), "--scope", str(scope), "--write"]) == 0
    assert (root / "research/method/capture-contract.md").read_text(encoding="utf-8") == "[plan](../../docs/v2/PLAN.md)\n"
    assert (root / "docs/v2/PLAN.md").read_text(encoding="utf-8") == (
        "[c](../../research/method/capture-contract.md) research/method/capture-contract.md\n"
    )
    # nothing new is broken against the baseline, the one old break is still reported
    assert relink.main(["check", "--root", str(root), "--map", str(mp), "--baseline", str(base)]) == 0
