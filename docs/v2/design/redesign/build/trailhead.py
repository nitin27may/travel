"""Direction C, Trailhead: the live site's forest-and-amber look, refined into an app.

Kept from https://nks-travel.pages.dev: the dark header with the amber rule, amber accent, Big Shoulders signpost titles, Source Serif 4
for prose, IBM Plex Mono for labels and numbers, photo cards with countdown chips, filter pills, group and sort,
four views on one data set, table tools and honesty markers. Changed: the forest green palette is gone (owner, 18 Oct): slate ink, cool stone paper, a navy header, light first. Fixed: amber now means one thing (selected, now,
primary); every trip carries its own identity colour; urgency has its own coral; mono never sets long text.
"""
from __future__ import annotations

import common as C
import data as D
from common import esc, icon

DIR = "trailhead"
MAP = {"dark": "../assets/map-trail-dark.webp", "light": "../assets/map-trail-light.webp"}

CSS = C.fonts_css("Big Shoulders Display", "Source Serif 4", "IBM Plex Mono") + """
:root{--bg:#F5F6F8;--deep:#ECEFF3;--surface:#FFFFFF;--surface2:#E9EDF2;--line:#D8DEE5;--line2:#8C99A8;--ink:#172230;--ink2:#2B3746;--muted:#4D5B6B;
--accent:#D9962B;--accent-ink:#241703;--accent-text:#8A5300;--accent-soft:#FBEFD9;--teal:#0B5B5E;--crit:#A8341F;--crit-fill:#B3402A;--crit-soft:#F9E5E0;--warn:#7A5200;--warn-soft:#FBF0D6;--kicker-on-photo:rgba(244,246,248,.8);
--ok:#1D6B3A;--ok-soft:#E0F0E6;--header:#172230;--header-ink:#F4F6F8;--header-mute:#B8C3CF;--header-line:#3A4A5D;--header-2:#1F2D3D;
--route:#172230;--halo:#FFFFFF;--img:1;--shadow:0 0 0 1px #D8DEE5,0 20px 50px rgba(23,34,48,.16);
--display:'Big Shoulders Display','Arial Narrow',sans-serif;--serif:'Source Serif 4',Georgia,serif;--mono:'IBM Plex Mono',ui-monospace,monospace;color-scheme:light}
[data-theme=dark]{--bg:#0F1620;--deep:#0B1119;--surface:#16202C;--surface2:#1E2A38;--line:#2A3A4C;--line2:#52667B;--ink:#E7ECF1;--ink2:#C9D2DC;--muted:#A3B0BE;
--accent:#D9962B;--accent-ink:#241703;--accent-text:#E8A94A;--accent-soft:#2E2617;--teal:#5CC4C8;--crit:#F28E80;--crit-fill:#C4553D;--crit-soft:#3A2020;--warn:#E0B15C;--warn-soft:#2B2314;--kicker-on-photo:rgba(244,246,248,.8);
--ok:#8FD0A0;--ok-soft:#173025;--header:#0B1119;--header-2:#16202C;--header-line:#3A4A5D;--route:#E7ECF1;--halo:#0F1620;--img:.92;--shadow:0 0 0 1px #2A3A4C,0 20px 50px rgba(0,0,0,.5);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
[data-theme=dark] .tmap .img-light{display:none}:root:not([data-theme=dark]) .tmap .img-dark{display:none}
body{background:var(--bg);color:var(--ink);font:400 16px/1.5 var(--serif);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{display:block;filter:brightness(var(--img))}
.ic{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
.d{font-family:var(--display);font-weight:800;letter-spacing:.005em;line-height:.95}
.m{font-family:var(--mono)}
.lab{font:500 12px/1.3 var(--mono);color:var(--muted)}
.cap{font:600 11.5px/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:8px;border:1px solid var(--line2);background:transparent;color:var(--ink);font:500 13px var(--mono);white-space:nowrap;cursor:pointer}
.btn:hover{border-color:var(--accent-text)}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
.btn.sm{height:30px;padding:0 10px;font-size:12px}
.btn.icon{width:38px;padding:0;justify-content:center}
.pill{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid var(--line2);border-radius:999px;font:500 13px var(--mono);color:var(--ink2);white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border:1px solid var(--line2);border-radius:999px;font:500 11.5px var(--mono);color:var(--ink2);white-space:nowrap}
.chip .ic{width:13px;height:13px}
.chip.acc{border-color:var(--accent);color:var(--accent-text);background:var(--accent-soft)}
.chip.teal{border-color:color-mix(in srgb,var(--teal) 60%,transparent);color:var(--teal)}
.chip.idea{border-style:dashed}
.chip.crit{border-color:var(--crit-fill);color:var(--crit);background:var(--crit-soft)}
.chip.ok{border-color:transparent;color:var(--ok);background:var(--ok-soft)}
.chip.honest{border-style:dashed;border-color:var(--crit-fill);color:var(--crit)}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none;background:var(--tc);box-shadow:0 0 0 1.5px var(--bg)}
/* header */
.hdr{height:60px;display:flex;align-items:center;gap:28px;padding:0 32px;background:var(--header);border-bottom:2px solid var(--accent);position:sticky;top:0;z-index:20;color:var(--header-ink)}
.brand{font:800 24px/1 var(--display);letter-spacing:.02em}
.tabs-g{display:flex;gap:4px;height:100%}
.tabs-g a{display:flex;align-items:center;padding:0 12px;font:500 13.5px var(--mono);color:var(--header-mute);border-bottom:2px solid transparent;margin-bottom:-2px}
.tabs-g a[aria-current]{color:#F4F6F8;border-color:var(--header-ink)}
.hdr .sp{flex:1}
.tsw{display:flex;align-items:center;gap:10px;height:42px;padding:0 12px 0 4px;border:1px solid var(--header-line);border-radius:999px;font:500 13px var(--mono);color:var(--header-ink);background:var(--header-2)}
.tsw img{width:34px;height:34px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--header-2),0 0 0 4.5px var(--tc)}
.tsw b{font:800 18px/1 var(--display);letter-spacing:.01em}
.hdr .btn{color:var(--header-ink);border-color:var(--header-line)}
/* trip bar */
.tbar{position:sticky;top:60px;z-index:15;background:var(--deep);border-bottom:1px solid var(--line);display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;padding:12px 32px 0}
.tbar .who{display:flex;align-items:center;gap:14px;padding-bottom:12px}
.tbar .ph{width:84px;height:56px;border-radius:8px;overflow:hidden;position:relative}
.tbar .ph img{width:100%;height:100%;object-fit:cover}
.tbar .ph:after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--tc)}
.tbar h1{font:800 40px/.9 var(--display)}
.tbar .meta{display:flex;gap:8px;align-items:center;margin-top:6px}
.ttabs{display:flex;gap:2px;align-self:end}
.ttabs a{white-space:nowrap;display:flex;align-items:center;gap:8px;height:46px;padding:0 14px;font:500 13.5px var(--mono);color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.ttabs a span{font-size:11.5px;color:var(--muted)}
.ttabs a[aria-current]{color:var(--ink);border-color:var(--accent)}
.tbar .acts{display:flex;gap:8px;padding-bottom:12px}
/* page */
.wrap{max-width:1376px;margin:0 auto;padding:0 32px}
.ptitle{padding:36px 0 18px;display:flex;align-items:flex-end;gap:24px}
.ptitle h1{font:800 88px/.85 var(--display)}
.ptitle p{font-size:19px;color:var(--ink2);margin-top:12px}
.ptitle .acts{margin-left:auto;display:flex;gap:8px}
.needs{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px 20px 10px;margin-bottom:28px}
.needs .hd{display:flex;align-items:baseline;gap:14px;padding:12px 0 6px}
.needs h2{font:800 30px/1 var(--display)}
.ngrid{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
.ncol{padding:10px 18px 10px 0;border-right:1px solid var(--line)}
.ncol+.ncol{padding-left:18px}
.ncol:last-child{border-right:0}
.nhead{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.nhead img{width:36px;height:36px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px var(--tc)}
.nhead b{font:800 22px/1 var(--display)} .nhead small{display:block;font:500 11.5px var(--mono);color:var(--muted);margin-top:2px}
.nrow{padding:9px 0;border-top:1px solid var(--line)}
.nrow .due{display:flex;gap:8px;align-items:center;font:500 12px var(--mono);color:var(--muted)}
.nrow .due b{color:var(--ink);font-weight:600}
.nrow .due.crit,.nrow .due.crit b{color:var(--crit)}
.nrow .due.warn,.nrow .due.warn b{color:var(--warn)}
.nrow .w{font-weight:600;font-size:16px;line-height:1.3;margin:2px 0}
.nrow .acts{display:flex;gap:6px;margin-top:6px}
.toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:6px 0}
.search{display:flex;align-items:center;gap:10px;height:42px;width:300px;padding:0 12px;border:1px solid var(--line2);border-radius:8px;color:var(--muted);font-size:17px}
.search kbd{margin-left:auto;font:500 12px var(--mono);border:1px solid var(--line2);border-radius:4px;padding:0 6px}
.filters{display:flex;gap:8px;flex-wrap:wrap}
.views{display:inline-flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}
.views a{display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;font:500 13px var(--mono);color:var(--ink2);border-right:1px solid var(--line2)}
.views a:last-child{border:0}
.views a[aria-current]{background:var(--accent);color:var(--accent-ink);font-weight:600}
.subbar{display:flex;align-items:center;gap:12px;padding:8px 0 18px;border-bottom:1px solid var(--line)}
.count{font:800 34px/1 var(--display);color:var(--accent-text)} .count small{font:500 13px var(--mono);color:var(--muted);margin-left:6px}
.subbar .sp{flex:1}
.selbox{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:1px solid var(--line2);border-radius:6px;font:500 12.5px var(--mono);color:var(--ink)}
.ghead{display:flex;align-items:baseline;justify-content:space-between;padding:26px 0 10px;border-bottom:1px solid var(--line);margin-bottom:18px}
.ghead h2{font:800 34px/1 var(--display)}
.ghead span{font:500 12.5px var(--mono);color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card .ph{position:relative;aspect-ratio:16/10;overflow:hidden}
.card .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.card .ph:after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--tc)}
.card .ph .glyph{width:100%;height:100%;display:grid;place-items:center;background:var(--surface2);color:var(--teal);font:500 12px var(--mono)}
.card .in{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h3{font:800 30px/.95 var(--display)}
.card .meta{font:400 12.5px/1.45 var(--mono);color:var(--muted)}
.card .chips{display:flex;gap:6px;flex-wrap:wrap}
.card p{font-size:16px;line-height:1.4;color:var(--ink2)}
.card .next{display:flex;gap:8px;align-items:flex-start;padding-top:10px;margin-top:auto;border-top:1px solid var(--line);font:500 12.5px/1.4 var(--mono);color:var(--ink2)}
.card .next.crit{color:var(--crit)}
.card .next.warn{color:var(--warn)}
.ready{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.ready i{height:4px;border-radius:2px;background:var(--line);position:relative;overflow:hidden}
.ready i b{position:absolute;inset:0 auto 0 0;background:var(--ink2)}
.donecards .card .ph img{filter:saturate(.6) brightness(var(--img))}
.credits{max-width:1376px;margin:0 auto;padding:36px 32px 56px;color:var(--muted);font:400 12px/1.6 var(--mono)}
.credits h2{font:600 11.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.credits ol{columns:2;column-gap:40px;margin:10px 0 0 20px}
.credits a{text-decoration:underline}
/* plan */
.plan{display:grid;grid-template-columns:256px 620px 1fr;height:900px}
.outline{border-right:1px solid var(--line);padding:18px 16px;overflow:hidden;background:var(--deep)}
.ob{display:flex;align-items:center;gap:10px;margin:14px 0 6px}
.ob img,.ob .ni{width:36px;height:28px;border-radius:5px;object-fit:cover;background:var(--surface2);display:grid;place-items:center;color:var(--muted)}
.ob b{font:800 20px/1 var(--display)} .ob span{margin-left:auto;font:500 11.5px var(--mono);color:var(--muted)}
.od{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;height:30px;padding:0 8px;border-radius:6px;font:400 14px var(--serif)}
.od .n{font:600 12.5px var(--mono);color:var(--muted)}
.od .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink2)}
.od .dr{font:500 11.5px var(--mono);color:var(--muted)}
.od .fl{width:6px;height:6px;border-radius:50%;background:var(--crit);display:inline-block;margin-left:4px;vertical-align:middle}
.od[aria-current]{background:var(--surface2)} .od[aria-current] .n{color:var(--accent-text)} .od[aria-current] .t{color:var(--ink);font-weight:600}
.doc{overflow:hidden;padding:20px 32px;border-right:1px solid var(--line)}
.nextb{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font:500 13px var(--mono)}
.nextb .btn{margin-left:auto}
.add{display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border:1px dashed var(--line2);border-radius:10px;color:var(--muted);margin:14px 0 6px;font-size:16px}
.add kbd{margin-left:auto;font:500 12px var(--mono);border:1px solid var(--line2);border-radius:4px;padding:0 6px}
.dcol{display:grid;grid-template-columns:auto 1fr auto auto;gap:14px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)}
.dcol .n{font:600 12.5px var(--mono);color:var(--muted)}
.dcol b{font-weight:600} .dcol small{display:block;font:500 12px var(--mono);color:var(--muted)}
.dcol img{width:60px;height:40px;border-radius:5px;object-fit:cover}
.day{padding:18px 0 6px;border-bottom:1px solid var(--line)}
.sign{display:inline-flex;align-items:center;height:30px;padding:0 14px 0 10px;background:var(--accent);color:var(--accent-ink);font:800 19px/1 var(--display);letter-spacing:.04em;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)}
.sign.quiet{background:var(--surface2);color:var(--ink)}
.dh{display:flex;align-items:center;gap:14px}
.dh h3{font:800 32px/1 var(--display)}
.dsum{display:flex;gap:14px;margin:8px 0 4px;font:500 12.5px var(--mono);color:var(--muted);flex-wrap:wrap}
.dsum span{display:flex;gap:6px;align-items:center}
.it{display:grid;grid-template-columns:20px 50px 26px 1fr 96px;gap:10px;align-items:start;padding:10px 0;border-radius:10px}
.it .gr{color:var(--muted);padding-top:3px}.it .gr .ic{stroke-width:2.8}
.it .t{font:600 13.5px var(--mono);padding-top:3px}
.it .kd{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--surface2);color:var(--teal)}
.it .kd .ic{width:15px;height:15px}
.it h4{font:600 17px/1.25 var(--serif);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.it .im{font:500 12px var(--mono);color:var(--muted);margin-top:2px}
.it .inote{font:italic 400 15.5px/1.4 var(--serif);color:var(--ink2);margin-top:4px}
.it img{width:96px;height:68px;border-radius:8px;object-fit:cover}
.it .noph{width:96px;height:68px;border-radius:8px;background:var(--surface2);display:grid;place-items:center;color:var(--teal)}
.leg{display:flex;align-items:center;gap:8px;margin-left:116px;height:26px;font:500 12px var(--mono);color:var(--muted)}
.it.ghost{background:var(--surface2);box-shadow:var(--shadow);transform:rotate(-.8deg) translateX(14px);padding:10px 12px 10px 0;margin:8px 0 12px}
.it.ghost .gr{color:var(--accent-text)}
.it.from{opacity:.32}
.ins{position:relative;height:0;border-top:2px solid var(--accent);margin:6px 0 4px 30px}
.ins:before,.ins:after{content:'';position:absolute;top:-5px;width:8px;height:8px;border-radius:50%;background:var(--accent)}
.ins:before{left:-4px}.ins:after{right:-4px}
.ins span{position:absolute;left:30px;top:-12px;background:var(--accent);color:var(--accent-ink);font:600 11.5px var(--mono);padding:2px 8px;border-radius:999px}
.mapc{position:relative;overflow:hidden;background:var(--deep)}
.mapc .tmap{position:absolute;inset:0;width:100%;height:100%}
.mtool{position:absolute;left:14px;top:14px;z-index:2;display:flex;gap:8px}
.seg{display:inline-flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg button{border:0;background:none;height:34px;padding:0 12px;font:500 12.5px var(--mono);color:var(--ink2);border-right:1px solid var(--line2);cursor:pointer}
.seg button:last-child{border:0}
.seg button[aria-selected=true]{background:var(--accent);color:var(--accent-ink);font-weight:600}
.mleg{position:absolute;left:14px;bottom:14px;z-index:2;background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:grid;gap:5px;font:500 12px var(--mono)}
.mleg div{display:flex;gap:8px;align-items:center}
.mleg i{width:22px;height:3px;border-radius:2px}
.tmap path{vector-effect:non-scaling-stroke}
.tmap .river{fill:none;stroke:#3F7C8F;stroke-width:1.4;opacity:.9}
[data-theme=light] .tmap .river{stroke:#6F9FB4}
.tmap .border{fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:4 4;opacity:.6}
.tmap .route-halo{fill:none;stroke:var(--halo);stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.tmap .route{fill:none;stroke:var(--route);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tmap .route.sel{stroke:var(--accent);stroke-width:3.5}
.tmap .route.dim{opacity:.28}
.tmap .stop circle{fill:var(--ink);stroke:var(--halo)}
.tmap .stop text{fill:var(--halo);font-family:var(--mono);font-weight:600;text-anchor:middle}
.tmap .stop.sel circle{fill:var(--accent)} .tmap .stop.sel text{fill:var(--accent-ink)}
.tmap .stop.dim{opacity:.35}
.tmap .base rect{fill:var(--accent);stroke:var(--halo)}
.tmap .base path{fill:var(--accent-ink)}
.tmap .base-label{fill:var(--ink);font-family:var(--display);font-weight:800;letter-spacing:.02em;paint-order:stroke;stroke:var(--halo);stroke-linejoin:round}
.tmap .edge-label{fill:var(--ink2);font-family:var(--mono);paint-order:stroke;stroke:var(--halo)}
/* bookings */
.fcap{width:1440px;margin:30px auto 12px;display:flex;gap:14px;align-items:baseline}
.fcap b{font:800 28px/1 var(--display)} .fcap span{font:500 13px var(--mono);color:var(--muted)}
.frame{width:1440px;margin:0 auto 8px;border:1px solid var(--line2);border-radius:12px;overflow:hidden;position:relative;background:var(--bg)}
.bk{padding:22px 32px 32px}
.bday{font:800 22px/1 var(--display);margin:20px 0 8px;display:flex;gap:10px;align-items:center}
.bcard{display:grid;grid-template-columns:44px 1fr 220px 150px;gap:14px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-bottom:8px}
.bcard .k{width:44px;height:44px;border-radius:50%;background:var(--surface2);display:grid;place-items:center;color:var(--teal)}
.bcard b{font-weight:600;font-size:16.5px} .bcard small{display:block;font:500 12px var(--mono);color:var(--muted)}
.bcard .r{text-align:right;font:500 12.5px var(--mono);display:grid;gap:4px;justify-items:end}
.bcard.on{border-color:var(--accent)}
.menu{position:absolute;z-index:40;right:132px;top:56px;width:440px;background:var(--surface);border:1px solid var(--line2);border-radius:12px;box-shadow:var(--shadow);padding:8px}
.menu .cap{padding:10px 10px 6px}
.mrow{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:8px 10px;border-radius:8px}
.mrow img{width:52px;height:38px;border-radius:6px;object-fit:cover;box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px var(--tc)}
.mrow b{font:800 21px/1 var(--display)} .mrow small{display:block;font:500 11.5px/1.45 var(--mono);color:var(--muted);margin-top:3px}
.mrow small.crit{color:var(--crit)}
.mrow small.warn{color:var(--warn)}
.mrow.hover{background:var(--surface2)}
.mrow .go{font:600 12px var(--mono);color:var(--accent-text)}
.mrow .here{font:500 12px var(--mono);color:var(--muted)}
.mfoot{display:flex;justify-content:space-between;padding:10px 10px 4px;border-top:1px solid var(--line);margin-top:6px;font:500 12px var(--mono);color:var(--muted)}
.scrim{position:absolute;inset:0;background:rgba(11,17,25,.45);z-index:30}
.form{position:absolute;right:0;top:143px;bottom:0;width:460px;z-index:25;background:var(--surface);border-left:1px solid var(--line2);display:flex;flex-direction:column}
.form .fh{position:relative;height:140px;overflow:hidden;color:var(--header-ink)}
.form .fh img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.form .fh:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,17,25,.2),rgba(11,17,25,.85));z-index:1}
.form .fh:after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--tc);z-index:2}
.form .fh .in{position:absolute;left:22px;right:22px;bottom:16px;z-index:2}
.form .fh small{font:600 11.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--kicker-on-photo)}
.form .fh h3{font:800 34px/1 var(--display)}
.form .fb{padding:18px 22px;display:grid;gap:12px}
.fl label{display:block;font:500 12px var(--mono);color:var(--muted);margin-bottom:5px}
.fl .in{height:42px;border:1px solid var(--line2);border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:16px;background:var(--bg)}
.fl .in.m{font:500 13.5px var(--mono)}
.fl .in.focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form .ff{margin-top:auto;padding:14px 22px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}
.toast{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:45;background:var(--ink);color:var(--bg);border-radius:999px;padding:8px 14px 8px 8px;display:flex;gap:10px;align-items:center;font:500 13px var(--mono)}
.toast img{width:28px;height:28px;border-radius:50%;object-fit:cover}
.toast a{text-decoration:underline;font-weight:600}
/* public */
.cover{position:relative;height:620px;overflow:hidden;color:var(--header-ink)}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,17,25,.1) 30%,rgba(11,17,25,.88));z-index:1}
.cover .in{position:absolute;left:0;right:0;bottom:44px;z-index:2}
.cover h1{font:800 120px/.86 var(--display);margin-top:10px}
.cover p{font-size:21px;line-height:1.45;max-width:720px;margin-top:14px;color:#E3E8EE}
.cover .meta{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.cover .chip{border-color:rgba(246,244,238,.4);color:#F4F6F8;background:rgba(11,17,25,.4)}
.cover .acts{display:flex;gap:8px;margin-top:20px}
.cover .btn{color:#F4F6F8;border-color:rgba(246,244,238,.5);background:rgba(11,17,25,.35)}
.cover .btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.band{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;padding:36px 0;border-bottom:1px solid var(--line)}
.band h2{font:800 52px/.95 var(--display);margin-top:8px}
.band .why{font-size:19px;color:var(--ink2);margin-top:10px}
.months{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-top:22px}
.months div{text-align:center;font:500 11.5px var(--mono);color:var(--muted)}
.months i{display:block;height:30px;border-radius:5px;background:var(--surface2);margin-bottom:5px}
.months .on i{background:var(--accent)} .months .on{color:var(--accent-text);font-weight:600}
.months .sh i{background:repeating-linear-gradient(135deg,var(--accent) 0 3px,transparent 3px 8px);opacity:.6}
.wx{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.wx div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px}
.wx b{display:block;font:800 24px/1.05 var(--display);margin:6px 0 4px}
.wx span{font-size:14.5px;color:var(--muted)}
.notes{display:grid;gap:8px;margin-top:14px;font-size:15.5px}
.notes div{display:flex;gap:10px;align-items:flex-start}
.pdays{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
/* trail */
.glance{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface);margin-top:-46px;position:relative;z-index:3}
.glance div{padding:14px 16px;border-right:1px solid var(--line)} .glance div:last-child{border:0}
.glance b{display:block;font:800 36px/1 var(--display);margin:6px 0 6px} .glance b small{font:500 14px var(--mono);color:var(--muted)}
.tg{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:40px;padding:36px 0}
.sec{padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid var(--line)}
.sec h2{font:800 38px/1 var(--display);margin-bottom:14px}
.elev{width:100%;height:auto;overflow:visible}
.elev .a{fill:color-mix(in srgb,var(--accent) 16%,transparent)} .elev .l{fill:none;stroke:var(--accent);stroke-width:2.2}
.elev .g{stroke:var(--line);stroke-width:1} .elev .gl,.elev .xl{fill:var(--muted);font:500 11px var(--mono)}
.elev .mk circle{fill:var(--bg);stroke:var(--ink);stroke-width:2}
.huts{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px}
.huts div{border-top:2px solid var(--line2);padding-top:6px;font-size:15px} .huts b{display:block;font-weight:600} .huts span{font:500 12px var(--mono);color:var(--muted)}
.th{display:grid;grid-template-columns:320px 1fr;gap:24px}
.th img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}
.kv{display:grid;grid-template-columns:130px 1fr;gap:9px 16px;font-size:16px}
.kv dt{font:500 12.5px/1.9 var(--mono);color:var(--muted)}
.win{display:flex;gap:12px;align-items:center;margin-top:16px;padding:12px 14px;border:1px solid var(--accent);border-radius:10px;background:var(--accent-soft);font-size:15.5px}
.win b{color:var(--accent-text)}
.src{display:inline-flex;gap:5px;align-items:center;font:500 11px var(--mono);color:var(--muted);margin-top:2px}
.src i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
.src.c-community i{background:var(--accent)} .src.c-plan i{background:var(--muted)}
.lk{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:10px 0;border-bottom:1px solid var(--line)}
.lk b{font-weight:600;font-size:16px} .lk span{font:500 12px var(--mono);color:var(--muted)}
.lk .ic{grid-row:span 2;align-self:center;color:var(--muted)}
.ingrp{font:600 11.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--accent-text);margin:18px 0 2px}
.intrip{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);margin-bottom:18px}
.intrip img{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px var(--tc)}
.intrip small{display:block;font:500 12px var(--mono);color:var(--muted)}
.mm{position:relative;height:300px;border-radius:12px;overflow:hidden;border:1px solid var(--line)}
.mm svg{position:absolute;inset:0;width:100%;height:100%}
/* explore table */
.ttools{display:flex;gap:8px;padding:14px 0}
.ptable{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)}
.ptable th{font:500 12px var(--mono);color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--deep)}
.ptable td{padding:10px 12px;border-bottom:1px solid var(--line);font-size:15.5px;vertical-align:middle}
.ptable td.m{font:500 13px var(--mono)}
.ptable td.r,.ptable th.r{text-align:right}
.ptable tr.grp td{background:var(--surface2);font:800 22px/1 var(--display);padding:10px 12px;position:sticky;top:0}
.ptable tr.grp td span{float:right;font:500 12px var(--mono);color:var(--muted)}
.st{display:inline-flex;align-items:center;gap:7px}
.st i{width:10px;height:10px;border-radius:50%;background:var(--accent)}
.st.idea i{background:none;border:1.5px dashed var(--muted)}
/* phones */
.canvas{display:flex;gap:48px;justify-content:center;padding:44px 40px;background:var(--deep);align-items:flex-start}
.pw{display:flex;flex-direction:column;gap:12px;align-items:center}
.pcap{width:390px;font-size:15px;color:var(--muted)} .pcap b{display:block;color:var(--ink);font:800 24px/1 var(--display);margin-bottom:4px}
.phone{width:390px;height:844px;border-radius:44px;background:var(--bg);overflow:hidden;position:relative;box-shadow:0 0 0 9px #0B1119,0 0 0 10px #3A4A5D,0 30px 70px rgba(0,0,0,.4)}
.status{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font:600 14px var(--mono)}
.ptop{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:4px 14px 10px;border-bottom:2px solid var(--tc)}
.ptop img{width:52px;height:40px;border-radius:6px;object-fit:cover}
.ptop b{display:block;font:800 26px/.95 var(--display)} .ptop small{display:block;font:500 11.5px var(--mono);color:var(--muted);margin-top:2px}
.bnav{position:absolute;left:0;right:0;bottom:0;height:84px;background:var(--header);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);padding:8px 4px 26px}
.bnav a{display:flex;flex-direction:column;align-items:center;gap:3px;font:500 10.5px var(--mono);color:var(--header-mute)}
.bsw img{width:26px;height:26px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--header),0 0 0 4px var(--tc)}
.bnav a[aria-current]{color:var(--header-ink)} .bnav a[aria-current] .ic{color:var(--accent)}
.pdst{display:flex;gap:6px;padding:10px 14px;overflow:hidden}
.pdst div{flex:none;width:48px;height:56px;border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font:500 10.5px var(--mono);color:var(--muted)}
.pdst div b{font:800 22px/1 var(--display);color:var(--ink)}
.pdst div[aria-current]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)} .pdst div[aria-current] b{color:var(--accent-ink)}
.pb{padding:0 14px}
.lv{margin:10px 14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.lv .big{font:800 78px/.85 var(--display);color:var(--accent-text);margin-top:6px}
.lv .cd{font:600 14px var(--mono);margin-top:6px}
.lv p{font-size:15px;color:var(--ink2);margin-top:8px;line-height:1.4}
.lv .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.lv .btn{height:50px;justify-content:center;font-size:14px}
.late{margin:0 14px 10px;padding:12px;border:1px solid var(--line);border-radius:14px}
.late .o{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.late .o span{height:44px;border:1px solid var(--line2);border-radius:10px;display:grid;place-items:center;font:600 14px var(--mono)}
.late .o span.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.cq{display:grid;gap:7px;margin-top:10px;font-size:14px;line-height:1.35}
.cq div{display:flex;gap:8px;align-items:flex-start}
.cq .crit{color:var(--crit)} .cq .ok{color:var(--ok)}
.tl{padding:0 14px}
.tl .r{display:grid;grid-template-columns:48px 14px 1fr;gap:10px;padding:7px 0;align-items:start}
.tl .r .t{font:600 13px var(--mono)} .tl .r i{width:12px;height:12px;border-radius:50%;border:2px solid var(--line2);margin-top:4px}
.tl .r.now i{background:var(--accent);border-color:var(--accent)}
.tl .r b{font-weight:600;display:block;font-size:15.5px;line-height:1.3} .tl .r small{font:500 11.5px var(--mono);color:var(--muted)}
.note{margin:10px 14px 0;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:var(--surface2);font-size:14px}
.note .dot{width:12px;height:12px}
.note .btn{margin-left:auto;height:32px}
.off{margin:10px 14px 0;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;border:1px dashed var(--line2);font:500 12px var(--mono)}
.sheet{position:absolute;left:0;right:0;bottom:84px;background:var(--surface);border-top:1px solid var(--line2);border-radius:18px 18px 0 0;padding:8px 14px 12px}
.sheet .gb{width:40px;height:5px;border-radius:3px;background:var(--line2);margin:0 auto 10px}
"""


def tc(t: str) -> str:
    return f'style="--tc:{C.swatch(t)}"'


def header(cr: C.Credits, *, trip: str | None, active: str) -> str:
    tabs = "".join(f'<a href="#"{" aria-current=page" if n == active else ""}>{n}</a>' for n in ("Trips", "Places", "Globe", "Discover"))
    if trip:
        t = D.TRIP[trip]
        sw = f'<div class="tsw" {tc(trip)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><b>{esc(t["title"])}</b>{icon("chev", 15)}</div>'
    else:
        sw = f'<div class="tsw" style="padding-left:12px">{icon("swap", 15)} Open a trip {icon("chev", 15)}</div>'
    return (f'<header class="hdr"><span class="brand">TRIP PLANS</span><nav class="tabs-g">{tabs}</nav><span class="sp"></span>{sw}'
            f'<button class="btn icon" aria-label="Notifications">{icon("bell", 17)}</button><button class="btn icon" data-toggle-theme aria-label="Theme">{icon("sun", 17)}</button></header>')


TRIP_TABS = {"dolomites": [("Plan", "14 days"), ("Today", ""), ("Bookings", "3/9"), ("Tasks", "1/12"), ("Budget", "43%")],
             "patagonia": [("Plan", "13 days"), ("Today", ""), ("Bookings", "0/8"), ("Tasks", "2/19"), ("Budget", "8%")]}


def tripbar(cr: C.Credits, trip: str, tab: str) -> str:
    t = D.TRIP[trip]
    tabs = "".join(f'<a href="#"{" aria-current=page" if n == tab else ""}>{n}{f" <span>{c}</span>" if c else ""}</a>' for n, c in TRIP_TABS[trip])
    return (f'<div class="tbar" {tc(trip)}><div class="who"><div class="ph"><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""></div>'
            f'<div><h1>{esc(t["title"]).upper()}</h1><div class="meta"><span class="lab">{esc(t["dates"])} · {t["nights"]} nights · 3 travellers</span>'
            f'<span class="chip acc">{icon("calendar")} {D.COUNTDOWN[trip]}</span><span class="chip">{t["phase"]}</span></div></div></div>'
            f'<nav class="ttabs">{tabs}</nav><div class="acts"><button class="btn sm">{icon("users")} Share</button><button class="btn sm">{icon("download")} Offline</button></div></div>')


def tcard(cr: C.Credits, tid: str) -> str:
    t = D.TRIP[tid]
    nxt = f'<div class="next{" crit" if tid == "elora" else " warn" if tid == "patagonia" else ""}">{icon("clock", 15)}<span>{esc(t["next"])}{" · " + t["due"] if t["due"] else ""}</span></div>'
    return (f'<article class="card" {tc(tid)}><div class="ph"><img src="{cr.url(t["photo"], 960)}" {D.focus(t["photo"])} alt="{esc(D.PHOTOS[t["photo"]][3])}"></div><div class="in">'
            f'<h3>{esc(t["title"])}</h3><div class="meta">{esc(t["dates"])}, {(str(t["nights"]) + " nights, " + esc(t["sub"])) if t["nights"] else esc(t["sub"]).lower()}</div>'
            f'<div class="chips"><span class="chip acc">{icon("calendar")} {D.COUNTDOWN[tid]}</span><span class="chip"><i class="dot"></i> {t["phase"]}</span></div>'
            f'<p>{esc(D.SUMMARY[tid])}</p><div class="ready">' + "".join(f'<i><b style="width:{v * 100:.0f}%"></b></i>' for v in t["ready"]) + f'</div>{nxt}</div></article>')


def home() -> str:
    cr = C.Credits()
    cols = ""
    for g in ("elora", "patagonia", "dolomites", "person"):
        rows = [n for n in D.NEEDS if n["trip"] == g]
        if g == "dolomites":
            rows = [dict(what="Book the Ortisei stay, 4 nights", due="Mon 15 Mar", when="in 5 months", tab="Bookings", urgent=False)]
        if g == "person":
            head = (f'<div class="nhead"><span class="dot" style="--tc:var(--ink2);width:36px;height:36px;display:grid;place-items:center;color:var(--bg);font:600 14px var(--mono)">A</span>'
                    f'<div><b>Aarav</b><small>person · linked to ' + ", ".join(f'<i class="dot" {tc(x)} style="width:8px;height:8px"></i> {D.TRIP[x]["title"]}' for x in ("dolomites", "patagonia")) + '</small></div></div>')
        else:
            t = D.TRIP[g]
            head = f'<div class="nhead" {tc(g)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"])}</b><small>{esc(t["dates"])}</small></div></div>'
        body = "".join(f'<div class="nrow"><div class="due{" crit" if n["urgent"] else ""}">{icon("clock", 13)}<b>{n["due"]}</b> · {n["when"]}</div><div class="w">{esc(n["what"])}</div>'
                       f'<div class="acts"><button class="btn sm icon" style="width:30px" aria-label="Done">{icon("check", 14)}</button><button class="btn sm">Snooze</button>'
                       f'<button class="btn sm">Open in {n["tab"]} →</button></div></div>' for n in rows)
        cols += f'<div class="ncol">{head}{body}</div>'
    needs = (f'<section class="needs"><div class="hd"><h2>NEEDS YOU THIS WEEK</h2><span class="lab">grouped by trip, soonest first · open lands inside the trip, on the right tab</span></div>'
             f'<div class="ngrid">{cols}</div></section>')
    toolbar = (f'<div class="toolbar"><div class="search">{icon("search", 17)} Search trips<kbd>/</kbd></div>'
               f'<div class="filters"><span class="pill">When {icon("chev", 14)}</span><span class="pill">Phase {icon("chev", 14)}</span><span class="pill">Who {icon("chev", 14)}</span><span class="pill">Source {icon("chev", 14)}</span></div>'
               f'<div class="views"><a aria-current="page">{icon("layers", 15)} Cards</a><a>{icon("list", 15)} List</a><a>{icon("doc", 15)} Table</a><a>{icon("map", 15)} Map</a></div></div>'
               f'<div class="subbar"><span class="count">12<small>trips</small></span><span class="sp"></span><span class="lab">Group by</span><span class="selbox">When {icon("chev", 14)}</span>'
               f'<span class="lab">Sort by</span><span class="selbox">Soonest first {icon("chev", 14)}</span><button class="btn icon sm" style="width:34px;height:34px" aria-label="Reverse">{icon("swap", 14)}</button></div>')
    inprog = "".join(tcard(cr, t) for t in ("elora", "costa-rica", "patagonia", "dolomites"))
    planning = "".join(tcard(cr, t) for t in ("iceland", "chamonix", "rockies"))
    idea = D.IDEAS[0]
    planning += (f'<article class="card" style="--tc:var(--line2)"><div class="ph"><img src="{cr.url(idea["photo"], 960)}" alt=""></div><div class="in"><h3>{esc(idea["title"])}</h3>'
                 f'<div class="meta">{esc(idea["sub"])}</div><div class="chips"><span class="chip idea">Idea</span><span class="chip honest">{icon("alert")} Dates open</span></div>'
                 f'<p>Arctic first, then Fjord Norway north to south. {esc(idea["note"])}.</p></div></article>')
    done = "".join(
        f'<article class="card" style="--tc:var(--line2)"><div class="ph">{f"<img src={chr(34)}{cr.url(d["photo"], 960)}{chr(34)} alt={chr(34)}{chr(34)}>" if d["photo"] else "<div class=glyph>" + icon("map", 30) + "</div>"}</div>'
        f'<div class="in"><h3>{esc(d["title"])}</h3><div class="meta">{esc(d["dates"])} · read-only</div><div class="chips"><span class="chip ok">{icon("check")} Done</span></div>'
        f'<p>{esc(d["note"])}.</p><div class="next" style="border:0;padding:0"><button class="btn sm">{icon("copy", 14)} Use as a template</button></div></div></article>' for d in D.DONE)
    body = (header(cr, trip=None, active="Trips") + '<main class="wrap"><div class="ptitle"><div><h1>TRIPS</h1><p>Sunday 18 October. Three trips are moving; one needs you tomorrow.</p></div>'
            f'<div class="acts"><button class="btn">{icon("mail", 15)} Forward a confirmation</button><button class="btn primary">{icon("plus", 15)} Plan a trip</button></div></div>'
            + needs + toolbar +
            f'<div class="ghead"><h2>In progress</h2><span>4</span></div><div class="cards">{inprog}</div>'
            f'<div class="ghead"><h2>Planning and ideas</h2><span>4 of 6</span></div><div class="cards">{planning}</div>'
            f'<div class="ghead"><h2>Done</h2><span>3 · templates</span></div><div class="cards donecards">{done}</div></main>' + cr.html())
    return C.page("Trailhead · Trips", CSS, body, theme="light")


def item(cr, n, it, *, ghost=False, from_=False) -> str:
    time, pid, name, kind, meta, note, ticket, photo = it
    tk = {"booked": f'<span class="chip ok">{icon("check")} booked</span>', "to_book": '<span class="chip acc">to book</span>'}.get(ticket or "", "")
    ph = f'<img src="{cr.url(photo, 330)}" alt="">' if photo else f'<span class="noph">{icon(C.KIND_ICON.get(kind, "pin"), 22)}</span>'
    return (f'<div class="it{" ghost" if ghost else ""}{" from" if from_ else ""}"><span class="gr">{icon("grip", 17)}</span><span class="t">{time}</span>'
            f'<span class="kd">{icon(C.KIND_ICON.get(kind, "pin"))}</span><div><h4>{esc(name)} {tk}</h4><div class="im">{esc(meta)}</div>'
            f'{f"<div class=inote>{esc(note)}</div>" if note else ""}</div>{ph}</div>')


def plan() -> str:
    cr = C.Credits()
    out = ""
    for b in D.BASES:
        img = f'<img src="{cr.url(b["photo"], 330)}" alt="">' if b["photo"] else f'<i class="ni">{icon("home", 15)}</i>'
        out += f'<div class="ob">{img}<b>{b["name"].upper()}</b><span>{b["nights"]}</span></div>'
        for n, date, title, drive, _ in D.DAYS:
            if b["days"][0] <= n <= b["days"][1]:
                fl = '<i class="fl"></i>' if n in D.DAY_FLAG else ""
                out += f'<div class="od"{" aria-current=true" if n == 3 else ""}><span class="n">{n:02d}</span><span class="t">{esc(title)}</span><span class="dr">{drive}{fl}</span></div>'
    outline = f'<aside class="outline"><div class="cap">Days · drive</div>{out}<div class="cap" style="margin-top:18px">Lists</div><div class="od"><span class="n">≡</span><span class="t">Ideas</span><span class="dr">4</span></div><div class="od"><span class="n">≡</span><span class="t">Food and huts</span><span class="dr">1</span></div></aside>'

    def collapsed(d):
        n, date, title, drive, _ = d
        ph = D.DAY_PHOTO.get(n)
        return (f'<div class="dcol"><span class="sign quiet">DAY {n:02d}</span><div><b>{esc(title)}</b><small>{date} · {drive} driving</small></div>'
                f'{f"<img src={chr(34)}{cr.url(ph, 330)}{chr(34)} alt={chr(34)}{chr(34)}>" if ph else "<span></span>"}<span>{icon("chev", 16)}</span></div>')

    def dhead(d, walk):
        n, date, title, drive, _ = d
        return (f'<div class="dh"><span class="sign">DAY {n:02d}</span><h3>{esc(title).upper()}</h3></div>'
                f'<div class="dsum"><span>{icon("calendar", 13)} {date}</span><span>{icon("drive", 13)} {drive}</span><span>{icon("trail", 13)} {walk}</span><span>{icon("home", 13)} San Candido</span></div>')
    d2, d3 = D.DAYS[1], D.DAYS[2]
    day2 = f'<section class="day">{dhead(d2, "6.7 km · 90 m")}{item(cr, 1, d2[4][0])}<div class="leg">{icon("drive", 13)} 55 min · 41 km via Dobbiaco</div>{item(cr, 2, d2[4][1])}</section>'
    day3 = (f'<section class="day">{dhead(d3, "12 km · 600 m")}<div class="leg">{icon("drive", 13)} leave 10:15 · 38 min · 29 km to the toll gate</div>'
            f'<div class="ins"><span>drop here · before 11:30 · the day recalculates</span></div>{item(cr, 2, d3[4][1], ghost=True)}'
            f'{item(cr, 1, d3[4][0])}<div class="leg">{icon("trail", 13)} 6 min walk</div>{item(cr, 2, d3[4][1], from_=True)}</section>')
    doc = (f'<div class="doc"><div class="nextb">{icon("clock", 16)}<span>Next: Ortisei stay by Mon 15 Mar · Tre Cime slot opens Tue 15 Jun</span><button class="btn sm">Bookings</button></div>'
           f'<div class="add">{icon("search", 17)} Add a place, paste a link or a note<kbd>/</kbd></div>{collapsed(D.DAYS[0])}{day2}{day3}{collapsed(D.DAYS[3])}</div>')
    mp = C.trip_map(MAP, pane=(562, 900), pin_px=10, pad=.06, label_px=16,
                    edges=[("↓ Venice 2 h 30", 12.33, 46.42, -120, 14), ("↓ Venice 2 h 40", 11.36, 46.42, 6, 14)])
    mapc = (f'<div class="mapc">{mp}<div class="mtool"><div class="seg"><button aria-selected="true" data-tab>All 14 days</button><button data-tab>Day 03</button><button data-tab>Bases</button></div></div>'
            f'<div class="mleg"><div><i style="background:var(--route)"></i>every day, by road</div><div><i style="background:var(--accent)"></i>the picked day</div><div>{icon("home", 13)} base, where you sleep</div><div class="lab">relief and 100 m contours</div></div></div>')
    body = header(cr, trip="dolomites", active="Trips") + tripbar(cr, "dolomites", "Plan") + f'<div class="plan">{outline}{doc}{mapc}</div>' + cr.html()
    return C.page("Trailhead · Plan", CSS, body, theme="light")


def bnav(cur: str, cr: C.Credits | None = None, tid: str = "dolomites") -> str:
    """Bottom bar on trip screens: the trip itself (opens the switcher) is the first, thumb-reach item."""
    t = D.TRIP[tid]
    sw = (f'<a href="#" class="bsw" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt="">Switch</a>' if cr else "")
    return ('<nav class="bnav">' + sw + "".join(f'<a href="#"{" aria-current=page" if n == cur else ""}>{icon(i, 22)}{n}</a>' for n, i in
            [("Plan", "map"), ("Today", "sun"), ("Bookings", "ticket"), ("More", "more")]) + "</nav>")


def ptop(cr, tid, sub) -> str:
    t = D.TRIP[tid]
    return (f'<div class="ptop" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"]).upper()}</b><small>{sub}</small></div>'
            f'<button class="btn icon" aria-label="Switch trip">{icon("swap", 17)}</button></div>')


def plan_phone() -> str:
    cr = C.Credits()
    dst = '<div class="pdst">' + "".join(f'<div{" aria-current=true" if d[0] == 3 else ""}><b>{d[0]}</b>{d[1][:3]}</div>' for d in D.DAYS[:7]) + "</div>"
    items = ""
    for k, it in enumerate(D.DAYS[2][4]):
        time, pid, name, kind, meta, note, ticket, photo = it
        items += (f'<div class="it" style="grid-template-columns:18px 42px 1fr 62px;padding:9px 0"><span class="gr">{icon("grip", 16)}</span><span class="t">{time}</span>'
                  f'<div><h4 style="font-size:16px">{esc(name)}</h4><div class="im">{esc(meta)}</div>{f"<div class=inote style=font-size:14px>{esc(note)}</div>" if note else ""}</div>'
                  f'<img src="{cr.url(photo, 330)}" style="width:62px;height:50px" alt=""></div>')
        if k == 0:
            items += f'<div class="leg" style="margin-left:60px">{icon("trail", 12)} 6 min walk</div>'
    more = "".join(f'<div class="dcol" style="grid-template-columns:auto 1fr auto;gap:10px"><span class="sign quiet" style="height:24px;font-size:15px">DAY {d[0]:02d}</span><div><b style="font-size:15px">{esc(d[2])}</b><small>{d[1]} · {d[3]}</small></div><span>{icon("chev", 15)}</span></div>' for d in D.DAYS[3:5])
    f1 = (f'<div class="phone"><div class="status"><span>18:42</span><span>5G</span></div>{ptop(cr, "dolomites", "13 – 26 Jul 2027 · in 268 days")}{dst}<div class="pb">'
          f'<div class="dh" style="gap:10px"><span class="sign" style="height:26px;font-size:16px">DAY 03</span><h3 style="font-size:24px">TRE CIME</h3></div>'
          f'<div class="dsum" style="gap:10px"><span>Thu 15 Jul</span><span>{icon("drive", 12)} 1 h 10</span><span>{icon("trail", 12)} 12 km</span></div>'
          f'<div class="leg" style="margin-left:60px">{icon("drive", 12)} leave 10:15 · 38 min</div>{items}{more}</div>{bnav("Plan", cr, "dolomites")}</div>')
    mp = C.trip_map(MAP, pane=(390, 600), pin_px=9, pad=.12, label_px=14)
    f2 = (f'<div class="phone"><div class="status"><span>18:43</span><span>5G</span></div>{ptop(cr, "dolomites", "Map · all 14 days")}'
          f'<div style="position:absolute;left:0;right:0;top:110px;bottom:84px">{mp.replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div>'
          f'<div style="position:absolute;left:14px;top:120px;z-index:2"><div class="seg"><button aria-selected="true">All days</button><button>Day 03</button><button>Bases</button></div></div>'
          f'<div class="sheet"><div class="gb"></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'
          + "".join(f'<div style="border-top:2px solid var(--accent);padding-top:6px"><b class="d" style="font-size:18px;display:block">{b["name"].upper()}</b><span class="lab">{b["nights"]}</span></div>' for b in D.BASES[:4])
          + f'</div></div>{bnav("Plan", cr, "dolomites")}</div>')
    body = (f'<div class="canvas"><div class="pw">{f1}<div class="pcap"><b>PLAN, ONE DAY</b>The trip bar (photo, name, dates, its colour as the rule under it) sits on every trip screen. The trip photo, first in the bottom bar, switches trip in thumb reach and keeps the tab.</div></div>'
            f'<div class="pw">{f2}<div class="pcap"><b>MAP, ALL DAYS</b>Topo basemap: relief, 100 m contours, rivers; a slate night version in dark mode. Bases are amber signposts; routes follow the roads.</div></div></div>' + cr.html())
    return C.page("Trailhead · Plan on a phone", CSS, body, theme="light")


def today_phone() -> str:
    cr = C.Credits()
    tl = "".join(f'<div class="r{" now" if k == 0 else ""}"><span class="t">{t}</span><i></i><div><b>{esc(w)}</b><small>{esc(d)}</small></div></div>' for k, (t, w, kind, d, s) in enumerate(D.ELORA_DAY[:4]))
    f1 = (f'<div class="phone"><div class="status"><span>07:28</span><span>LTE</span></div>{ptop(cr, "elora", "TODAY · Sat 24 Oct · day trip")}'
          f'<div class="note"><i class="dot" {tc("dolomites")}></i><span>Opened <b>Elora</b>, the trip you are on today. You were planning Dolomites.</span><button class="btn sm">Dolomites</button></div>'
          f'<div class="lv"><span class="cap">Leave home by</span><div class="big">08:10</div><div class="cd">in 42 min · 2 h 05 · 182 km</div>'
          f'<p>Check in 15 minutes before the 10:30 tubing slot at the Elora Gorge.</p>'
          f'<div class="acts"><button class="btn primary">{icon("nav", 16)} Navigate</button><button class="btn">{icon("ticket", 16)} Slot HB-5521</button></div></div>'
          f'<div class="late"><span class="cap">Running late?</span><div class="o"><span>+15</span><span>+30</span><span>+45</span><span>+60</span></div></div>'
          f'<div class="tl">{tl}</div>{bnav("Today", cr, "elora")}</div>')
    f2 = (f'<div class="phone"><div class="status"><span>08:24</span><span>LTE</span></div>{ptop(cr, "elora", "TODAY · Sat 24 Oct · day trip")}'
          f'<div style="margin:10px 14px 10px;height:150px;border-radius:14px;overflow:hidden;position:relative"><img src="{cr.url("elora", 960)}" {D.focus("elora")} style="width:100%;height:100%;object-fit:cover" alt="">'
          f'<span class="chip acc" style="position:absolute;left:10px;bottom:10px;background:var(--accent);color:var(--accent-ink)">NEXT · 10:30 tubing slot</span></div>'
          f'<div class="late" style="border-color:var(--accent)"><span class="cap">Running late · left 08:24</span><div class="o"><span>+15</span><span class="on">+30</span><span>+45</span><span>+60</span></div>'
          f'<div class="cq"><div class="crit">{icon("alert", 16)}<span><b>Arrive 10:45.</b> Check-in for the 10:30 slot closes 10:15.</span></div>'
          f'<div>{icon("phone", 16)}<span>The operator can move the slot once by phone; the number is in the booking.</span></div>'
          f'<div class="ok">{icon("check", 16)}<span>Lunch, the gorge trail and the drive home still fit. Home by 19:10.</span></div></div>'
          f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button class="btn primary" style="justify-content:center;height:46px">Shift the day</button><button class="btn" style="justify-content:center;height:46px">This stop only</button></div></div>'
          f'<div class="tl">' + "".join(f'<div class="r"><span class="t">{t}</span><i></i><div><b>{w}</b><small>{s}</small></div></div>' for t, w, s in
                                        [("11:00", "Tubing, if the slot moves", "was 10:30"), ("13:15", "Lunch in Elora village", "was 12:45")]) + f'</div>{bnav("Today", cr, "elora")}</div>')
    f3 = (f'<div class="phone"><div class="status"><span>10:58</span><span>No service</span></div>{ptop(cr, "dolomites", "TODAY · Thu 15 Jul · day 3 of 14")}'
          f'<div class="off">{icon("offline", 16)}<span>Offline. Day 3 saved 07:12 today: map, slot code, parking, huts.</span></div>'
          f'<div class="lv"><span class="cap">Toll gate entry by</span><div class="big">11:30</div><div class="cd">in 32 min · slot 11:00</div>'
          f'<p>Code <b class="m">TC-0715-1100</b> shows offline at the gate. Walk clockwise; off the loop by 14:00 if storms build.</p>'
          f'<div class="acts"><button class="btn primary">{icon("ticket", 16)} Show the slot</button><button class="btn">{icon("map", 16)} Offline map</button></div></div>'
          f'<div style="margin:0 14px 10px;height:140px;border-radius:14px;overflow:hidden;position:relative;border:1px solid var(--line)">'
          f'{C.trip_map(MAP, pane=(362, 140), box=(12.22, 46.585, 12.32, 46.635), pin_px=9, only_days=[3], selected=3, label_bases=False).replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div>'
          f'<div class="tl">' + "".join(f'<div class="r"><span class="t">{t}</span><i></i><div><b>{w}</b><small>{s}</small></div></div>' for t, w, s in
                                        [("13:00", "Rifugio Locatelli", "lunch · cash only"), ("16:30", "Cadini di Misurina", "exposed spur")]) + f'</div>{bnav("Today", cr, "dolomites")}</div>')
    body = (f'<div class="canvas"><div class="pw">{f1}<div class="pcap"><b>S5: TODAY OPENS ELORA</b>A travel day beats the last-selected trip. The note says so; Dolomites is one tap away.</div></div>'
            f'<div class="pw">{f2}<div class="pcap"><b>RUNNING LATE</b>Each choice shows what it breaks before you commit, and offers the fix.</div></div>'
            f'<div class="pw">{f3}<div class="pcap"><b>OFFLINE AT AURONZO</b>No signal at the trailhead. Everything for the day is on the phone, with the time it was saved.</div></div></div>' + cr.html())
    return C.page("Trailhead · Today on a phone", CSS, body, theme="light")


def bcards(cr, bks, on: str = "") -> str:
    out, last = "", None
    for b in sorted(bks, key=lambda b: int(b["day"].split()[1])):
        if b["day"] != last:
            out += f'<div class="bday"><span class="sign quiet" style="height:24px;font-size:15px">{b["day"].upper()}</span></div>'
            last = b["day"]
        st = {"booked": f'<span class="chip ok">{icon("check")} Booked</span>', "held": '<span class="chip idea">Held</span>', "to_book": '<span class="chip acc">To book</span>'}[b["status"]]
        w = b.get("window", "") or b["code"]
        wc = ' style="color:var(--warn)"' if "31 Oct" in w else ""
        out += (f'<div class="bcard{" on" if on and on in b["title"] else ""}"><span class="k">{icon(C.KIND_ICON[b["kind"]], 20)}</span><div><b>{esc(b["title"])}</b><small>{esc(b["when"])}</small></div>'
                f'<div class="r">{st}<span{wc}>{esc(w)}</span></div><div class="r"><b style="font-size:14px">{esc(b["money"])}</b></div></div>')
    return out


def form(cr, tid, kicker, title, fields, save) -> str:
    t = D.TRIP[tid]
    return (f'<div class="form" {tc(tid)}><div class="fh"><img src="{cr.url(t["photo"], 960)}" {D.focus(t["photo"])} alt=""><div class="in"><small>{kicker}</small><h3>{title}</h3></div></div>'
            f'<div class="fb">{fields}<div class="fl"><label>Files under</label><div class="in"><img src="{cr.url(t["photo"], 330)}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--tc)" alt="">'
            f'<b>{esc(t["title"])}</b><span class="lab">matched by the dates</span><a href="#" class="lab" style="margin-left:auto;text-decoration:underline;color:var(--ink)">Change</a></div></div></div>'
            f'<div class="ff"><button class="btn primary">{save}</button><button class="btn">Cancel</button><span class="lab" style="margin-left:auto">Ctrl Z undoes</span></div></div>')


def bookings_switch() -> str:
    cr = C.Credits()
    bh = lambda tid, s: (f'<div style="display:flex;align-items:center;gap:12px"><h2 class="d" style="font-size:44px">BOOKINGS</h2><span class="lab">{s}</span><span style="flex:1"></span>'
                         f'<button class="btn">{icon("mail", 15)} Forward a confirmation</button><button class="btn primary">{icon("plus", 15)} Add a booking</button></div>')
    rows = ""
    for tid, note, crit, state in [("elora", "Sat 24 Oct · tubing slot opens Mon 19 Oct", "crit", ""), ("patagonia", "26 Feb · flight and lodging by Sat 31 Oct", "warn", "hover"),
                                   ("dolomites", "13 Jul · Ortisei stay by Mon 15 Mar", False, "here"), ("costa-rica", "13 Feb · pick the second base", False, "")]:
        t = D.TRIP[tid]
        right = f'<span class="go">Bookings →</span>' if state == "hover" else (f'<span class="here">{icon("check", 13)} here</span>' if state == "here" else "")
        rows += (f'<div class="mrow {state}" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"])}</b>'
                 f'<small class="{crit or ""}">{esc(note)}</small></div>{right}</div>')
    menu = (f'<div class="scrim"></div><div class="menu"><div class="cap">In progress · soonest first</div>{rows}<div class="cap">Planning</div>'
            + "".join(f'<div class="mrow" {tc(x)}><img src="{cr.url(D.TRIP[x]["photo"], 330)}" alt=""><div><b>{esc(D.TRIP[x]["title"])}</b><small>{esc(D.TRIP[x]["dates"])}</small></div></div>' for x in ("iceland",))
            + f'<div class="mfoot"><span>switching keeps the tab you are on</span><a href="#" style="color:var(--accent-text)">Done (3) →</a></div></div>')
    f1 = (f'<div class="fcap"><b>1 · DOLOMITES BOOKINGS, OPEN THE SWITCHER</b><span>the trip chip in the header · in progress first, each with its next deadline</span></div>'
          f'<div class="frame" style="height:900px">{header(cr, trip="dolomites", active="Trips")}{tripbar(cr, "dolomites", "Bookings")}<div class="bk">{bh("dolomites", "3 booked · 1 held · 5 to book")}{bcards(cr, D.DOLO_BOOKINGS[:5])}</div>{menu}</div>')
    fp = ('<div class="fl"><label>Kind</label><div style="display:flex;gap:6px"><span class="chip acc" style="height:32px">' + icon("plane") + ' Flight</span><span class="chip" style="height:32px">'
          + icon("bed") + ' Stay</span><span class="chip" style="height:32px">' + icon("car") + ' Car</span><span class="chip" style="height:32px">' + icon("ticket") + ' Activity</span></div></div>'
          '<div class="fl"><label>Airline and route</label><div class="in focus">Air Canada · YYZ → EZE</div></div>'
          '<div class="two"><div class="fl"><label>Departs, Toronto time</label><div class="in m">Fri 26 Feb 2027 23:50</div></div><div class="fl"><label>Arrives, Buenos Aires</label><div class="in m">Sat 27 Feb 11:05</div></div></div>'
          '<div class="fl"><label>Travellers</label><div class="in">Nitin, Partner, Aarav</div></div>')
    toast = f'<div class="toast"><img src="{cr.url("misurina", 330)}" alt="">Dolomites stays on Bookings, Day 9 · <a href="#">Back</a></div>'
    f2 = (f'<div class="fcap"><b>2 · PATAGONIA BOOKINGS, ADD THE FLIGHT</b><span>same tab · the form header and the save button name the trip</span></div>'
          f'<div class="frame" style="height:900px">{header(cr, trip="patagonia", active="Trips")}{tripbar(cr, "patagonia", "Bookings")}<div class="bk" style="padding-right:500px">{bh("patagonia", "0 booked · 1 held · 7 to book")}{bcards(cr, D.PATA_BOOKINGS[:5])}</div>'
          f'{form(cr, "patagonia", "New booking in Patagonia", "TORONTO → BUENOS AIRES", fp, "Save to Patagonia")}{toast}</div>')
    fd = ('<div class="fl"><label>Property</label><div class="in focus">Guesthouse in Ortisei (Guest Pass)</div></div>'
          '<div class="two"><div class="fl"><label>Check in</label><div class="in m">Wed 21 Jul 15:00</div></div><div class="fl"><label>Check out</label><div class="in m">Sun 25 Jul 10:00</div></div></div>'
          '<div class="two"><div class="fl"><label>Total</label><div class="in m">€1,560</div></div><div class="fl"><label>Free cancellation until</label><div class="in m">Mon 5 Jul</div></div></div>')
    f3 = (f'<div class="fcap"><b>3 · BACK TO DOLOMITES, ORTISEI OPEN</b><span>second switch: Back on the toast, or the chip again · nothing landed in Patagonia</span></div>'
          f'<div class="frame" style="height:780px">{header(cr, trip="dolomites", active="Trips")}{tripbar(cr, "dolomites", "Bookings")}<div class="bk" style="padding-right:500px">{bh("dolomites", "")}{bcards(cr, D.DOLO_BOOKINGS[5:8], on="Ortisei")}</div>'
          f'{form(cr, "dolomites", "Booking in Dolomites · nights 9-12", "ORTISEI, 4 NIGHTS", fd, "Save to Dolomites")}</div>')
    body = f'<div style="padding-bottom:30px;background:var(--deep)">{f1}{f2}{f3}</div>' + cr.html()
    return C.page("Trailhead · Switching trips in Bookings", CSS, body, theme="light")


def public() -> str:
    cr = C.Credits()
    cover = (f'<section class="cover"><img src="{cr.url("seceda", 1920)}" {D.focus("seceda")} alt=""><div class="in"><div class="wrap"><span class="cap" style="color:var(--kicker-on-photo)">Published plan · South Tyrol and Veneto, Italy</span>'
             f'<h1>DOLOMITES,<br>THIRTEEN NIGHTS</h1><p>Three valley bases, early starts at the famous lakes, a Sass Pordoi day and sunset in Val di Funes. A rental car throughout.</p>'
             f'<div class="meta"><span class="chip">14 days</span><span class="chip">4 bases</span><span class="chip">drive 1 h 10 a day</span><span class="chip">moderate</span><span class="chip">ages 8+</span><span class="chip">by Nitin · copied 41 times</span></div>'
             f'<div class="acts"><button class="btn primary">{icon("copy", 15)} Copy to my trips</button><button class="btn">{icon("share", 15)} Share</button></div></div></div></section>')
    s = D.SEASON
    months = "".join(f'<div class="{"on" if m in s["months"] else "sh" if m in s["shoulder"] else ""}"><i></i>{"JFMAMJJASOND"[m - 1]}</div>' for m in range(1, 13))
    band = (f'<section class="band"><div><span class="cap" style="color:var(--accent-text)">This plan is valid for</span><h2>{s["label"].upper()}</h2><p class="why">{s["why"]}</p>'
            f'<div class="months">{months}</div><p class="lab" style="margin-top:8px">solid: as written · hatched: possible, check lifts and huts</p></div>'
            f'<div><div class="wx">' + "".join(f'<div><span class="cap">{a}</span><b>{b}</b><span>{c}</span></div>' for a, b, c in s["weather"]) + '</div>'
            f'<div class="notes">' + "".join(f'<div>{icon("alert", 17)}<span>{esc(n)}</span></div>' for n in s["notes"]) + "</div></div></section>")
    cards = ""
    for n, title, base, drive, stops, ph in D.PUBLIC_DAYS[:6]:
        cards += (f'<article class="card" style="--tc:var(--accent)"><div class="ph"><img src="{cr.url(ph, 960)}" alt=""></div><div class="in"><span class="sign" style="align-self:flex-start;height:24px;font-size:15px">DAY {n:02d}</span>'
                  f'<h3>{esc(title)}</h3><div class="meta">{esc(base)} · drive {drive}</div><p>{esc(" · ".join(stops))}</p></div></article>')
    rest = "".join(f'<div class="dcol" style="grid-template-columns:auto 1fr auto auto"><span class="sign quiet">DAY {n:02d}</span><div><b>{esc(t)}</b><small>{esc(" · ".join(st))}</small></div><span class="lab">{esc(b)}</span><span class="lab">{d}</span></div>'
                   for n, t, b, d, st, ph in D.PUBLIC_DAYS[6:])
    mp = C.trip_map(MAP, pane=(1312, 480), pin_px=10, pad=.05, label_px=17)
    body = (header(cr, trip=None, active="Discover") + cover + f'<main class="wrap">{band}'
            f'<div class="ghead"><h2>THE ROUTE</h2><span>4 bases · every day drawn</span></div><div class="mm" style="height:480px">{mp}</div>'
            f'<div class="ghead"><h2>DAY BY DAY</h2><span>days, not dates · pick a start date when you copy</span></div><div class="pdays">{cards}</div><div style="margin-top:18px">{rest}</div></main>' + cr.html())
    return C.page("Trailhead · Public trip", CSS, body, theme="light")


def trail() -> str:
    cr = C.Credits()
    T = D.TRAIL
    th = T["trailhead"]
    cover = (f'<section class="cover" style="height:560px"><img src="{cr.url("locatelli", 1920)}" {D.focus("locatelli")} alt=""><div class="in" style="bottom:80px"><div class="wrap"><span class="cap" style="color:var(--kicker-on-photo)">Trail · {esc(T["area"])}</span>'
             f'<h1 style="font-size:104px">TRE CIME DI LAVAREDO LOOP</h1><p>{esc(T["summary"])}</p>'
             f'<div class="acts"><button class="btn primary">{icon("plus", 15)} Add to Dolomites · Day 3</button><button class="btn">{icon("download", 15)} GPX</button><button class="btn">{icon("share", 15)} Share</button></div></div></div></section>')
    glance = ('<div class="wrap"><div class="glance">' + "".join(f'<div><span class="cap">{k}</span><b>{v}{f" <small>{u}</small>" if u else ""}</b><span class="src c-{c}"><i></i>{esc(s)}</span></div>' for k, v, u, s, c in T["facts"]) + "</div></div>")
    huts = "".join(f'<div><b>{esc(n)}</b><span>{km} · {el}</span></div>' for n, km, el in T["huts"])
    kvth = "".join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in [("Trailhead", f'<b>{th["name"]}</b>, {th["elev"]}'), ("Coordinates", f'<span class="m">{th["lat"]}, {th["lon"]}</span>'),
                                                           ("Parking", th["parking"]), ("Fee", th["fee"]), ("Fills", th["fills"]), ("By bus", th["shuttle"])])
    when = "".join(f'<dt>{k}</dt><dd>{esc(v)}<br><span class="src c-plan"><i></i>{esc(s)}</span></dd>' for k, v, s in T["when"])
    who = "".join(f'<dt>{k}</dt><dd>{esc(v)}</dd>' for k, v, s in T["who"])
    left = (f'<div><section class="sec"><h2>THE ROUTE</h2>{C.elevation_svg(780, 160)}<div class="huts">{huts}</div></section>'
            f'<section class="sec"><h2>TRAILHEAD AND PARKING</h2><div class="th"><img src="{cr.url("auronzo-park", 960)}" alt="{esc(D.PHOTOS["auronzo-park"][3])}"><dl class="kv">{kvth}</dl></div>'
            f'<div class="win">{icon("clock", 20)}<span><b>Booking window:</b> toll slots open {esc(th["opens"])}. No same-day sales.</span><button class="btn sm" style="margin-left:auto">Remind me</button></div></section>'
            f'<section class="sec"><h2>WHEN TO GO</h2><dl class="kv">{when}</dl></section>'
            f'<section class="sec" style="border:0"><h2>WHO IT SUITS</h2><dl class="kv">{who}</dl><div style="display:flex;gap:8px;margin-top:14px">'
            + "".join(f'<span class="chip ok">{icon("check")} {n} fits</span>' for _, n in D.TRAVELLERS) + '<span class="chip honest">' + icon("alert") + ' Dog policy unverified</span></div></section></div>')
    groups = {}
    for kind, label, dom, note, checked in T["links"]:
        groups.setdefault(kind, []).append((label, dom, note))
    links = "".join(f'<div class="ingrp">{k} · {len(v)}</div>' + "".join(f'<a class="lk" href="#"><b>{esc(l)}</b>{icon("share", 15)}<span>{esc(dom)} · {esc(n)}</span></a>' for l, dom, n in v) for k, v in groups.items())
    mm = C.trip_map(MAP, pane=(400, 300), box=(12.24, 46.59, 12.32, 46.63), pin_px=10, label_bases=False, only_days=[3], selected=3)
    right = (f'<aside><div class="intrip" {tc("dolomites")}><img src="{cr.url("misurina", 330)}" alt=""><div><b>In Dolomites · Day 3</b><small>Thu 15 Jul, 11:30 · toll slot to book</small></div><button class="btn sm" style="margin-left:auto">Open</button></div>'
             f'<div class="mm">{mm}</div><section class="sec" style="margin-top:24px"><h2 style="font-size:30px">HAZARDS</h2>'
             + "".join(f'<div style="display:flex;gap:10px;margin-bottom:8px">{icon("alert", 18)}<span>{esc(h)}</span></div>' for h in T["hazards"])
             + f'</section><h2 class="d" style="font-size:30px">ALL {len(T["links"])} LINKS</h2><span class="lab">every link checked 18 Oct 2026</span>{links}</aside>')
    body = header(cr, trip="dolomites", active="Places") + cover + glance + f'<main class="wrap"><div class="tg">{left}{right}</div></main>' + cr.html()
    return C.page("Trailhead · Trail page", CSS, body, theme="light")


def explore() -> str:
    """The live Places page, kept: filter pills per dimension, four views, table tools, honesty markers, grouping."""
    cr = C.Credits()
    toolbar = (f'<div class="toolbar"><div class="search">{icon("search", 17)} Search places<kbd>/</kbd></div>'
               f'<div class="filters">' + "".join(f'<span class="pill">{n} {icon("chev", 14)}</span>' for n in ("Country", "Kind", "Status", "Kids", "Season", "Tag", "Plan")) + '</div>'
               f'<div class="views"><a>{icon("layers", 15)} Cards</a><a>{icon("list", 15)} List</a><a aria-current="page">{icon("doc", 15)} Table</a><a>{icon("map", 15)} Map</a></div></div>'
               f'<div class="subbar"><span class="count">57<small>places</small></span><span class="chip acc">{icon("x")} Plan: Dolomites</span><span class="sp"></span><span class="lab">Group by</span><span class="selbox">Country {icon("chev", 14)}</span>'
               f'<span class="lab">Sort by</span><span class="selbox">Country, region, area {icon("chev", 14)}</span></div>'
               f'<div class="ttools"><button class="btn sm">{icon("layers", 14)} Saved views</button><button class="btn sm">{icon("list", 14)} Columns</button>'
               f'<button class="btn sm">{icon("list", 14)} Comfortable rows</button><button class="btn sm">{icon("download", 14)} Export CSV</button>'
               f'<span style="flex:1"></span><button class="btn sm">{icon("plus", 14)} Add to a trip</button></div>')
    rows = '<tr class="grp"><td colspan="8">ITALY <span>10 of 10</span></td></tr>'
    for name, kind, st, area, season, kids, elev, src, mark in D.PLACE_ROWS:
        rows += (f'<tr><td><b>{esc(name)}</b>{f" <span class=chip honest style=margin-left:6px>{icon(chr(97) + chr(108) + chr(101) + chr(114) + chr(116))} {mark}</span>" if mark else ""}</td>'
                 f'<td class="m"><span style="color:var(--teal);display:inline-flex;gap:6px;align-items:center">{icon(C.KIND_ICON.get(kind, "pin"), 15)} {kind.title()}</span></td>'
                 f'<td><span class="st{" idea" if st == "Idea" else ""}"><i></i>{st}</span></td><td>{esc(area)}</td><td>{season}</td><td>{kids}</td>'
                 f'<td class="m r">{elev or "–"}</td><td class="m" style="color:{"var(--crit)" if src == "None yet" else "var(--ink2)"}">{src}</td></tr>')
    rows += '<tr class="grp"><td colspan="8">CANADA <span>22 · collapsed</span></td></tr><tr class="grp"><td colspan="8">UNITED STATES <span>25 · collapsed</span></td></tr>'
    table = f'<table class="ptable"><tr><th>Name</th><th>Kind</th><th>Status</th><th>Area</th><th>Season</th><th>Kids</th><th class="r">Elevation</th><th>Sources</th></tr>{rows}</table>'
    globe = (f'<div class="ghead"><h2>GLOBE</h2><span>kept from the live site: relief, light and dark styles · 3D terrain · drill country, state, district · saved places by country</span></div>'
             f'<div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start"><img src="../../live-site/globe.png" alt="The live globe page" style="width:100%;border-radius:12px;border:1px solid var(--line)">'
             f'<div class="lab" style="font-size:13px;line-height:1.6">The globe stays the public entry point: pins by continent and country, search that flies to a place, '
             f'and a side panel of saved places with counts. In this direction it takes the slate header, amber selection and the same relief family as the trip maps. '
             f'Screenshot: the live page on 18 Oct 2026, before the palette change.</div></div>')
    body = (header(cr, trip=None, active="Places") + '<main class="wrap"><div class="ptitle"><div><h1>PLACES</h1><p>Every place we want to go, by country, region and area. Filter, sort, or switch to the table.</p></div></div>'
            + toolbar + table + globe + "</main>" + cr.html())
    return C.page("Trailhead · Places (kept from the live site)", CSS, body, theme="light")


PAGES = {"home": home, "plan": plan, "plan-phone": plan_phone, "today-phone": today_phone, "bookings-switch": bookings_switch,
         "public-trip": public, "trail": trail, "places": explore}


def build() -> None:
    for name, fn in PAGES.items():
        C.write(f"{DIR}/{name}.html", fn())


if __name__ == "__main__":
    build()
