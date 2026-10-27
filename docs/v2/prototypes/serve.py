"""Serve the throwaway prototypes. /fonts/ comes from design/redesign/fonts so no font is copied (CLN-5 rule 7).

    python3 docs/v2/prototypes/serve.py [port]    # default 4300, http://127.0.0.1:4300/
"""
import functools
import http.server
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONTS = HERE.parent / "design" / "redesign" / "fonts"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/fonts/"):
            return str(FONTS / clean.removeprefix("/fonts/"))
        return super().translate_path(path)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4300
    handler = functools.partial(Handler, directory=str(HERE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"prototypes on http://127.0.0.1:{port}/")
        srv.serve_forever()
