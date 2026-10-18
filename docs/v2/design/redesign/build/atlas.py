"""Direction A, Atlas: the trip as a magazine feature. Photography carries the colour; type and space do the rest."""
from __future__ import annotations

import common as C
import data as D
from common import esc, icon

DIR = "atlas"
MAP = {"light": "../assets/map-atlas-light.webp", "dark": "../assets/map-atlas-dark.webp"}

CSS = C.fonts_css("Instrument Serif", "Instrument Sans") + """
:root{--bg:#FFFFFF;--paper:#F6F5F2;--ink:#111317;--ink2:#383C43;--muted:#5F646C;--line:#E7E5E0;--line2:#D2CFC8;
--act:#111317;--act-ink:#FFFFFF;--crit:#B3263E;--crit-soft:#FBEEF0;--ok:#2C7A4B;--ok-soft:#E9F4EE;--warn:#8F5B00;--warn-soft:#FBF3E4;
--shadow:0 1px 2px rgba(17,19,23,.06),0 12px 32px rgba(17,19,23,.10);--lift:0 2px 6px rgba(17,19,23,.10),0 22px 48px rgba(17,19,23,.22);
--serif:'Instrument Serif',Georgia,serif;--sans:'Instrument Sans',system-ui,sans-serif;--r:10px;--rc:6px;
--route:#111317;--halo:#FFFFFF;--img:1;color-scheme:light}
[data-theme=dark]{--bg:#0E0F11;--paper:#16181B;--ink:#ECECEA;--ink2:#C9CACC;--muted:#9EA2A9;--line:#25282C;--line2:#34383D;
--act:#ECECEA;--act-ink:#0E0F11;--crit:#F28B9B;--crit-soft:#2A1519;--ok:#6FC495;--ok-soft:#14231A;--warn:#E0AE62;--warn-soft:#2A2113;
--shadow:0 0 0 1px #25282C;--lift:0 0 0 1px #34383D,0 22px 48px rgba(0,0,0,.6);--route:#ECECEA;--halo:#0E0F11;--img:.9;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
[data-theme=dark] .tmap .img-light{display:none}:root:not([data-theme=dark]) .tmap .img-dark{display:none}
body{background:var(--bg);color:var(--ink);font:400 15px/1.5 var(--sans);-webkit-font-smoothing:antialiased;font-feature-settings:'tnum' 0}
a{color:inherit;text-decoration:none}
img{display:block;filter:brightness(var(--img))}
.ic{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex:none}
.serif{font-family:var(--serif);font-weight:400;letter-spacing:-.01em}
.label{font:600 11px/1.2 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.muted{color:var(--muted)} .small{font-size:13px}
.btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line2);
 background:var(--bg);color:var(--ink);font:600 14px var(--sans);cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--ink)}
.btn.primary{background:var(--act);color:var(--act-ink);border-color:var(--act)}
.btn.sm{height:32px;padding:0 12px;font-size:13px}
.btn.icon{width:40px;padding:0;justify-content:center}
.chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;background:var(--paper);font:600 12px var(--sans);color:var(--ink2);white-space:nowrap}
.chip.crit{background:var(--crit-soft);color:var(--crit)} .chip.ok{background:var(--ok-soft);color:var(--ok)} .chip.warn{background:var(--warn-soft);color:var(--warn)}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none;box-shadow:0 0 0 1.5px var(--bg),0 0 0 2.5px rgba(17,19,23,.25)}
/* top bar */
.top{position:sticky;top:0;z-index:20;height:64px;display:flex;align-items:center;gap:28px;padding:0 32px;background:color-mix(in srgb,var(--bg) 92%,transparent);
 backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.wordmark{font:400 26px/1 var(--serif);letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
.wordmark i{width:22px;height:22px;border:1.5px solid var(--ink);border-radius:50%;display:inline-grid;place-items:center}
.wordmark i:after{content:'';width:8px;height:8px;background:var(--ink);border-radius:50%}
.gnav{display:flex;gap:4px}
.gnav a{padding:8px 14px;border-radius:999px;font-weight:500;color:var(--muted)}
.gnav a[aria-current]{color:var(--ink);background:var(--paper)}
.top .sp{flex:1}
.switcher{display:flex;align-items:center;gap:10px;height:44px;padding:0 14px 0 4px;border:1px solid var(--line2);border-radius:999px;font-weight:600;cursor:pointer;background:var(--bg)}
.switcher img{width:36px;height:36px;border-radius:50%;object-fit:cover}
.switcher .ring{position:relative;display:inline-flex}
.switcher .ring:after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2.5px solid var(--tc)}
.switcher small{display:block;font:500 12px var(--sans);color:var(--muted);line-height:1.1}
.switcher b{display:block;line-height:1.2}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:600;font-size:14px}
/* trip header */
.thead{position:relative;height:240px;overflow:hidden;color:#fff}
.thead img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.thead:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.62));z-index:1}
.thead .band{position:absolute;top:0;left:0;right:0;height:6px;background:var(--tc);z-index:2}
.thead .in{position:absolute;left:40px;right:40px;bottom:28px;z-index:2;display:flex;align-items:flex-end;gap:24px}
.thead h1{font:400 84px/0.9 var(--serif);letter-spacing:-.02em}
.thead .meta{font-weight:500;opacity:.92;margin-top:10px;display:flex;gap:14px;align-items:center}
.thead .meta .chip{background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(6px)}
.thead .acts{margin-left:auto;display:flex;gap:10px}
.thead .btn{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.4);backdrop-filter:blur(8px)}
.thead .btn.primary{background:#fff;color:#111317;border-color:#fff}
.tabs{position:sticky;top:64px;z-index:15;display:flex;gap:2px;padding:0 32px;background:var(--bg);border-bottom:1px solid var(--line);align-items:center}
.tabs a{display:flex;align-items:center;gap:8px;height:52px;padding:0 16px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs a[aria-current]{color:var(--ink);border-color:var(--ink)}
.tabs a span{font-weight:500;font-size:12px;color:var(--muted)}
.tabs .crumb{margin-left:auto;display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px}
/* home */
.wrap{max-width:1312px;margin:0 auto;padding:0 32px}
.hello{padding:56px 0 32px;display:flex;align-items:flex-end;gap:24px}
.hello h1{font:400 64px/1 var(--serif);letter-spacing:-.02em}
.hello p{color:var(--muted);font-size:17px;margin-top:10px}
.hello .acts{margin-left:auto;display:flex;gap:10px}
.needs{display:grid;grid-template-columns:1fr 360px;gap:48px;padding-bottom:56px;border-bottom:1px solid var(--line)}
.needs h2,.sec h2{font:400 34px/1.1 var(--serif);margin-bottom:6px}
.group{margin-top:22px}
.ghead{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--ink)}
.ghead img{width:32px;height:32px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2.5px var(--bg),0 0 0 5px var(--tc)}
.ghead b{font-size:15px} .ghead span{color:var(--muted);font-size:13px}
.ghead a{margin-left:auto;font-size:13px;font-weight:600;display:flex;gap:4px;align-items:center}
.row{display:grid;grid-template-columns:110px 1fr auto;gap:20px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.row .due{font:400 26px/1 var(--serif)}
.row .due small{display:block;font:600 11px/1.4 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.row .due.crit,.row .due.crit small{color:var(--crit)}
.row .what{font-weight:600;font-size:16px}
.row .detail{color:var(--muted);font-size:13.5px}
.row .acts{display:flex;gap:6px}
.side h3{font:400 24px var(--serif);margin-bottom:12px}
.year{border:1px solid var(--line);border-radius:var(--r);padding:20px}
.ylane{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:10px;height:30px;font-size:13px;font-weight:500}
.ytrack{position:relative;height:100%;border-left:1px solid var(--line)}
.ytrack .bar{position:absolute;top:9px;height:12px;border-radius:3px;background:var(--tc)}
.ytrack .win{position:absolute;top:5px;width:2px;height:20px;background:var(--ink)}
.ymonths{display:grid;grid-template-columns:96px repeat(12,1fr);font:600 10px var(--sans);color:var(--muted);letter-spacing:.06em;margin-top:6px}
.ymonths span:first-child{grid-column:2}
.sec{padding:48px 0;border-bottom:1px solid var(--line)}
.sechead{display:flex;align-items:baseline;gap:16px;margin-bottom:24px}
.sechead p{color:var(--muted)}
.sechead .sp{flex:1}
.cards{display:grid;grid-template-columns:repeat(12,1fr);gap:28px}
.card{grid-column:span 4;display:flex;flex-direction:column}
.card.wide{grid-column:span 8} .card.half{grid-column:span 6} .card.third{grid-column:span 3}
.card .ph{position:relative;aspect-ratio:16/10;overflow:hidden;border-radius:var(--r)}
.card.wide .ph,.card.r1 .ph{aspect-ratio:auto;height:380px}
.card .ph img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.card:hover .ph img{transform:scale(1.03)}
.card .ph .tag{position:absolute;left:14px;top:14px;display:flex;gap:6px}
.card .ph .tag .chip{background:rgba(255,255,255,.92);color:#111317}
.card .ph .band{position:absolute;left:0;right:0;bottom:0;height:5px;background:var(--tc)}
.card h3{font:400 32px/1.05 var(--serif);margin-top:14px;display:flex;align-items:center;gap:10px}
.card.wide h3{font-size:44px}
.card .when{color:var(--muted);font-weight:500;margin-top:4px}
.card .next{margin-top:10px;display:flex;gap:8px;align-items:flex-start;font-size:14px}
.card .next .ic{margin-top:2px}
.ready{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:14px}
.ready div{font:600 10.5px var(--sans);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.ready i{display:block;height:4px;border-radius:2px;background:var(--line);margin-bottom:6px;position:relative;overflow:hidden}
.ready i b{position:absolute;inset:0 auto 0 0;background:var(--ink)}
.idea{border:1px dashed var(--line2);border-radius:var(--r);padding:22px;display:flex;flex-direction:column;gap:6px;justify-content:flex-end;min-height:180px;background:var(--paper)}
.idea h3{font:400 28px/1.05 var(--serif)}
.done{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.dcard{display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:center}
.dcard .ph{aspect-ratio:1;border-radius:var(--r);overflow:hidden;background:var(--paper);display:grid;place-items:center;color:var(--muted)}
.dcard .ph img{width:100%;height:100%;object-fit:cover;filter:saturate(.75) brightness(var(--img))}
.dcard h4{font:400 24px/1.1 var(--serif)}
.dcard .btn{margin-top:10px}
.credits{max-width:1312px;margin:0 auto;padding:40px 32px 64px;color:var(--muted);font-size:12px}
.credits h2{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;margin-bottom:6px}
.credits ol{columns:2;column-gap:40px;margin:10px 0 0 18px}
.credits a{text-decoration:underline;text-underline-offset:2px}
/* plan */
.plan{display:grid;grid-template-columns:248px 600px 1fr;height:calc(100vh - 64px - 52px - 240px);min-height:880px}
.outline{border-right:1px solid var(--line);padding:22px 18px;overflow:hidden;background:var(--bg)}
.outline .base{display:flex;align-items:center;gap:10px;margin:16px 0 6px}
.outline .base img,.outline .base .noimg{width:30px;height:30px;border-radius:6px;object-fit:cover;background:var(--paper)}
.outline .base b{font-size:14px} .outline .base span{margin-left:auto;font-size:12px;color:var(--muted)}
.oday{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;height:32px;padding:0 8px;border-radius:6px;font-size:13px}
.oday .n{font:400 20px/1 var(--serif);text-align:right}
.oday .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink2)}
.oday .dr{font-size:12px;color:var(--muted)}
.oday[aria-current]{background:var(--paper)} .oday[aria-current] .t{color:var(--ink);font-weight:600}
.oday .warn{width:6px;height:6px;border-radius:50%;background:var(--warn);display:inline-block;margin-left:4px;vertical-align:middle}
.lists{margin-top:20px;padding-top:14px;border-top:1px solid var(--line)}
.lists div{display:flex;justify-content:space-between;font-size:13px;padding:5px 8px;color:var(--ink2)}
.doc{overflow:hidden;padding:24px 36px 40px;border-right:1px solid var(--line)}
.nextbar{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r);background:var(--paper);font-size:14px}
.nextbar b{font-weight:600}
.nextbar .btn{margin-left:auto}
.addbox{display:flex;align-items:center;gap:10px;height:46px;padding:0 16px;border:1px solid var(--line2);border-radius:999px;color:var(--muted);margin:16px 0 8px}
.addbox kbd{margin-left:auto;font:500 12px var(--sans);border:1px solid var(--line2);border-radius:4px;padding:1px 6px}
.collapsed{display:grid;grid-template-columns:64px 1fr auto auto;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}
.collapsed .n{font:400 30px/1 var(--serif)}
.collapsed b{font-weight:600} .collapsed small{display:block;color:var(--muted);font-size:13px}
.collapsed img{width:64px;height:44px;border-radius:6px;object-fit:cover}
.day{padding:20px 0 8px;border-bottom:1px solid var(--line)}
.dayhead{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:end}
.dayhead .n{font:400 54px/.85 var(--serif)}
.dayhead .n small{display:block;font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.dayhead h3{font:400 30px/1.05 var(--serif)}
.dayhead .sum{display:flex;gap:14px;color:var(--muted);font-size:13px;margin-top:6px}
.dayhead .sum span{display:flex;gap:5px;align-items:center}
.items{margin:16px 0 8px;position:relative}
.item{position:relative;display:grid;grid-template-columns:22px 52px 26px 1fr 92px;gap:10px;align-items:start;padding:10px 0;border-radius:var(--r)}
.item .grip{color:var(--muted);padding-top:4px;cursor:grab;opacity:.85}
.item .grip .ic{stroke-width:2.6}
.item .time{font-weight:600;font-size:14px;padding-top:3px}
.item .time small{display:block;color:var(--muted);font-weight:500;font-size:12px}
.item .pin{width:24px;height:24px;border-radius:50%;background:var(--ink);color:var(--bg);font:600 12px/24px var(--sans);text-align:center;margin-top:1px}
.item h4{font-size:16.5px;font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.item .m{color:var(--muted);font-size:13px}
.item .note{font:400 17px/1.35 var(--serif);font-style:italic;color:var(--ink2);margin-top:4px}
.item .thumb{width:92px;height:68px;border-radius:8px;object-fit:cover}
.item .thumb.none{display:grid;place-items:center;background:var(--paper);color:var(--muted)}
.leg{display:flex;align-items:center;gap:8px;margin-left:110px;color:var(--muted);font-size:12.5px;height:28px}
.leg:before{content:'';width:1px;height:28px;background:var(--line2);margin-left:-26px;margin-right:16px}
.item.ghost{background:var(--bg);box-shadow:var(--lift);transform:rotate(-1deg) translate(14px,0);padding:10px 12px 10px 0;z-index:3;margin:8px 0 14px}
.item.ghost .grip{color:var(--ink);cursor:grabbing}
.item.from{opacity:.35}
.insert{position:relative;height:0;margin:2px 0 2px 26px;border-top:2px solid var(--ink)}
.insert:before,.insert:after{content:'';position:absolute;top:-6px;width:10px;height:10px;border-radius:50%;background:var(--ink)}
.insert:before{left:-6px} .insert:after{right:-6px}
.insert span{position:absolute;left:40px;top:-12px;font:600 12px var(--sans);background:var(--ink);color:var(--bg);padding:3px 8px;border-radius:999px}
.mapcol{position:relative;overflow:hidden;background:var(--paper)}
.mapcol .tmap{position:absolute;inset:0;width:100%;height:100%}
.mapbar{position:absolute;left:16px;right:16px;top:16px;z-index:2;display:flex;gap:8px;align-items:center}
.seg{display:inline-flex;background:var(--bg);border-radius:999px;padding:3px;box-shadow:var(--shadow)}
.seg button{border:0;background:none;height:32px;padding:0 14px;border-radius:999px;font:600 13px var(--sans);color:var(--muted);cursor:pointer}
.seg button[aria-selected=true]{background:var(--act);color:var(--act-ink)}
.maplegend{position:absolute;left:16px;bottom:16px;z-index:2;background:var(--bg);border-radius:var(--r);box-shadow:var(--shadow);padding:12px 14px;font-size:12.5px;display:grid;gap:6px}
.maplegend div{display:flex;align-items:center;gap:8px}
.maplegend i{width:22px;height:3px;border-radius:2px;background:var(--route)}
.zoom{position:absolute;right:16px;bottom:16px;z-index:2;display:grid;background:var(--bg);border-radius:10px;box-shadow:var(--shadow)}
.zoom button{width:38px;height:38px;border:0;background:none;color:var(--ink);font-size:18px}
/* map svg styling */
.tmap path{vector-effect:non-scaling-stroke}
.tmap .river{fill:none;stroke:#9DB8C9;stroke-width:1.5;opacity:.9}
[data-theme=dark] .tmap .river{stroke:#2E4656}
.tmap .border{fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:5 4;opacity:.6}
.tmap .route-halo{fill:none;stroke:var(--halo);stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.tmap .route{fill:none;stroke:var(--route);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tmap .route.dim{opacity:.22}.tmap .route-halo.dim{opacity:0}
.tmap .route.sel{stroke-width:3.5}
.tmap .stop circle{fill:var(--route);stroke:var(--halo)}
.tmap .stop text{fill:var(--halo);font-family:var(--sans);font-weight:600;text-anchor:middle}
.tmap .stop.dim{opacity:.3}
.tmap .base rect{fill:var(--bg);stroke:var(--route)}
.tmap .base path{fill:var(--route)}
.tmap .base-label{fill:var(--ink);font-family:var(--serif);font-style:italic;paint-order:stroke;stroke:var(--halo);stroke-linejoin:round}
.tmap .edge-label{fill:var(--ink);font-family:var(--sans);font-weight:600;paint-order:stroke;stroke:var(--halo)}
/* bookings */
.frame{margin:28px auto;width:1440px;border:1px solid var(--line2);border-radius:14px;overflow:hidden;position:relative;background:var(--bg);box-shadow:var(--shadow)}
.frame-cap{width:1440px;margin:40px auto 0;display:flex;gap:14px;align-items:baseline}
.frame-cap b{font:400 30px var(--serif)} .frame-cap span{color:var(--muted)}
.bk{display:grid;grid-template-columns:1fr 380px;gap:40px;padding:28px 40px 40px}
.bkrow{display:grid;grid-template-columns:44px 1fr 170px 150px;gap:16px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
.bkrow .k{width:44px;height:44px;border-radius:50%;background:var(--paper);display:grid;place-items:center}
.bkrow b{font-weight:600;font-size:15.5px} .bkrow small{display:block;color:var(--muted);font-size:13px}
.bkrow .r{text-align:right;font-size:13.5px}
.bkday{font:400 22px var(--serif);margin:22px 0 2px}
.pop{position:absolute;z-index:40;background:var(--bg);border-radius:16px;box-shadow:var(--lift);border:1px solid var(--line)}
.sw{right:150px;top:58px;width:420px;padding:10px}
.sw h5{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);padding:10px 10px 6px}
.swrow{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;padding:8px 10px;border-radius:10px}
.swrow img{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 4.5px var(--tc)}
.swrow b{display:block;font-size:15px} .swrow small{display:block;color:var(--muted);font-size:12.5px;line-height:1.35}
.swrow small.crit{color:var(--crit);font-weight:600}
.swrow.hover{background:var(--paper)} .swrow .go{font-size:12px;font-weight:600;color:var(--ink);display:flex;gap:4px;align-items:center}
.swrow .cur{font-size:12px;color:var(--muted);display:flex;gap:4px;align-items:center}
.swfoot{display:flex;justify-content:space-between;padding:10px 10px 6px;border-top:1px solid var(--line);margin-top:6px;font-size:13px;color:var(--muted)}
.drawer{position:absolute;right:0;top:0;bottom:0;width:460px;background:var(--bg);border-left:1px solid var(--line);box-shadow:var(--lift);z-index:30;display:flex;flex-direction:column}
.drawer .dh{padding:0;position:relative;height:150px;color:#fff;overflow:hidden}
.drawer .dh img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.drawer .dh:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.65));z-index:1}
.drawer .dh .band{position:absolute;top:0;left:0;right:0;height:6px;background:var(--tc);z-index:2}
.drawer .dh .in{position:absolute;left:24px;right:24px;bottom:16px;z-index:2}
.drawer .dh small{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;opacity:.9}
.drawer .dh h3{font:400 34px/1.05 var(--serif)}
.drawer .body{padding:20px 24px;display:grid;gap:14px;overflow:hidden}
.field label{display:block;font:600 12px var(--sans);color:var(--muted);margin-bottom:6px}
.field .in{height:44px;border:1px solid var(--line2);border-radius:var(--rc);display:flex;align-items:center;padding:0 12px;gap:8px;font-size:15px}
.field .in.focus{border-color:var(--ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--ink) 12%,transparent)}
.kinds{display:flex;gap:6px;flex-wrap:wrap}
.kinds span{height:34px;padding:0 12px;border:1px solid var(--line2);border-radius:999px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600}
.kinds span.on{background:var(--act);color:var(--act-ink);border-color:var(--act)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.drawer .foot{margin-top:auto;padding:16px 24px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:center}
.toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;background:var(--ink);color:var(--bg);border-radius:999px;padding:10px 16px 10px 10px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:var(--lift)}
.toast img{width:28px;height:28px;border-radius:50%;object-fit:cover}
.toast a{text-decoration:underline;font-weight:600}
.dim-under:after{content:'';position:absolute;inset:0;background:rgba(17,19,23,.10);z-index:25}
/* public trip */
.cover{position:relative;height:640px;color:#fff;overflow:hidden}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,0) 30%,rgba(0,0,0,.65));z-index:1}
.cover .in{position:absolute;left:0;right:0;bottom:56px;z-index:2}
.cover .kick{font:600 12px var(--sans);letter-spacing:.12em;text-transform:uppercase;opacity:.92}
.cover h1{font:400 128px/.92 var(--serif);letter-spacing:-.025em;margin-top:26px}
.cover h1 em{font-style:italic}
.cover p{font:400 22px/1.4 var(--serif);max-width:640px;margin-top:18px;opacity:.95}
.cover .acts{display:flex;gap:12px;margin-top:26px;align-items:center}
.cover .btn{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.45);backdrop-filter:blur(8px)}
.cover .btn.primary{background:#fff;color:#111317}
.cover .by{font-size:14px;opacity:.9;margin-left:8px}
.facts{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--line)}
.facts div{padding:22px 24px;border-right:1px solid var(--line)}
.facts div:last-child{border-right:0}
.facts b{display:block;font:400 34px/1.05 var(--serif)}
.facts small{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.season{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;padding:56px 0;border-bottom:1px solid var(--line)}
.season h2{font:400 46px/1.02 var(--serif);margin-top:10px}
.season p.why{font:400 20px/1.4 var(--serif);color:var(--ink2);margin-top:12px;font-style:italic}
.months{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-top:26px}
.months div{text-align:center;font:600 11px var(--sans);color:var(--muted);letter-spacing:.05em}
.months i{display:block;height:34px;border-radius:4px;background:var(--paper);margin-bottom:6px}
.months .on i{background:var(--ink)} .months .on{color:var(--ink)}
.months .sh i{background:repeating-linear-gradient(135deg,var(--line2) 0 4px,transparent 4px 8px)}
.wx{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--ink)}
.wx div{padding:16px 16px 16px 0}
.wx b{display:block;font:400 26px/1.1 var(--serif);margin-top:6px}
.wx span{color:var(--muted);font-size:13.5px}
.season ul{margin-top:18px;list-style:none;display:grid;gap:8px}
.season li{display:flex;gap:10px;font-size:14.5px}
.pdays{display:grid;grid-template-columns:repeat(3,1fr);gap:40px 28px}
.pday .ph{aspect-ratio:4/3;border-radius:var(--r);overflow:hidden;background:var(--paper)}
.pday .ph img{width:100%;height:100%;object-fit:cover}
.pday .n{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-top:14px;display:flex;justify-content:space-between}
.pday h3{font:400 28px/1.08 var(--serif);margin-top:4px}
.pday ul{list-style:none;margin-top:8px;color:var(--ink2);font-size:14px;display:grid;gap:3px}
.pday li:before{content:'·';margin-right:8px;color:var(--muted)}
.morelist{margin-top:40px;border-top:1px solid var(--ink)}
.morelist div{display:grid;grid-template-columns:80px 1fr 200px 100px;gap:16px;padding:14px 0;border-bottom:1px solid var(--line);align-items:baseline}
.morelist .n{font:400 26px var(--serif)}
.morelist span{color:var(--muted);font-size:13.5px}
.suits{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.suits div{border-top:1px solid var(--ink);padding-top:12px}
.suits b{display:block;font:400 26px/1.15 var(--serif);margin-top:6px}
.sticky-copy{position:fixed;right:28px;bottom:28px;z-index:30;background:var(--bg);border-radius:16px;box-shadow:var(--lift);padding:14px 14px 14px 18px;display:flex;align-items:center;gap:16px;width:420px}
.sticky-copy small{display:block;color:var(--muted);font-size:12.5px}
/* trail */
.thero{position:relative;height:560px;color:#fff;overflow:hidden}
.thero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%}
.thero:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,0) 35%,rgba(0,0,0,.7));z-index:1}
.thero .in{position:absolute;left:0;right:0;bottom:44px;z-index:2}
.thero h1{font:400 96px/.9 var(--serif);letter-spacing:-.02em;margin-top:10px}
.thero p{font:400 21px/1.4 var(--serif);max-width:720px;margin-top:14px;opacity:.95}
.thero .acts{display:flex;gap:10px;margin-top:22px}
.thero .btn{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.45);backdrop-filter:blur(8px)}
.thero .btn.primary{background:#fff;color:#111317}
.src{display:inline-flex;align-items:center;gap:4px;font:600 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.src i{width:6px;height:6px;border-radius:50%;background:var(--ok)}
.src.c-community i{background:var(--warn)} .src.c-plan i{background:var(--muted)}
.tgrid{display:grid;grid-template-columns:1fr 400px;gap:56px;padding:48px 0}
.tsec{padding-bottom:36px;margin-bottom:36px;border-bottom:1px solid var(--line)}
.tsec h2{font:400 34px/1.1 var(--serif);margin-bottom:16px}
.elev{width:100%;height:auto;overflow:visible}
.elev .a{fill:color-mix(in srgb,var(--ink) 7%,transparent)} .elev .l{fill:none;stroke:var(--ink);stroke-width:2}
.elev .g{stroke:var(--line);stroke-width:1} .elev .gl,.elev .xl{fill:var(--muted);font:500 11px var(--sans)}
.elev .mk circle{fill:var(--bg);stroke:var(--ink);stroke-width:2}
.huts{display:grid;grid-template-columns:repeat(5,1fr);margin-top:14px;border-top:1px solid var(--line)}
.huts div{padding:10px 10px 0 0;font-size:13px} .huts b{display:block;font-weight:600}
.th{display:grid;grid-template-columns:300px 1fr;gap:28px}
.th img{width:100%;aspect-ratio:4/3;border-radius:var(--r);object-fit:cover}
.kv{display:grid;grid-template-columns:150px 1fr;gap:10px 18px;font-size:14.5px}
.kv dt{color:var(--muted)} .kv dd b{font-weight:600}
.window{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:var(--r);background:var(--warn-soft);margin-top:18px;font-size:14px}
.window b{color:var(--warn)}
.links h3{font:600 11px var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:22px 0 4px}
.lnk{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:11px 0;border-bottom:1px solid var(--line)}
.lnk b{font-weight:600;font-size:14.5px} .lnk span{color:var(--muted);font-size:12.5px}
.lnk .ic{grid-row:span 2;align-self:center;color:var(--muted)}
.minimap{position:relative;height:300px;border-radius:var(--r);overflow:hidden;background:var(--paper)}
.minimap svg{position:absolute;inset:0;width:100%;height:100%}
.addtrip{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--line2);border-radius:var(--r);margin-bottom:28px}
.addtrip img{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 4.5px var(--tc)}
.addtrip small{display:block;color:var(--muted);font-size:12.5px}
.gallery{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:8px}
.gallery img{width:100%;height:180px;object-fit:cover;border-radius:8px}
/* phones */
.canvas{display:flex;gap:56px;justify-content:center;padding:48px 40px 24px;background:var(--paper);min-height:100vh;align-items:flex-start}
.phonewrap{display:flex;flex-direction:column;gap:14px;align-items:center}
.phonecap{width:390px;font-size:13.5px;color:var(--muted)} .phonecap b{display:block;color:var(--ink);font:400 24px var(--serif)}
.phone{width:390px;height:844px;border-radius:44px;background:var(--bg);overflow:hidden;position:relative;box-shadow:0 0 0 10px #1A1C20,0 30px 80px rgba(0,0,0,.25)}
.status{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font:600 15px var(--sans)}
.ptop{display:flex;align-items:center;gap:10px;padding:6px 16px 10px}
.ptop img{width:38px;height:38px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 4.5px var(--tc)}
.ptop b{display:block;font:400 24px/1 var(--serif)} .ptop small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.ptop .sp{flex:1}
.ptop .btn.icon{width:40px;height:40px}
.bnav{position:absolute;left:0;right:0;bottom:0;height:84px;border-top:1px solid var(--line);background:var(--bg);display:grid;grid-template-columns:repeat(5,1fr);padding:8px 6px 26px}
.bnav a{display:flex;flex-direction:column;align-items:center;gap:3px;font:600 11px var(--sans);color:var(--muted)}
.bnav a[aria-current]{color:var(--ink)}
.dstrip{display:flex;gap:6px;padding:4px 16px 10px;overflow:hidden}
.dstrip div{flex:none;width:50px;height:58px;border-radius:12px;border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:var(--muted);font-weight:600}
.dstrip div b{font:400 22px/1 var(--serif);color:var(--ink)}
.dstrip div[aria-current]{background:var(--act);border-color:var(--act);color:var(--act-ink)}
.dstrip div[aria-current] b{color:var(--act-ink)}
.pbody{padding:0 16px}
.pday-h{display:flex;align-items:flex-end;gap:12px;margin:6px 0 4px}
.pday-h .n{font:400 46px/.85 var(--serif)}
.pday-h h3{font:400 24px/1.05 var(--serif)}
.pday-h small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.pitem{display:grid;grid-template-columns:20px 44px 1fr 64px;gap:8px;padding:10px 0;align-items:start}
.pitem .grip{color:var(--muted);padding-top:3px}.pitem .grip .ic{stroke-width:2.6}
.pitem .time{font-weight:600;font-size:13.5px;padding-top:2px}
.pitem b{font-weight:600;font-size:15px;line-height:1.25;display:block} .pitem small{color:var(--muted);font-size:12.5px;display:block}
.pitem img{width:64px;height:52px;border-radius:8px;object-fit:cover}
.pleg{margin-left:72px;font-size:12px;color:var(--muted);height:22px;display:flex;align-items:center;gap:6px}
.sheet{position:absolute;left:0;right:0;bottom:84px;background:var(--bg);border-radius:20px 20px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.12);padding:8px 16px 14px}
.sheet .grab{width:40px;height:5px;border-radius:3px;background:var(--line2);margin:0 auto 10px}
.pmap{position:absolute;left:0;right:0;top:150px;bottom:84px;overflow:hidden}
.pmap svg{position:absolute;inset:0;width:100%;height:100%}
/* today */
.tbanner{margin:0 16px 10px;padding:10px 12px;border-radius:12px;background:var(--paper);font-size:13px;display:flex;gap:10px;align-items:center}
.tbanner img{width:28px;height:28px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--tc2)}
.tbanner b{font-weight:600}
.tbanner .btn{margin-left:auto;height:30px;font-size:12.5px;padding:0 10px}
.thead-ph{position:relative;height:164px;margin:0 16px;border-radius:18px;overflow:hidden;color:#fff}
.thead-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.thead-ph:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.7));z-index:1}
.thead-ph .band{position:absolute;left:0;right:0;top:0;height:5px;background:var(--tc);z-index:2}
.thead-ph .in{position:absolute;left:16px;right:16px;bottom:12px;z-index:2}
.thead-ph small{font:600 11px var(--sans);letter-spacing:.1em;text-transform:uppercase;opacity:.92}
.thead-ph h2{font:400 34px/1 var(--serif)}
.leave{padding:16px 16px 8px}
.leave small{font:600 11px var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.leave .big{font:400 76px/.9 var(--serif);letter-spacing:-.02em;margin-top:6px}
.leave .big em{font-style:italic;font-size:30px;color:var(--muted);margin-left:8px;letter-spacing:0}
.leave p{color:var(--ink2);font-size:14px;margin-top:6px}
.leave .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.leave .btn{height:50px;justify-content:center;font-size:15px}
.late{margin:12px 16px;padding:12px;border:1px solid var(--line);border-radius:14px}
.late .opts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.late .opts span{height:42px;border-radius:10px;border:1px solid var(--line2);display:grid;place-items:center;font-weight:600;font-size:14px}
.late .opts span.on{background:var(--act);color:var(--act-ink);border-color:var(--act)}
.conseq{margin-top:10px;display:grid;gap:6px;font-size:13px}
.conseq div{display:flex;gap:8px;align-items:flex-start}
.conseq .ok{color:var(--ok)} .conseq .crit{color:var(--crit)}
.tlist{padding:4px 16px}
.titem{display:grid;grid-template-columns:44px 18px 1fr;gap:10px;padding:8px 0;align-items:start;font-size:14px}
.titem .t{font-weight:600}
.titem .c{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line2);margin-top:3px}
.titem.now .c{border-color:var(--ink);background:var(--ink)}
.titem b{font-weight:600;display:block} .titem small{color:var(--muted);font-size:12.5px}
.offline{margin:0 16px 10px;padding:10px 12px;border-radius:12px;border:1px solid var(--line2);display:flex;gap:10px;align-items:center;font-size:13px}
.offline b{font-weight:600}
"""


def tc(trip_id: str) -> str:
    return f'style="--tc:{C.swatch(trip_id)}"'


def topbar(cr: C.Credits, *, current: str | None, active: str = "Trips") -> str:
    nav = "".join(f'<a href="#"{" aria-current=page" if n == active else ""}>{n}</a>' for n in ("Trips", "Discover", "Explore", "Templates"))
    if current:
        t = D.TRIP[current]
        sw = (f'<div class="switcher" {tc(current)}><span class="ring"><img src="{cr.url(t["photo"], 330)}" alt=""></span>'
              f'<span><small>Trip</small><b>{esc(t["title"])}</b></span>{icon("chev", 16)}</div>')
    else:
        sw = '<div class="switcher" style="padding-left:14px">' + icon("swap", 16) + '<span><b>Open a trip</b></span>' + icon("chev", 16) + '</div>'
    return (f'<header class="top"><a class="wordmark" href="#"><i></i>Waymark</a><nav class="gnav">{nav}</nav><div class="sp"></div>'
            f'{sw}<button class="btn icon" aria-label="Notifications">{icon("bell")}</button>'
            f'<button class="btn icon" data-toggle-theme aria-label="Theme">{icon("sun")}</button><div class="avatar">N</div></header>')


def trip_header(cr: C.Credits, trip_id: str, tab: str, *, photo: str | None = None, height: int = 240) -> str:
    t = D.TRIP[trip_id]
    tabs = [("Overview", ""), ("Plan", "14 days"), ("Today", ""), ("Bookings", "3 of 9"), ("Tasks", "1 of 12"), ("Budget", "43%")]
    if trip_id == "patagonia":
        tabs = [("Overview", ""), ("Plan", "13 days"), ("Today", ""), ("Bookings", "0 of 8"), ("Tasks", "2 of 19"), ("Budget", "8%")]
    tabh = "".join(f'<a href="#"{" aria-current=page" if n == tab else ""}>{n}{f" <span>{c}</span>" if c else ""}</a>' for n, c in tabs)
    travellers = "3 travellers"
    return (f'<section class="thead" style="--tc:{C.swatch(trip_id)};height:{height}px"><img src="{cr.url(photo or t["photo"], 1920)}" {D.focus(photo or t["photo"])} alt="">'
            f'<div class="band"></div><div class="in"><div><h1>{esc(t["title"])}</h1>'
            f'<div class="meta"><span>{esc(t["dates"])}</span><span>·</span><span>{t["nights"]} nights · {travellers}</span>'
            f'<span class="chip">{t["phase"]}</span></div></div>'
            f'<div class="acts"><button class="btn">{icon("users", 16)} Share</button><button class="btn">{icon("download", 16)} Offline</button></div></div></section>'
            f'<nav class="tabs">{tabh}<div class="crumb">{icon("undo", 16)} Undo · saved 18:42</div></nav>')


def readiness(r) -> str:
    names = ("Plan", "Book", "Prepare", "Go")
    return '<div class="ready">' + "".join(f'<div><i><b style="width:{v * 100:.0f}%"></b></i>{n}</div>' for n, v in zip(names, r)) + "</div>"


def year_view() -> str:
    # Oct 2026 .. Sep 2027 = 12 months; positions in months from 1 Oct 2026
    lanes = [("elora", 0.75, 0.78, [0.6]), ("patagonia", 4.85, 5.35, [1.0, 1.47, 1.97]), ("costa-rica", 4.4, 4.75, []),
             ("dolomites", 9.4, 9.85, [5.47, 8.0, 8.47]), ("iceland", 11.1, 11.5, [])]
    out = []
    for tid, a, b, wins in lanes:
        t = D.TRIP[tid]
        w = "".join(f'<i class="win" style="left:{x / 12 * 100:.2f}%" title="booking window"></i>' for x in wins)
        out.append(f'<div class="ylane" {tc(tid)}><span>{esc(t["title"].split(" ")[0])}</span><div class="ytrack">'
                   f'<i class="bar" style="left:{a / 12 * 100:.2f}%;width:{max(b - a, .12) / 12 * 100:.2f}%"></i>{w}</div></div>')
    months = "".join(f"<span>{m}</span>" for m in "O N D J F M A M J J A S".split())
    return ('<div class="year"><div class="label" style="margin-bottom:10px">Oct 2026 – Sep 2027 · bars are trips, ticks are booking windows</div>'
            + "".join(out) + f'<div class="ymonths">{months}</div></div>')


def home() -> str:
    cr = C.Credits()
    groups = []
    order = ["elora", "patagonia", "dolomites", "person"]
    for g in order:
        rows = [n for n in D.NEEDS if n["trip"] == g]
        if g == "dolomites":
            rows = [dict(trip="dolomites", what="Book the Ortisei stay, 4 nights", detail="Guest Pass hotels; nothing else due before March", due="Mon 15 Mar", when="in 5 months", tab="Bookings", urgent=False)]
        if g == "person":
            n = rows[0]
            head = (f'<div class="ghead" style="--tc:var(--ink)"><span class="avatar" style="width:32px;height:32px;font-size:13px">A</span>'
                    f'<b>Aarav</b><span>person · linked to</span>'
                    + "".join(f'<span class="chip"><i class="dot" style="background:{C.swatch(x)}"></i>{D.TRIP[x]["title"]}</span>' for x in n["links"])
                    + '<a href="#">People ' + icon("chevr", 14) + '</a></div>')
        else:
            t = D.TRIP[g]
            head = (f'<div class="ghead" {tc(g)}><img src="{cr.url(t["photo"], 330)}" alt=""><b>{esc(t["title"])}</b>'
                    f'<span>{esc(t["dates"])} · {t["phase"]}</span><a href="#">Open trip {icon("chevr", 14)}</a></div>')
        body = ""
        for n in rows:
            day, rest = n["due"].split(" ", 1)
            num = rest.split(" ")[0]
            body += (f'<div class="row"><div class="due{" crit" if n["urgent"] else ""}">{num}<small>{day}, {rest.split(" ")[1]}</small><small style="margin-top:0;text-transform:none;letter-spacing:0;font-weight:500">{n["when"]}</small></div>'
                     f'<div><div class="what">{esc(n["what"])}</div><div class="detail">{esc(n["detail"])}</div></div>'
                     f'<div class="acts"><button class="btn sm icon" aria-label="Done">{icon("check", 16)}</button>'
                     f'<button class="btn sm">Snooze</button><button class="btn sm primary">Open in {n["tab"]}</button></div></div>')
        groups.append(f'<div class="group">{head}{body}</div>')
    needs = (f'<section class="needs"><div><h2>Needs you this week</h2><p class="muted">Grouped by trip, soonest first. Open lands inside the trip on the right tab.</p>{"".join(groups)}</div>'
             f'<aside class="side"><h3>The year at a glance</h3>{year_view()}'
             f'<p class="small muted" style="margin-top:12px">Feb 2027: Costa Rica and Patagonia overlap in spend. Each keeps its own budget; '
             f'<a href="#" style="text-decoration:underline">Year view</a> totals both, CAD and USD.</p></aside></section>')

    def card(tid: str, cls: str = "") -> str:
        t = D.TRIP[tid]
        w = 1920 if "wide" in cls else 960
        nxt = (f'<div class="next">{icon("clock", 16)}<span><b>{esc(t["next"])}</b>{" · " + t["due"] if t["due"] else ""}</span></div>') if t["next"] else ""
        away = f'<span class="chip">{t["away"]}</span>' if t["away"] else ""
        return (f'<article class="card {cls}" {tc(tid)}><div class="ph"><img src="{cr.url(t["photo"], w)}" {D.focus(t["photo"])} alt="{esc(D.PHOTOS[t["photo"]][3])}">'
                f'<div class="tag"><span class="chip">{t["phase"]}</span>{away}</div><div class="band"></div></div>'
                f'<h3><i class="dot" style="background:var(--tc)"></i>{esc(t["title"])}</h3><div class="when">{esc(t["dates"])} · {esc(t["sub"])}</div>'
                f'{readiness(t["ready"])}{nxt}</article>')

    upcoming = (f'<section class="sec"><div class="sechead"><h2>Upcoming</h2><p>Seven trips, soonest first</p><div class="sp"></div>'
                f'<div class="seg"><button aria-selected="true" data-tab>Cards</button><button data-tab>List</button><button data-tab>Table</button><button data-tab>Map</button></div></div>'
                f'<div style="display:flex;gap:8px;align-items:center;margin:-8px 0 22px"><span class="addbox" style="margin:0;width:300px;height:40px">{icon("search", 16)} Search trips<kbd>/</kbd></span>'
                + "".join(f'<span class="chip" style="height:36px;padding:0 14px">{n} {icon("chev", 13)}</span>' for n in ("When", "Phase", "Who", "Source"))
                + f'<span style="flex:1"></span><span class="small muted">Group by</span><span class="chip" style="height:36px">When {icon("chev", 13)}</span><span class="small muted">Sort</span><span class="chip" style="height:36px">Soonest first {icon("chev", 13)}</span></div>'
                f'<div class="cards">{card("elora", "wide")}{card("patagonia", "r1")}{card("costa-rica")}{card("dolomites")}{card("iceland")}'
                f'{card("chamonix", "half")}{card("rockies", "half")}</div></section>')
    ideas = "".join(
        (f'<article class="card"><div class="ph"><img src="{cr.url(i["photo"], 960)}" alt=""></div><h3>{esc(i["title"])}</h3><div class="when">{esc(i["sub"])}</div><div class="next">{esc(i["note"])}</div></article>'
         if i["photo"] else f'<article class="card"><div class="idea"><span class="label">Idea · no photo yet</span><h3>{esc(i["title"])}</h3><span class="muted">{esc(i["sub"])} · {esc(i["note"])}</span></div></article>')
        for i in D.IDEAS)
    ideas_sec = (f'<section class="sec"><div class="sechead"><h2>Ideas</h2><p>Not dated yet</p></div><div class="cards">{ideas}'
                 f'<article class="card"><div class="idea" style="align-items:flex-start"><span class="label">New</span><h3>Start from a template or a place</h3>'
                 f'<button class="btn primary sm" style="margin-top:8px">{icon("plus", 16)} Plan a trip</button></div></article></div></section>')
    done = "".join(
        f'<div class="dcard"><div class="ph">{f"<img src={chr(34)}{cr.url(d["photo"], 330)}{chr(34)} alt={chr(34)}{chr(34)}>" if d["photo"] else icon("map", 28)}</div>'
        f'<div><span class="label">Done · {esc(d["dates"])}</span><h4>{esc(d["title"])}</h4><span class="small muted">{esc(d["note"])}</span><br>'
        f'<button class="btn sm">{icon("copy", 15)} Use as a template</button></div></div>' for d in D.DONE)
    done_sec = (f'<section class="sec" style="border:0"><div class="sechead"><h2>Done, ready to reuse</h2><p>Read-only; copy one to start a new trip</p></div>'
                f'<div class="done">{done}</div></section>')
    body = (topbar(cr, current=None) + '<main class="wrap"><div class="hello"><div><h1>Good evening, Nitin</h1>'
            '<p>Monday 18 October. Three trips are moving: Elora on Saturday, Patagonia and the Dolomites in booking.</p></div>'
            f'<div class="acts"><button class="btn">{icon("mail", 16)} Forward a confirmation</button><button class="btn primary">{icon("plus", 16)} Plan a trip</button></div></div>'
            + needs + upcoming + ideas_sec + done_sec + "</main>" + cr.html())
    return C.page("Atlas · Trips home", CSS, body)


def item_row(cr, n, it, *, ghost=False, from_=False, grip=True) -> str:
    time, pid, name, kind, meta, note, ticket, photo = it
    tk = {"booked": '<span class="chip ok">' + icon("check", 13) + ' booked</span>', "to_book": '<span class="chip warn">to book</span>'}.get(ticket or "", "")
    thumb = f'<img class="thumb" src="{cr.url(photo, 330)}" alt="">' if photo else f'<div class="thumb none">{icon(C.KIND_ICON.get(kind, "pin"), 22)}</div>'
    cls = "item" + (" ghost" if ghost else "") + (" from" if from_ else "")
    return (f'<div class="{cls}"><div class="grip" title="Drag to move">{icon("grip", 18)}</div><div class="time">{time}</div><div class="pin">{n}</div>'
            f'<div><h4>{esc(name)} {tk}</h4><div class="m">{esc(meta)}</div>{f"<div class=note>{esc(note)}</div>" if note else ""}</div>{thumb}</div>')


def plan() -> str:
    cr = C.Credits()
    # outline
    out = []
    for b in D.BASES:
        img = f'<img src="{cr.url(b["photo"], 330)}" alt="">' if b["photo"] else f'<i class="noimg" style="display:grid;place-items:center">{icon("home", 16)}</i>'
        out.append(f'<div class="base">{img}<b>{b["name"]}</b><span>{b["nights"]}</span></div>')
        for n, date, title, drive, _ in D.DAYS:
            if b["days"][0] <= n <= b["days"][1]:
                warn = '<i class="warn"></i>' if n in D.DAY_FLAG else ""
                out.append(f'<div class="oday"{" aria-current=true" if n == 3 else ""}><span class="n">{n}</span><span class="t">{esc(title)}</span><span class="dr">{drive}{warn}</span></div>')
    outline = (f'<aside class="outline"><div class="label">Days · drive time</div>{"".join(out)}'
               '<div class="lists"><div class="label" style="padding:0 8px 4px">Lists</div><div><span>Ideas</span><span>4</span></div><div><span>Food and huts</span><span>1</span></div></div></aside>')
    # document
    d1, d2, d3, d4 = D.DAYS[0], D.DAYS[1], D.DAYS[2], D.DAYS[3]

    def collapsed(d):
        n, date, title, drive, _ = d
        ph = D.DAY_PHOTO.get(n)
        img = f'<img src="{cr.url(ph, 330)}" alt="">' if ph else ""
        return f'<div class="collapsed"><span class="n">{n}</span><div><b>{esc(title)}</b><small>{date} · {drive} driving</small></div>{img}<span>{icon("chev", 18)}</span></div>'

    def dayhead(d, walk):
        n, date, title, drive, _ = d
        return (f'<div class="dayhead"><div class="n"><small>Day</small>{n}</div><div><h3>{esc(title)}</h3>'
                f'<div class="sum"><span>{date}</span><span>{icon("drive", 14)}{drive}</span><span>{icon("trail", 14)}{walk}</span><span>{icon("home", 14)}San Candido</span></div></div>'
                f'<button class="btn sm icon" aria-label="Day menu">{icon("more", 16)}</button></div>')
    i2 = d2[4]; i3 = d3[4]
    day2 = (f'<section class="day">{dayhead(d2, "6.7 km · 90 m")}<div class="items">{item_row(cr, 1, i2[0])}'
            f'<div class="leg">{icon("drive", 14)} 55 min · 41 km · back via Dobbiaco</div>{item_row(cr, 2, i2[1])}</div></section>')
    day3 = (f'<section class="day">{dayhead(d3, "12 km · 600 m")}<div class="items">'
            f'<div class="leg" style="margin-top:-4px">{icon("drive", 14)} Leave 10:15 · 38 min · 29 km to the toll gate</div>'
            f'<div class="insert"><span>Drop: before 11:30, recalculates the day</span></div>'
            f'{item_row(cr, 2, i3[1], ghost=True)}'
            f'{item_row(cr, 1, i3[0])}<div class="leg">{icon("trail", 14)} 6 min walk</div>{item_row(cr, 2, i3[1], from_=True)}</div></section>')
    doc = (f'<div class="doc"><div class="nextbar">{icon("clock", 18)}<span><b>Next:</b> book the Ortisei stay by Mon 15 Mar · '
           f'Tre Cime toll slot opens Tue 15 Jun</span><button class="btn sm">Bookings</button></div>'
           f'<div class="addbox">{icon("search", 18)} Add a place, paste a link or a note<kbd>/</kbd></div>'
           f'{collapsed(d1)}{day2}{day3}{collapsed(d4)}{collapsed(D.DAYS[4])}</div>')
    mp = C.trip_map(MAP, pane=(592, 900), pin_px=11, box=(11.30, 46.30, 12.40, 46.80),
                    edges=[("↓ Venice, 2 h 30", 12.33, 46.39, -120, 4), ("↓ Venice, 2 h 40", 11.36, 46.39, 8, 4)])
    mapcol = (f'<div class="mapcol">{mp}<div class="mapbar"><div class="seg"><button aria-selected="true" data-tab>All 14 days</button>'
              f'<button data-tab>Day 3</button><button data-tab>Bases</button></div></div>'
              f'<div class="maplegend"><div><i></i>Drive, every day</div><div>{icon("home", 14)} Base, where you sleep</div><div class="muted">Pick a day to fade the others</div></div>'
              f'<div class="zoom"><button>+</button><button>−</button></div></div>')
    body = (topbar(cr, current="dolomites") + trip_header(cr, "dolomites", "Plan", height=200) +
            f'<div class="plan">{outline}{doc}{mapcol}</div>' + cr.html())
    css = CSS + ".plan{height:auto;min-height:0;grid-template-rows:900px}.thead h1{font-size:72px}"
    return C.page("Atlas · Plan", css, body)


def phone_status() -> str:
    return '<div class="status"><span>18:42</span><span>●●● 5G</span></div>'


def plan_phone() -> str:
    cr = C.Credits()
    t = D.TRIP["dolomites"]
    top = (f'<div class="ptop" {tc("dolomites")}><img src="{cr.url(t["photo"], 330)}" alt=""><div><b>Dolomites</b><small>13 – 26 Jul 2027 · Booking</small></div>'
           f'<div class="sp"></div><button class="btn icon" aria-label="Switch trip">{icon("swap", 18)}</button></div>')
    strip = '<div class="dstrip">' + "".join(f'<div{" aria-current=true" if d[0] == 3 else ""}><b>{d[0]}</b>{d[1][:3]}</div>' for d in D.DAYS[:7]) + "</div>"
    nav = ('<nav class="bnav">' + "".join(f'<a href="#"{" aria-current=page" if n == cur else ""}>{icon(i, 22)}{n}</a>' for n, i, cur in
           [("Plan", "map", "Plan"), ("Today", "sun", ""), ("Bookings", "ticket", ""), ("Tasks", "check", ""), ("Budget", "wallet", "")]) + "</nav>")
    d3 = D.DAYS[2]
    items = ""
    for i, it in enumerate(d3[4]):
        time, pid, name, kind, meta, note, ticket, photo = it
        items += (f'<div class="pitem"><div class="grip">{icon("grip", 16)}</div><div class="time">{time}</div><div><b>{esc(name)}</b><small>{esc(meta)}</small>'
                  f'{f"<small style=font-style:italic;font-family:var(--serif);font-size:15px;color:var(--ink2)>{esc(note)}</small>" if note else ""}</div>'
                  f'<img src="{cr.url(photo, 330)}" alt=""></div>')
        if i == 0:
            items += f'<div class="pleg">{icon("trail", 13)} 6 min walk</div>'
    f1 = (f'<div class="phone">{phone_status()}{top}{strip}<div class="pbody"><div class="pday-h"><span class="n">3</span><div><h3>Tre Cime di Lavaredo</h3>'
          f'<small>Thu 15 Jul · {icon("drive", 12)} 1 h 10 · 12 km walk · base San Candido</small></div></div>'
          f'<div class="pleg" style="margin-left:0">{icon("drive", 13)} Leave 10:15 · 38 min to the toll gate</div>{items}'
          f'<div class="addbox" style="height:42px;margin-top:8px">{icon("plus", 16)} Add to Day 3</div>'
          + "".join(f'<div class="collapsed" style="grid-template-columns:40px 1fr auto;padding:9px 0"><span class="n" style="font-size:26px">{d[0]}</span><div><b style="font-size:14px">{esc(d[2])}</b><small>{d[1]} · {d[3]}</small></div><span>{icon("chev", 16)}</span></div>' for d in D.DAYS[3:5])
          + '</div>'
          f'<div class="sheet" style="height:118px"><div class="grab"></div><div style="display:flex;justify-content:space-between;align-items:center">'
          f'<b>Map · Day 3</b><span class="chip">{icon("map", 13)} Pull up</span></div>'
          f'<p class="small muted" style="margin-top:6px">2 stops · 29 km · toll slot 11:00 (to book)</p></div>{nav}</div>')
    mp = C.trip_map(MAP, pane=(390, 520), pin_px=10, pad=.14, box=(11.30, 46.40, 12.40, 46.80))
    f2 = (f'<div class="phone">{phone_status()}{top}<div style="padding:0 16px 10px"><div class="seg"><button aria-selected="true">All 14 days</button><button>Day 3</button><button>Bases</button></div></div>'
          f'<div class="pmap" style="top:156px">{mp}</div>'
          f'<div class="sheet"><div class="grab"></div><b>4 bases · 14 days · 18 h 40 driving</b>'
          f'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;font-size:12px">'
          + "".join(f'<div style="border-top:2px solid var(--ink);padding-top:6px"><b style="display:block;font-size:13px">{b["name"]}</b><span class="muted">{b["nights"]}</span></div>' for b in D.BASES[:4])
          + f'</div></div>{nav}</div>')
    body = (f'<div class="canvas"><div class="phonewrap">{f1}<div class="phonecap"><b>Plan, one day</b>Trip identity in the top bar on every trip screen; the swap button switches trip and keeps the tab. Drag by the grip.</div></div>'
            f'<div class="phonewrap">{f2}<div class="phonecap"><b>Map, all days</b>Opens on all 14 days; tap a day to fade the rest. Bases are named, routes follow the roads.</div></div></div>' + cr.html())
    return C.page("Atlas · Plan on a phone", CSS, body)


def today_phone() -> str:
    cr = C.Credits()
    e = D.TRIP["elora"]
    nav = ('<nav class="bnav">' + "".join(f'<a href="#"{" aria-current=page" if n == "Today" else ""}>{icon(i, 22)}{n}</a>' for n, i in
           [("Plan", "map"), ("Today", "sun"), ("Bookings", "ticket"), ("Tasks", "check"), ("Budget", "wallet")]) + "</nav>")

    def top(tid, sub):
        t = D.TRIP[tid]
        return (f'<div class="ptop" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" alt=""><div><b>{esc(t["title"])}</b><small>{sub}</small></div>'
                f'<div class="sp"></div><button class="btn icon" aria-label="Switch trip">{icon("swap", 18)}</button></div>')
    tl = ""
    for i, (time, what, kind, det, st) in enumerate(D.ELORA_DAY[:5]):
        tl += f'<div class="titem{" now" if i == 0 else ""}"><span class="t">{time}</span><span class="c"></span><div><b>{esc(what)}</b><small>{esc(det)}</small></div></div>'
    f1 = (f'<div class="phone"><div class="status"><span>07:28</span><span>●●● LTE</span></div>{top("elora", "Today · Sat 24 Oct · day trip")}'
          f'<div class="tbanner" style="--tc2:{C.swatch("dolomites")}"><img src="{cr.url("misurina", 330)}" alt=""><span>Opened <b>Elora</b>: you are travelling today. You were in Dolomites.</span>'
          f'<button class="btn">Dolomites {icon("chevr", 13)}</button></div>'
          f'<div class="leave"><small>Leave home by</small><div class="big">08:10<em>in 42 min</em></div>'
          f'<p>2 h 05 to the Elora Gorge, then 15 min to check in for the 10:30 tubing slot.</p>'
          f'<div class="acts"><button class="btn primary">{icon("nav", 17)} Navigate</button><button class="btn">{icon("ticket", 17)} Slot HB-5521</button></div></div>'
          f'<div class="late"><span class="label">Running late?</span><div class="opts"><span>+15</span><span>+30</span><span>+45</span><span>+60</span></div></div>'
          f'<div class="tlist"><span class="label">The day</span>{tl}</div>{nav}</div>')
    f2 = (f'<div class="phone"><div class="status"><span>08:24</span><span>●●● LTE</span></div>{top("elora", "Today · Sat 24 Oct · day trip")}'
          f'<div class="thead-ph" {tc("elora")}><img src="{cr.url("elora", 960)}" alt=""><div class="band"></div><div class="in"><small>Next · 10:30</small><h2>Tubing slot, Grand River</h2></div></div>'
          f'<div class="late" style="border-color:var(--ink)"><div style="display:flex;justify-content:space-between"><span class="label">Running late</span><span class="small muted">left 08:24</span></div>'
          f'<div class="opts"><span>+15</span><span class="on">+30</span><span>+45</span><span>+60</span></div>'
          f'<div class="conseq"><div class="crit">{icon("alert", 15)}<span><b>Arrive 10:45.</b> Check-in for the 10:30 slot closes 10:15.</span></div>'
          f'<div>{icon("phone", 15)}<span>The operator can move a slot once by phone; the number is in the booking.</span></div>'
          f'<div class="ok">{icon("check", 15)}<span>Lunch, the gorge trail and the drive home still fit; home by 19:10.</span></div></div>'
          f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button class="btn primary" style="justify-content:center">Shift the day</button><button class="btn" style="justify-content:center">Only this stop</button></div></div>'
          f'<div class="tlist"><span class="label">After the change</span>'
          + "".join(f'<div class="titem"><span class="t">{t}</span><span class="c"></span><div><b>{w}</b></div></div>' for t, w in
                    [("11:00", "Tubing, later slot if moved"), ("13:15", "Lunch in Elora village"), ("14:30", "Gorge trail to the Tooth of Time")])
          + f'</div>{nav}</div>')
    d = D.TRIP["dolomites"]
    f3 = (f'<div class="phone"><div class="status"><span>10:58</span><span>No service</span></div>{top("dolomites", "Today · Thu 15 Jul · Day 3 of 14")}'
          f'<div class="offline">{icon("offline", 18)}<span><b>Offline.</b> Day 3 saved at 07:12: map, tickets, parking, huts. Changes sync later.</span></div>'
          f'<div class="thead-ph" {tc("dolomites")}><img src="{cr.url("locatelli", 960)}" alt=""><div class="band"></div><div class="in"><small>Now · 11:00 slot</small><h2>Tre Cime loop</h2></div></div>'
          f'<div class="leave"><small>Toll gate entry by</small><div class="big">11:30<em>32 min</em></div>'
          f'<p>Slot code <b>TC-0715-1100</b> works offline at the gate. Walk clockwise; off the loop by 14:00 if storms build.</p>'
          f'<div class="acts"><button class="btn primary">{icon("ticket", 17)} Show the slot</button><button class="btn">{icon("map", 17)} Offline map</button></div></div>'
          f'<div class="tlist"><span class="label">Then</span>'
          + "".join(f'<div class="titem"><span class="t">{t}</span><span class="c"></span><div><b>{w}</b><small>{s}</small></div></div>' for t, w, s in
                    [("13:00", "Rifugio Locatelli", "Lunch; cash"), ("16:30", "Cadini di Misurina", "Exposed spur; stop at the drop-off")])
          + f'</div>{nav}</div>')
    body = (f'<div class="canvas">'
            f'<div class="phonewrap">{f1}<div class="phonecap"><b>S5: Today opens Elora</b>Dolomites was last selected; on a travel day Today opens the trip in progress and says so. Back to Dolomites is one tap.</div></div>'
            f'<div class="phonewrap">{f2}<div class="phonecap"><b>Running late, with consequences</b>Each choice shows what it breaks before you commit, and offers the fix.</div></div>'
            f'<div class="phonewrap">{f3}<div class="phonecap"><b>Offline at the trailhead</b>July 2027, no signal at Auronzo. The whole day is on the phone and says when it was saved.</div></div>'
            f'</div>' + cr.html())
    return C.page("Atlas · Today on a phone", CSS, body)


def bookings_switch() -> str:
    cr = C.Credits()

    def rows(bks):
        out, last = "", None
        for b in sorted(bks, key=lambda b: int(b["day"].split()[1])):
            if b["day"] != last:
                out += f'<div class="bkday">{b["day"]}</div>'
                last = b["day"]
            st = {"booked": '<span class="chip ok">' + icon("check", 13) + ' Booked</span>', "held": '<span class="chip">Held</span>',
                  "to_book": '<span class="chip warn">To book</span>'}[b["status"]]
            win = f'<small style="{"color:var(--crit);font-weight:600" if "31 Oct" in b.get("window", "") else ""}">{esc(b.get("window", ""))}</small>' if b.get("window") else (f'<small>{b["code"]}</small>' if b["code"] else "")
            out += (f'<div class="bkrow"><div class="k">{icon(C.KIND_ICON[b["kind"]], 20)}</div><div><b>{esc(b["title"])}</b><small>{esc(b["when"])}</small></div>'
                    f'<div class="r">{st}{win}</div><div class="r"><b style="font-size:14px">{esc(b["money"])}</b></div></div>')
        return out

    def side(tid):
        return (f'<aside><div class="year" style="padding:18px"><span class="label">Forward a confirmation</span><p class="small" style="margin:8px 0 10px">Send airline, hotel or ticket emails to your address. '
                f'We suggest the trip from the dates and ask you to confirm.</p><div class="field"><div class="in" style="font-size:13.5px">trips+nitin@in.waymark.example</div></div></div></aside>')
    dolo = (f'<div class="bk"><div><div style="display:flex;align-items:center;gap:12px"><h2 class="serif" style="font-size:40px">Bookings</h2><span class="muted">3 booked · 1 held · 5 to book</span>'
            f'<span style="flex:1"></span><button class="btn primary">{icon("plus", 16)} Add a booking</button></div>{rows(D.DOLO_BOOKINGS[:6])}</div>{side("dolomites")}</div>')
    sw_rows = ""
    for tid, note, cls, state in [("elora", "Sat 24 Oct · tubing slot opens Mon 19 Oct", "crit", ""), ("patagonia", "26 Feb · flight and lodging by Sat 31 Oct", "crit", "hover"),
                                   ("dolomites", "13 Jul · Ortisei stay by Mon 15 Mar", "", "cur"), ("costa-rica", "13 Feb · pick the second base", "", "")]:
        t = D.TRIP[tid]
        right = (f'<span class="go">Bookings {icon("chevr", 13)}</span>' if state == "hover" else
                 f'<span class="cur">{icon("check", 14)} Here</span>' if state == "cur" else "")
        sw_rows += (f'<div class="swrow {state if state == "hover" else ""}" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" alt="">'
                    f'<div><b>{esc(t["title"])}</b><small class="{cls}">{esc(note)}</small></div>{right}</div>')
    plan_rows = "".join(f'<div class="swrow" {tc(x)}><img src="{cr.url(D.TRIP[x]["photo"], 330)}" alt=""><div><b>{esc(D.TRIP[x]["title"])}</b><small>{esc(D.TRIP[x]["dates"])}</small></div></div>' for x in ("iceland",))
    switcher = (f'<div class="pop sw"><h5>In progress · soonest first</h5>{sw_rows}<h5>Planning</h5>{plan_rows}'
                f'<div class="swrow"><span style="width:44px;text-align:center" class="muted">+2</span><div><small>Chamonix, Canadian Rockies</small></div></div>'
                f'<div class="swfoot"><span>{icon("check", 13)} Switching keeps the tab you are on</span><a href="#" style="font-weight:600;color:var(--ink)">Done trips (3)</a></div></div>')
    frame1 = (f'<div class="frame-cap"><b>1 · In Dolomites Bookings, open the switcher</b><span>One click on the trip in the top bar. In-progress trips first, each with its next deadline.</span></div>'
              f'<div class="frame dim-under">{topbar(cr, current="dolomites")}{trip_header(cr, "dolomites", "Bookings", height=170)}{dolo}{switcher}</div>')
    pat = (f'<div class="bk" style="grid-template-columns:1fr"><div style="padding-right:470px"><div style="display:flex;align-items:center;gap:12px"><h2 class="serif" style="font-size:40px">Bookings</h2>'
           f'<span class="muted">0 booked · 1 held · 7 to book</span></div>{rows(D.PATA_BOOKINGS[:6])}</div></div>')
    drawer = (f'<div class="drawer" {tc("patagonia")} style="top:64px;--tc:{C.swatch("patagonia")}"><div class="dh"><img src="{cr.url("fitzroy", 960)}" alt=""><div class="band"></div><div class="in">'
              f'<small>New booking in Patagonia</small><h3>Toronto → Buenos Aires</h3></div></div><div class="body">'
              f'<div class="field"><label>Kind</label><div class="kinds"><span class="on">{icon("plane", 14)} Flight</span><span>{icon("bed", 14)} Stay</span><span>{icon("car", 14)} Car</span><span>{icon("ticket", 14)} Activity</span><span>More</span></div></div>'
              f'<div class="two"><div class="field"><label>Airline and route</label><div class="in focus">Air Canada · YYZ → EZE</div></div><div class="field"><label>Confirmation</label><div class="in muted">optional</div></div></div>'
              f'<div class="two"><div class="field"><label>Departs (Toronto time)</label><div class="in">Fri 26 Feb 2027 23:50</div></div><div class="field"><label>Arrives (Buenos Aires)</label><div class="in">Sat 27 Feb 11:05</div></div></div>'
              f'<div class="field"><label>Travellers</label><div class="in">Nitin, Partner, Aarav</div></div>'
              f'<div class="field"><label>Files it under</label><div class="in"><img src="{cr.url("fitzroy", 330)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--tc)" alt=""><b>Patagonia</b>'
              f'<span class="muted">· Day 1 · matches the dates</span><a href="#" style="margin-left:auto;font-size:13px;font-weight:600;text-decoration:underline">Change</a></div></div>'
              f'</div><div class="foot"><button class="btn primary">Save to Patagonia</button><button class="btn">Cancel</button><span class="small muted" style="margin-left:auto">Ctrl Z undoes</span></div></div>')
    toast = (f'<div class="toast"><img src="{cr.url("misurina", 330)}" alt="">Dolomites stays on Bookings, scrolled to Day 9 · <a href="#">Back</a></div>')
    frame2 = (f'<div class="frame-cap"><b>2 · Patagonia Bookings, adding the flight</b><span>Landed on the same tab. The form header and the save button name the trip.</span></div>'
              f'<div class="frame">{topbar(cr, current="patagonia")}{trip_header(cr, "patagonia", "Bookings", height=170)}{pat}{drawer}{toast}</div>')
    dolo2 = (f'<div class="bk" style="grid-template-columns:1fr"><div style="padding-right:470px"><div style="display:flex;align-items:center;gap:12px"><h2 class="serif" style="font-size:40px">Bookings</h2>'
             f'<span class="muted">3 booked · 1 held · 5 to book</span></div>{rows([D.DOLO_BOOKINGS[i] for i in (5, 6, 7)])}</div></div>')
    drawer2 = (f'<div class="drawer" style="top:64px;--tc:{C.swatch("dolomites")}"><div class="dh"><img src="{cr.url("seceda", 960)}" {D.focus("seceda")} alt=""><div class="band"></div><div class="in">'
               f'<small>Booking in Dolomites · Day 9</small><h3>Ortisei, 4 nights</h3></div></div><div class="body">'
               f'<div class="field"><label>Kind</label><div class="kinds"><span>{icon("plane", 14)} Flight</span><span class="on">{icon("bed", 14)} Stay</span><span>{icon("car", 14)} Car</span><span>{icon("ticket", 14)} Activity</span></div></div>'
               f'<div class="field"><label>Property</label><div class="in focus">Guesthouse in Ortisei (Guest Pass)</div></div>'
               f'<div class="two"><div class="field"><label>Check in</label><div class="in">Wed 21 Jul 15:00</div></div><div class="field"><label>Check out</label><div class="in">Sun 25 Jul 10:00</div></div></div>'
               f'<div class="two"><div class="field"><label>Total</label><div class="in">€1,560</div></div><div class="field"><label>Free cancellation until</label><div class="in">Mon 5 Jul</div></div></div>'
               f'<div class="field"><label>Files it under</label><div class="in"><img src="{cr.url("misurina", 330)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--tc)" alt=""><b>Dolomites</b>'
               f'<span class="muted">· Nights 9-12</span><a href="#" style="margin-left:auto;font-size:13px;font-weight:600;text-decoration:underline">Change</a></div></div>'
               f'</div><div class="foot"><button class="btn primary">Save to Dolomites</button><button class="btn">Cancel</button></div></div>')
    frame3 = (f'<div class="frame-cap"><b>3 · Back to Dolomites, Ortisei open</b><span>The second switch is the toast\'s Back, or the switcher again. It returns to Bookings where you left it, and nothing landed in Patagonia.</span></div>'
              f'<div class="frame" style="height:760px">{topbar(cr, current="dolomites")}{trip_header(cr, "dolomites", "Bookings", height=150)}{dolo2}{drawer2}</div>')
    body = (f'<div style="padding:8px 0 40px;background:var(--paper)"><div class="frame-cap" style="margin-top:20px"><span class="label">Scenario S2 · book the Patagonia flight, then the Dolomites Ortisei hotel, in one sitting</span></div>'
            f'{frame1}{frame2}{frame3}</div>' + cr.html())
    return C.page("Atlas · Switching trips in Bookings", CSS, body)


def public() -> str:
    cr = C.Credits()
    cover = (f'<section class="cover"><img src="{cr.url("seceda", 1920)}" alt="{esc(D.PHOTOS["seceda"][3])}"><div class="in"><div class="wrap">'
             f'<div class="kick">A family plan · South Tyrol and Veneto, Italy</div><h1>The Dolomites<br><em>in thirteen nights</em></h1>'
             f'<p>Three valley bases, early starts at the famous lakes, a Sass Pordoi day and sunset in Val di Funes. A rental car throughout.</p>'
             f'<div class="acts"><button class="btn primary">{icon("copy", 16)} Copy to my trips</button><button class="btn">{icon("share", 16)} Share</button>'
             f'<span class="by">By Nitin · copied 41 times · checked Aug 2026</span></div></div></div></section>')
    facts = ('<div class="facts">' + "".join(f'<div><small>{k}</small><b>{v}</b></div>' for k, v in
             [("Length", "14 days"), ("Bases", "4 valleys"), ("Driving", "1 h 10 a day"), ("Walking", "6–15 km"), ("Effort", "Moderate"), ("Youngest", "8 and up")]) + "</div>")
    s = D.SEASON
    months = "".join(f'<div class="{"on" if m in s["months"] else "sh" if m in s["shoulder"] else ""}"><i></i>{"JFMAMJJASOND"[m - 1]}</div>' for m in range(1, 13))
    wx = "".join(f'<div><span class="label">{a}</span><b>{b}</b><span>{c}</span></div>' for a, b, c in s["weather"])
    notes = "".join(f'<li>{icon("alert", 16)}{esc(n)}</li>' for n in s["notes"])
    season = (f'<section class="season wrap"><div><span class="label">This plan is valid for</span><h2>{s["label"]}</h2><p class="why">{s["why"]}</p>'
              f'<div class="months">{months}</div><p class="small muted" style="margin-top:8px">Solid: the plan as written. Hatched: possible, with lifts and huts to check.</p></div>'
              f'<div><div class="wx">{wx}</div><ul>{notes}</ul></div></section>')
    pdays = ""
    for n, title, base, drive, stops, ph in D.PUBLIC_DAYS[:6]:
        pdays += (f'<article class="pday"><div class="ph">{f"<img src={chr(34)}{cr.url(ph, 960)}{chr(34)} alt={chr(34)}{chr(34)}>" if ph else ""}</div>'
                  f'<div class="n"><span>Day {n} · {esc(base)}</span><span>{icon("drive", 13)} {drive}</span></div><h3>{esc(title)}</h3>'
                  f'<ul>{"".join(f"<li>{esc(x)}</li>" for x in stops)}</ul></article>')
    more = "".join(f'<div><span class="n">{n}</span><b>{esc(title)}</b><span>{esc(base)}</span><span>{drive}</span></div>' for n, title, base, drive, *_ in D.PUBLIC_DAYS[6:])
    days = (f'<section class="sec wrap"><div class="sechead"><h2 style="font-size:46px">Day by day</h2><p>Days, not dates: pick a start date when you copy it</p></div>'
            f'<div class="pdays">{pdays}</div><div class="morelist">{more}</div></section>')
    suits = (f'<section class="sec wrap"><div class="sechead"><h2>Who it suits</h2></div><div class="suits">'
             + "".join(f'<div><span class="label">{a}</span><b>{b}</b><span class="small muted">{c}</span></div>' for a, b, c in
                       [("Written for", "2 adults and a child of 10", "Split days give the adults a big hike"), ("Youngest", "8 and up", "Two days have 12+ options with an easy track"),
                        ("Needs", "A car and early starts", "Braies at 05:10, Sorapis at 05:45"), ("Bookings", "6 to make", "Parking, a toll road, lift slots, 3 stays")])
             + "</div></section>")
    rmap = C.trip_map(MAP, pane=(1312, 520), pin_px=10, pad=.06,
                      edges=[("↓ Venice, 2 h 30", 12.33, 46.40, -20, 0), ("↓ Venice, 2 h 40", 11.36, 46.40, 8, 0)])
    route = (f'<section class="sec wrap"><div class="sechead"><h2 style="font-size:46px">The route</h2><p>Four bases, every day drawn; roads, not straight lines</p></div>'
             f'<div class="minimap" style="height:520px">{rmap}</div></section>')
    sticky = (f'<div class="sticky-copy"><div style="flex:1"><b>Copy to my trips</b><small>You get your own editable copy. Nothing changes for Nitin.</small></div>'
              f'<button class="btn primary">{icon("copy", 16)} Copy</button></div>')
    body = topbar(cr, current=None, active="Discover") + cover + '<div class="wrap">' + facts + "</div>" + season + route + days + suits + cr.html()
    return C.page("Atlas · Public trip", CSS, body)


def trail() -> str:
    cr = C.Credits()
    T = D.TRAIL
    hero = (f'<section class="thero"><img src="{cr.url("locatelli", 1920)}" alt="{esc(D.PHOTOS["locatelli"][3])}"><div class="in"><div class="wrap">'
            f'<div class="label" style="color:#fff;opacity:.9">Trail · {esc(T["area"])}</div><h1>{esc(T["name"])}</h1><p>{esc(T["summary"])}</p>'
            f'<div class="acts"><button class="btn primary">{icon("plus", 16)} Add to Dolomites</button><button class="btn">{icon("share", 16)} Share</button>'
            f'<button class="btn">{icon("download", 16)} GPX</button></div></div></div></section>')
    facts = ('<div class="wrap"><div class="facts">' + "".join(
        f'<div><small>{k}</small><b>{v}{f" <span style=font-size:20px>{u}</span>" if u else ""}</b><span class="src c-{conf}"><i></i>{esc(src)}</span></div>'
        for k, v, u, src, conf in T["facts"]) + "</div></div>")
    th = T["trailhead"]
    kv_th = "".join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in [("Trailhead", f'<b>{th["name"]}</b>, {th["elev"]}'), ("Coordinates", f'{th["lat"]}, {th["lon"]}'),
                                                            ("Parking", th["parking"]), ("Fee", th["fee"]), ("Fills", th["fills"]), ("By bus", th["shuttle"])])
    when = "".join(f'<dt>{k}</dt><dd>{esc(v)}<br><span class="src c-plan"><i></i>{esc(s)}</span></dd>' for k, v, s in T["when"])
    who = "".join(f'<dt>{k}</dt><dd>{esc(v)}</dd>' for k, v, s in T["who"])
    huts = "".join(f'<div><b>{esc(n)}</b><span class="muted">{km} · {el}</span></div>' for n, km, el in T["huts"])
    left = (f'<div><div class="tsec"><h2>The route</h2>{C.elevation_svg(760, 170)}<div class="huts">{huts}</div>'
            f'<div class="gallery"><img src="{cr.url("trecime-specie", 960)}" alt=""><img src="{cr.url("auronzo-hut", 330)}" alt=""><img src="{cr.url("locatelli2", 330)}" alt=""></div></div>'
            f'<div class="tsec"><h2>Trailhead and parking</h2><div class="th"><img src="{cr.url("auronzo-park", 960)}" alt="{esc(D.PHOTOS["auronzo-park"][3])}"><dl class="kv">{kv_th}</dl></div>'
            f'<div class="window">{icon("clock", 20)}<span><b>Booking window:</b> toll slots open {esc(th["opens"])}. €40 per car, no same-day sales.</span>'
            f'<button class="btn sm" style="margin-left:auto">Remind me</button></div></div>'
            f'<div class="tsec"><h2>When to go</h2><dl class="kv">{when}</dl></div>'
            f'<div class="tsec" style="border:0"><h2>Who it suits</h2><dl class="kv">{who}</dl>'
            f'<div style="margin-top:16px;display:flex;gap:8px">' + "".join(f'<span class="chip ok">{icon("check", 13)} {n} fits</span>' for _, n in D.TRAVELLERS) + '</div></div></div>')
    groups = {}
    for kind, label, dom, note, checked in T["links"]:
        groups.setdefault(kind, []).append((label, dom, note, checked))
    links = "".join(f'<h3>{k} · {len(v)}</h3>' + "".join(f'<a class="lnk" href="#"><b>{esc(l)}</b>{icon("share", 16)}<span>{esc(dom)} · {esc(n)}</span></a>' for l, dom, n, c in v) for k, v in groups.items())
    mm = C.trip_map(MAP, pane=(400, 300), box=(12.24, 46.59, 12.32, 46.63), pin_px=10, label_bases=False, only_days=[3], selected=3)
    right = (f'<aside><div class="addtrip" {tc("dolomites")}><img src="{cr.url("misurina", 330)}" alt=""><div><b>In Dolomites · Day 3</b><small>Thu 15 Jul, 11:30 · toll slot to book</small></div>'
             f'<button class="btn sm" style="margin-left:auto">Open</button></div><div class="minimap">{mm}</div>'
             f'<div class="tsec" style="margin-top:28px"><h2 style="font-size:26px">Hazards</h2>' + "".join(f'<p style="display:flex;gap:10px;margin-bottom:10px;font-size:14.5px">{icon("alert", 18)}{esc(h)}</p>' for h in T["hazards"])
             + f'</div><div class="links"><h2 class="serif" style="font-size:26px">All {len(T["links"])} links</h2><p class="small muted">Every link checked 18 Oct 2026</p>{links}</div></aside>')
    body = topbar(cr, current="dolomites", active="Explore") + hero + facts + f'<main class="wrap"><div class="tgrid">{left}{right}</div></main>' + cr.html()
    return C.page("Atlas · Trail page", CSS, body)


PAGES = {"home": home, "plan": plan, "plan-phone": plan_phone, "today-phone": today_phone, "bookings-switch": bookings_switch,
         "public-trip": public, "trail": trail}


def build() -> None:
    for name, fn in PAGES.items():
        C.write(f"{DIR}/{name}.html", fn())


if __name__ == "__main__":
    build()
