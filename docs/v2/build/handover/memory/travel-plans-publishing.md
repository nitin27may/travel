---
name: travel-plans-publishing
description: Trip plans live in ~/workspace/travel/<slug>/index.html and publish together to nks-travel.pages.dev via ./publish.sh
metadata: 
  node_type: memory
  type: project
  originSessionId: 96b7443c-a15b-4041-ba05-1f9eee014ed3
  modified: 2026-08-24T01:30:36.164Z
---

Travel itineraries are authored as one self-contained `index.html` per trip in `~/workspace/travel/<slug>/`, and published together to the Cloudflare Pages project **nks-travel** (`https://nks-travel.pages.dev`). Each trip gets its own URL at `/<slug>/`; the site root is an auto-generated hub page listing every trip.

**Why:** Nitin wants many trip plans on ONE Pages site with separate URLs, not a Pages project per trip. `~/workspace/travel/publish.sh` rebuilds `.site/` from every folder containing an index.html, regenerates the hub (pulling each page's `<title>` and `.sub` text), and deploys.

**How to apply:** never create a new Pages project per trip — add the folder, then run `cd ~/workspace/travel && ./publish.sh`. Cloudflare auth on nks-ubuntu is an OAuth token obtained with `wrangler login --device`; the default localhost:8976 callback flow FAILS here because Nitin approves on his phone (phone's localhost is not the desktop's, plus a CSRF cookie error), so always use `--device`. `--use-keyring` needs `libsecret-tools`, which is not installed. Related: [[vermont-fall-2026-trip]].
