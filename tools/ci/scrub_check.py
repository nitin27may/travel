"""Scan files that are about to leave the machine (CI artifacts) for secrets and private files (WORKFLOW-EFFICIENCY 4.6 D5; WF-2).

    python3 tools/ci/scrub_check.py PATH [PATH ...]     # files or folders

Exit 0 clean (or nothing to scan), 1 a hit, 2 an error. It FAILS CLOSED: an unreadable file or a bad path is an error, never a pass.
Output names the file and the kind of hit, never the matched text. WF-4 extends this file (summary contract, job-log scanning); the
workflow calls it so the pattern list lives in one place.
Hits: token prefixes (GitHub, npm, AWS, Google API and OAuth, OpenAI-style sk-, Slack, JWT, Neon napi_, Resend re_), a private key
block, a password inside a URL, an email address outside the allowlist, and file names that are env files, cookie jars or key files.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TOKENS = {
    "github token": r"\bgh[pousr]_[A-Za-z0-9]{20,}",
    "github fine-grained token": r"\bgithub_pat_[A-Za-z0-9_]{20,}",
    "npm token": r"\bnpm_[A-Za-z0-9]{30,}",
    "aws key id": r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
    "google api key": r"\bAIza[0-9A-Za-z_-]{30,}",
    "google oauth secret": r"\bGOCSPX-[A-Za-z0-9_-]{10,}",
    "sk- key": r"\bsk-[A-Za-z0-9_-]{20,}",
    "slack token": r"\bxox[abprs]-[A-Za-z0-9-]{10,}",
    "jwt": r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}",
    "neon key": r"\bnapi_[A-Za-z0-9]{20,}",
    "resend key": r"\bre_[A-Za-z0-9_]{20,}",
    "private key": r"-----BEGIN [A-Z ]*PRIVATE KEY",
    "url password": r"://[^/\s:@]+:[^\s@]+@",
}
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})")
EMAIL_DOMAINS_OK = {"example.com", "example.org", "github.com", "users.noreply.github.com", "noreply.github.com", "anthropic.com"}
ASSET_TLDS = {"png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "ico", "woff", "woff2", "css", "js", "ts"}  # icon@2x.png is a file name
BAD_NAMES = re.compile(r"(^|/)(\.env(\..*)?|.*cookie.*|.*\.pem|.*\.p12|id_rsa.*|.*\.keystore)$", re.I)


def scan_text(text: str) -> list[str]:
    hits = [k for k, p in TOKENS.items() if re.search(p, text)]
    for m in EMAIL.finditer(text):
        dom = m.group(1).lower()
        if dom not in EMAIL_DOMAINS_OK and dom.rsplit(".", 1)[-1] not in ASSET_TLDS:
            hits.append("email address")
            break
    return hits


def files_of(p: Path) -> list[Path]:
    return sorted(f for f in p.rglob("*") if f.is_file() or f.is_symlink()) if p.is_dir() else [p]


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: scrub_check.py PATH [PATH ...]", file=sys.stderr)
        return 2
    bad = 0
    n = 0
    for a in argv:
        p = Path(a)
        if not p.exists():
            print(f"scrub_check: nothing at {a}; nothing to upload")
            continue
        for f in files_of(p):
            n += 1
            if BAD_NAMES.search(f.as_posix()):
                print(f"{f}: file name looks like an env file, cookie jar or key")
                bad = 1
                continue
            if f.is_symlink():
                print(f"{f}: symbolic link")
                bad = 1
                continue
            try:
                text = f.read_bytes().decode("utf-8", "replace")
            except OSError as e:
                print(f"{f}: unreadable ({type(e).__name__}); failing closed")
                return 2
            for h in scan_text(text):
                print(f"{f}: {h}")
                bad = 1
    print(f"scrub_check: {n} file(s) scanned" + ("; HITS (nothing is uploaded)" if bad else ", clean"))
    return bad


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
