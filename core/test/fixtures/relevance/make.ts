// Regenerates test/fixtures/relevance/{valid,broken}/*.json. Run: node core/test/fixtures/relevance/make.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { doc, rec, rv } from "../../relevance/helpers.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const put = (dir: string, name: string, body: unknown): void => {
  mkdirSync(join(HERE, dir), { recursive: true });
  writeFileSync(join(HERE, dir, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
};

// valid
put("valid", "minimal", doc([rec()]));
put(
  "valid",
  "moraine",
  doc(
    [
      rec({
        ref: "place/moraine-lake",
        qid: "Q1072342",
        draw: "world",
        drawNote: "37 Wikipedia languages; inside the Canadian Rocky Mountain Parks WHS (inherited); shuttle-only access still sells out",
        standing: "top",
        distinction: "rare",
        weather: "better_clear",
        easy: "full",
        easyWay: "place/fenland-loop",
        access: [{ type: "shuttle_only", note: "no private vehicles on Moraine Lake Road" }],
        designations: [
          { type: "unesco_whs", name: "Canadian Rocky Mountain Parks", id: "304", scope: "parent" },
          { type: "national_park", name: "Banff National Park", scope: "parent" },
        ],
      }),
    ],
    { lane: "R2a", trip: "canadian-rockies-2029" },
  ),
);

// broken: one file per error code, each yields that code and no other
const base = () => doc([rec()]);
const withRec = (o: Record<string, unknown>) => doc([{ ...rec(), ...o } as never]);

put("broken", "E_REL_SCHEMA", withRec({ draw: rv("galactic") }));
put("broken", "E_REL_REF", doc([rec({ ref: "place/nowhere" })]));
put("broken", "E_REL_DUP_REF", doc([rec(), rec()]));
put("broken", "E_REL_SRC", withRec({ standing: rv("top", "fixture", "official_info", ["src-9999"]) }));
{
  const d = base() as unknown as { sources: Record<string, unknown>[] };
  delete d.sources[0]!.read;
  put("broken", "E_REL_SRC_READ", d);
}
put("broken", "E_REL_LINK_ONLY_SRC", doc([rec()], { sources: [{ id: "src-0001", url: "https://www.alltrails.com/trail/x", title: "t", publisher: "AllTrails", kind: "community", read: "2026-10-12" }] }));
put("broken", "E_REL_COPIED_RATING", withRec({ why: "Rated 4.8 stars by hikers." }));
put("broken", "E_REL_DRAW_NOTE", withRec({ draw: rv("regional", "locals like it a lot") }));
put("broken", "E_REL_TYPED_DERIVED", withRec({ role: "anchor" }));
put("broken", "E_REL_INHERITED_DESIGNATION", doc([rec({ kind: "trail", designations: [{ type: "unesco_whs", name: "Canadian Rocky Mountain Parks", scope: "own" }] })]));
put("broken", "E_REL_HOUSEHOLD", withRec({ origin: "a private address" }));
put("broken", "E_REL_CLASS", doc([rec({ class_key: "lake/does-not-exist" })]));
put("broken", "E_REL_QID", withRec({ wikidata: rv("Moraine Lake", "by name") }));
put("broken", "E_REL_RANGE", doc([rec({ draw: "regional", peak: { tier: "regional", from: "09-20", to: "10-15", why: "colour" } })]));
