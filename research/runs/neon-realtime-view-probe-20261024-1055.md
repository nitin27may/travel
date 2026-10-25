# neon-realtime-view-probe — Does any view/authorized query let Realtime read an RLS table?

Run id: `neon-realtime-view-probe-20261024-1055` · lane: db/web blocker · model: Opus

## Question

The prior run (`neon-realtime-rls-20261024-1029`) proved Neon Realtime rejects a subscription whose
sealed query reads a table with RLS **enabled**. The owner's bounded objective is to resolve the live
list **without weakening RLS on the private content table** `planner_draft`. Before accepting any
security deviation, verify the two candidate "supported" escapes by actual behaviour, no claims:

1. A **view** over the RLS base table (both resolution modes: default security-definer and
   `security_invoker = true`) — does Realtime accept it while the base keeps RLS?
2. Re-confirm the base blocker and a non-RLS control on the same endpoint in the same run.

## Method (isolated, reversible, synthetic-only)

A throwaway harness under web/scripts (named `neon-realtime-view-probe`, **run then removed** so it adds no
new undocumented-env line to the separate README env-table debt — the method below fully reproduces
it), run through `with-root-env.mjs` against the configured
**production** branch (Realtime is pinned to the production compute endpoint
`ep-quiet-leaf-…rt…aws.neon.tech`; the child verify branch `br-damp-breeze-b41mtvn5` has no Realtime
endpoint, so Realtime cannot be exercised there). Objects are uniquely suffixed `rtprobe_*_<rand>`,
a pre-flight refuses to run if any such name already exists, and a `finally` drops every object.
Seal on the server (`@neon/realtime/server`), subscribe from the client (`@neon/realtime/client`,
Node 22 global WebSocket) — the exact path the app uses. Each subscription waits ≤12 s for a terminal
state. A separate `rtprobe-cleanup.mjs` confirmed **0** leftover objects after the run.

## Result (reproducible)

| Scenario | Relation | Realtime state |
|---|---|---|
| Control: non-RLS table | `select … from rtprobe_plain where user_id=$1` | **live** (1 row) |
| Base table, RLS on + permissive `using(true)` | `select … from rtprobe_base …` | **error · `upstream_rejected`** |
| **Security-definer view** over the RLS base | `select … from rtprobe_vdef …` | **error · `upstream_rejected`** |
| **Security-invoker view** over the RLS base | `select … from rtprobe_vinv …` | **error · `upstream_rejected`** |

```
{ "plain_noRls":   { "state": "live",  "code": null,               "rows": 1 },
  "base_rls_direct":{ "state": "error", "code": "upstream_rejected","rows": 0 },
  "view_definer":   { "state": "error", "code": "upstream_rejected","rows": 0 },
  "view_invoker":   { "state": "error", "code": "upstream_rejected","rows": 0 } }
```

## Conclusion

**No view or authorized-query shape lets Neon Realtime subscribe while the base table keeps RLS.**
Realtime resolves the view to its base relation and rejects on the base table's RLS flag — the view
"escape" does not exist, in either security mode. This is a current **external** Neon limitation
(Realtime RLS support is pre-GA), not an app- or schema-lane defect. The only relations Realtime
admits are those with `relrowsecurity = false`.

Therefore the choice is strictly:

- **Keep RLS on `planner_draft`** → Realtime cannot read it (directly or via a view). The live path
  must read a **separate non-RLS relation**.
- **Remove/weaken RLS on `planner_draft`** → forbidden by the brief.

The single resolution that preserves RLS on all private draft content is an **invalidation-only
stream**: a non-RLS auxiliary table carrying *no* draft content (only `user_id` + a monotonic
version), bumped by a trigger on `planner_draft`, subscribed by Realtime with a sealed
`where user_id = $1`, after which the client re-fetches drafts through the authenticated,
RLS-scoped read. The non-RLS auxiliary table is a **security-model deviation** (it exposes the set of
active `user_id`s and their change counters to whatever role the trigger/Realtime touches), so it
requires an **explicit owner/coordinator security review before any production application**. Design
and acceptance matrix are written up in `docs/v2/build/public-site/NEON-SETUP.md`
(§ "Blocker resolution: live list without weakening RLS"). **Paused here for that decision.**
