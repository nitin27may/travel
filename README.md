# Travel

Trip plans, a saved-places list and the site that publishes them to https://nks-travel.pages.dev/.

- `legacy/`: the published pages (one folder per trip, plus `globe/`, `locations/` and the `_system/` design system)
- `data/`: structured data (`locations/` store, `reference/`, `schema/`)
- `research/`: raw research, notes and archived plans per trip; never published
- `tools/`: Python tooling (locations, publish, gallery, hooks) and its tests
- `docs/`: plans, reviews, audits and phase briefs

    python3 -m pytest tools/tests -q
    python3 tools/locations.py build --check
    python3 tools/publish.py --dry-run

Platform plan: `docs/PLAN-platform.md`. Working notes for agents: `CLAUDE.md`.
