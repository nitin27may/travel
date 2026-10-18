"""Direction B, Altimeter: a precise instrument for planning, dark first. Numbers in mono, one signal colour."""
from __future__ import annotations

import common as C
import data as D
from common import esc, icon

DIR = "altimeter"
MAP = {"dark": "../assets/map-alt-dark.webp", "light": "../assets/map-alt-light.webp"}

CSS = C.fonts_css("Archivo", "JetBrains Mono") + """
:root{--bg:#0A0C0E;--s1:#101316;--s2:#161A1E;--s3:#1D2227;--line:#20262C;--line2:#2D353C;--ink:#E4E8EB;--ink2:#B6BEC5;--muted:#8B959D;--faint:#5E6870;
--sig:#FFB547;--sig-text:#FFB547;--sig-ink:#1A1200;--sig-soft:#2A2010;--crit:#FF7480;--crit-soft:#2C1418;--ok:#5FD08F;--ok-soft:#10261A;--act:#E4E8EB;--act-ink:#0A0C0E;
--route:#E4E8EB;--halo:#0A0C0E;--img:.88;--shadow:0 0 0 1px var(--line2),0 18px 50px rgba(0,0,0,.55);
--sans:'Archivo',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;color-scheme:dark}
[data-theme=light]{--bg:#F3F4F5;--s1:#FFFFFF;--s2:#FFFFFF;--s3:#F0F2F3;--line:#E1E4E7;--line2:#CDD2D6;--ink:#0D1013;--ink2:#33393F;--muted:#59626A;--faint:#8A939A;
--sig:#FFB547;--sig-text:#8A4F00;--sig-ink:#1A1200;--sig-soft:#FFF1DA;--crit:#B3263E;--crit-soft:#FBE9EC;--ok:#1F7A47;--ok-soft:#E5F3EA;--act:#0D1013;--act-ink:#FFFFFF;
--route:#0D1013;--halo:#FFFFFF;--img:1;--shadow:0 0 0 1px var(--line2),0 18px 50px rgba(13,16,19,.18);color-scheme:light}
*{box-sizing:border-box;margin:0;padding:0}
[data-theme=dark] .tmap .img-light{display:none}:root:not([data-theme=dark]) .tmap .img-dark{display:none}
body{background:var(--bg);color:var(--ink);font:400 14px/1.45 var(--sans);font-stretch:100%;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{display:block;filter:brightness(var(--img))}
.ic{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:square;stroke-linejoin:miter;flex:none}
.mono{font-family:var(--mono);font-feature-settings:'zero' 1}
.cap{font:600 11px/1.2 var(--sans);font-stretch:118%;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.h{font-weight:700;font-stretch:118%;letter-spacing:-.005em}
.muted{color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:6px;border:1px solid var(--line2);background:var(--s2);color:var(--ink);font:600 13px var(--sans);white-space:nowrap;cursor:pointer}
.btn:hover{border-color:var(--muted)}
.btn.primary{background:var(--act);color:var(--act-ink);border-color:var(--act)}
.btn.sig{background:var(--sig);color:var(--sig-ink);border-color:var(--sig)}
.btn.icon{width:34px;padding:0;justify-content:center}
kbd{font:500 11px var(--mono);color:var(--muted);border:1px solid var(--line2);border-radius:4px;padding:1px 5px;background:var(--s1)}
.tag{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:4px;font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line2);color:var(--ink2);white-space:nowrap}
.tag.sig{border-color:var(--sig-text);color:var(--sig-text)} .tag.ok{border-color:transparent;background:var(--ok-soft);color:var(--ok)} .tag.crit{border-color:transparent;background:var(--crit-soft);color:var(--crit)}
.sq{width:10px;height:10px;border-radius:2px;display:inline-block;flex:none;background:var(--tc)}
/* shell */
.app{display:grid;grid-template-columns:244px 1fr;min-height:100vh}
.rail{background:var(--s1);border-right:1px solid var(--line)}
.rin{padding:14px 12px;display:flex;flex-direction:column;gap:14px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:8px;font:700 13px var(--sans);font-stretch:125%;letter-spacing:.14em;padding:4px 6px}
.brand i{width:16px;height:16px;border:2px solid var(--ink);transform:rotate(45deg);display:inline-block}
.tmod{background:var(--s2);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.tmod .ph{position:relative;height:84px}
.tmod .ph img{width:100%;height:100%;object-fit:cover}
.tmod .ph:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--tc)}
.tmod .in{padding:10px 12px 12px}
.tmod b{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;font-stretch:112%}
.tmod .d{font:500 12px var(--mono);color:var(--ink2);margin-top:2px}
.tmod .tm{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px}
.tmod .tm span{font:600 20px var(--mono);color:var(--ink)}
.tmod .swb{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:10px}
.gauge{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:8px}
.gauge i{height:5px;border-radius:1px;background:var(--line2);position:relative;overflow:hidden}
.gauge i b{position:absolute;inset:0 auto 0 0;background:var(--ink2)}
.gauge-l{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;font:600 9.5px var(--sans);font-stretch:112%;letter-spacing:.06em;color:var(--muted);margin-top:4px}
.nav{display:grid;gap:1px}
.nav a{display:grid;grid-template-columns:20px 1fr auto;gap:10px;align-items:center;height:34px;padding:0 8px;border-radius:6px;color:var(--ink2);font-weight:500}
.nav a span{font:500 11.5px var(--mono);color:var(--muted)}
.nav a[aria-current]{background:var(--s3);color:var(--ink);box-shadow:inset 2px 0 0 var(--sig)}
.nav .cap{padding:6px 8px 4px}
.rail .foot{margin-top:auto;display:flex;align-items:center;gap:8px;padding:8px 6px;border-top:1px solid var(--line)}
.me{width:28px;height:28px;border-radius:6px;background:var(--s3);display:grid;place-items:center;font-weight:700;font-size:12px}
.main{min-width:0}
.bar{height:52px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:10}
.crumbs{display:flex;align-items:center;gap:8px;font:700 13px var(--sans);font-stretch:118%;letter-spacing:.06em;text-transform:uppercase}
.crumbs .sq{width:12px;height:12px}
.crumbs span{color:var(--muted)}
.search{margin-left:auto;display:flex;align-items:center;gap:8px;height:34px;width:340px;padding:0 10px;border:1px solid var(--line2);border-radius:6px;background:var(--s1);color:var(--muted)}
.search kbd{margin-left:auto}
.pad{padding:20px}
.panel{background:var(--s1);border:1px solid var(--line);border-radius:8px}
.phead{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}
.phead .sp{flex:1}
/* home */
.hgrid{display:grid;grid-template-columns:1fr 380px;gap:16px}
.kpis{display:flex;gap:28px;align-items:flex-end;padding:22px 20px 18px}
.kpis h1{font:700 30px/1 var(--sans);font-stretch:118%;letter-spacing:-.01em}
.kpis .k b{display:block;font:600 24px var(--mono)} .kpis .k{min-width:110px}
.table{width:100%;border-collapse:collapse}
.table th{font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 12px;border-bottom:1px solid var(--line)}
.table td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
.table tr.g td{background:var(--s2);padding:7px 12px;font-weight:700;font-stretch:112%}
.table tr.g td img{width:22px;height:22px;border-radius:4px;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:8px;box-shadow:0 0 0 2px var(--tc)}
.table tr.g td .muted{font-weight:500;font-stretch:100%;margin-left:8px}
.table .due{font:500 12.5px var(--mono);white-space:nowrap}
.table .tminus{font:600 12.5px var(--mono);white-space:nowrap}
.table .tminus.crit{color:var(--crit)}
.table .what b{font-weight:600} .table .what small{display:block;color:var(--muted);font-size:12.5px}
.table .acts{white-space:nowrap;text-align:right}
.table .acts .btn{height:28px;padding:0 9px;font-size:12px}
.tile{display:grid;grid-template-columns:96px 1fr;border-bottom:1px solid var(--line)}
.tile:last-child{border-bottom:0}
.tile .ph{position:relative}
.tile .ph img{width:96px;height:100%;object-fit:cover}
.tile .ph:after{content:'';position:absolute;top:0;bottom:0;right:0;width:3px;background:var(--tc)}
.tile .in{padding:10px 12px}
.tile b{font-weight:700;font-stretch:112%;font-size:15px}
.tile .row{display:flex;justify-content:space-between;align-items:baseline}
.tile .t{font:600 18px var(--mono)}
.tile .m{display:flex;gap:12px;font:500 11.5px var(--mono);color:var(--muted);margin-top:6px}
.gantt{padding:12px 14px 14px}
.glane{display:grid;grid-template-columns:150px 1fr 150px;align-items:center;height:30px;gap:10px;font-size:13px}
.glane .nm{display:flex;align-items:center;gap:8px;font-weight:600;white-space:nowrap;overflow:hidden}
.glane .money{font:500 12px var(--mono);color:var(--ink2);text-align:right}
.gtrack{position:relative;height:100%;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100%/15 - 1px),var(--line) calc(100%/15 - 1px),var(--line) calc(100%/15))}
.gtrack .b{position:absolute;top:8px;height:14px;border-radius:2px;background:var(--tc)}
.gtrack .w{position:absolute;top:9px;width:11px;height:11px;transform:translateX(-5px) rotate(45deg);border:2px solid var(--ink);background:var(--bg)}
.gtrack .w.crit{border-color:var(--crit)}
.gtrack .now{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--sig);left:3%}
.gmonths{display:grid;grid-template-columns:150px 1fr 150px;gap:10px;margin-top:4px}
.gmonths div{display:grid;grid-template-columns:repeat(15,1fr);font:500 10.5px var(--mono);color:var(--muted)}
.cardsB{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.cb{background:var(--s1);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.cb .ph{position:relative;height:120px}
.cb .ph img{width:100%;height:100%;object-fit:cover}
.cb .ph:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--tc)}
.cb .ph .tag{position:absolute;left:8px;top:8px;background:rgba(10,12,14,.75);color:#E4E8EB;border-color:transparent}
.cb .in{padding:10px 12px 12px}
.cb b{font-weight:700;font-stretch:112%;font-size:15px}
.cb .d{font:500 11.5px var(--mono);color:var(--muted);margin-top:2px}
.cb .n{font-size:12.5px;color:var(--ink2);margin-top:8px;min-height:36px}
.donelist .r{display:grid;grid-template-columns:48px 1fr auto auto;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line)}
.donelist img,.donelist .noimg{width:48px;height:36px;border-radius:4px;object-fit:cover;background:var(--s3);display:grid;place-items:center;color:var(--muted)}
.donelist img{filter:grayscale(.6) brightness(var(--img))}
/* plan */
.strip{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;padding:12px 20px;border-bottom:1px solid var(--line);background:var(--s1)}
.sd{border:1px solid var(--line);border-radius:6px;padding:6px 7px 7px;background:var(--bg);position:relative}
.sd .top{display:flex;justify-content:space-between;align-items:baseline}
.sd .n{font:600 16px var(--mono)} .sd .w{font:500 10px var(--mono);color:var(--muted)}
.sd .base{height:3px;border-radius:1px;margin:6px 0;background:var(--bc)}
.sd .bars{display:flex;align-items:flex-end;gap:3px;height:30px}
.sd .bars i{width:8px;background:var(--ink2);border-radius:1px}
.sd .bars i.walk{background:var(--faint)}
.sd .v{font:500 10px var(--mono);color:var(--muted);margin-top:4px;white-space:nowrap}
.sd[aria-current]{border-color:var(--sig);box-shadow:0 0 0 1px var(--sig)}
.sd .flag{position:absolute;right:5px;top:22px;width:6px;height:6px;border-radius:50%;background:var(--crit)}
.split{display:grid;grid-template-columns:600px 1fr;height:820px}
.daycol{border-right:1px solid var(--line);overflow:hidden;padding:16px 20px}
.dh{display:flex;align-items:baseline;gap:12px;margin-bottom:4px}
.dh .n{font:600 34px/1 var(--mono);color:var(--sig-text)}
.dh h2{font:700 21px/1.15 var(--sans);font-stretch:112%}
.dsum{display:flex;white-space:nowrap;gap:16px;font:500 12px var(--mono);color:var(--muted);margin:6px 0 12px;align-items:center}
.dsum span{display:flex;gap:5px;align-items:center}
.tl{position:relative;margin-left:4px}
.ti{display:grid;grid-template-columns:18px 54px 14px 1fr 72px;gap:10px;align-items:start;padding:9px 8px;border-radius:6px;position:relative}
.ti .gr{color:var(--muted);padding-top:2px}.ti .gr .ic{stroke-width:2.8}
.ti .t{font:600 13.5px var(--mono);padding-top:1px} .ti .t small{display:block;font-size:11px;color:var(--muted);font-weight:500}
.ti .node{width:12px;height:12px;border:2px solid var(--ink);border-radius:50%;background:var(--bg);margin-top:4px}
.ti b{font-weight:600;font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ti .m{font:500 12px var(--mono);color:var(--muted);margin-top:2px}
.ti .note{color:var(--ink2);font-size:13px;margin-top:3px}
.ti img{width:72px;height:54px;border-radius:4px;object-fit:cover}
.tl:before{content:'';position:absolute;left:107px;top:18px;bottom:18px;width:2px;background:var(--line2)}
.legB{display:flex;align-items:center;gap:8px;margin-left:110px;font:500 11.5px var(--mono);color:var(--muted);height:26px}
.ti.ghost{background:var(--s2);box-shadow:var(--shadow);transform:translateX(12px);margin:6px 0 10px}
.ti.ghost .gr{color:var(--sig-text)}
.ti.from{opacity:.3}
.ins{height:0;border-top:2px solid var(--sig);margin:4px 0 4px 28px;position:relative}
.ins:before{content:'';position:absolute;left:-5px;top:-6px;width:8px;height:8px;border:2px solid var(--sig);background:var(--bg);transform:rotate(45deg)}
.ins span{position:absolute;left:24px;top:-11px;background:var(--sig);color:var(--sig-ink);font:600 11px var(--mono);padding:2px 7px;border-radius:3px}
.mapB{position:relative;overflow:hidden;background:var(--bg)}
.mapB .tmap{position:absolute;inset:0;width:100%;height:100%}
.mtools{position:absolute;left:14px;top:14px;display:flex;gap:8px;z-index:2}
.segB{display:inline-flex;border:1px solid var(--line2);border-radius:6px;overflow:hidden;background:var(--s1)}
.segB button{border:0;background:none;color:var(--muted);font:600 12px var(--sans);font-stretch:112%;letter-spacing:.04em;text-transform:uppercase;height:30px;padding:0 12px;cursor:pointer}
.segB button[aria-selected=true]{background:var(--s3);color:var(--ink);box-shadow:inset 0 -2px 0 var(--sig)}
.readout{position:absolute;right:14px;top:14px;z-index:2;background:color-mix(in srgb,var(--s1) 88%,transparent);border:1px solid var(--line2);border-radius:6px;padding:10px 12px;display:grid;grid-template-columns:auto auto;gap:4px 16px;font:500 12px var(--mono)}
.readout span{color:var(--muted)}
.scale{position:absolute;left:14px;bottom:14px;z-index:2;font:500 11px var(--mono);color:var(--muted);display:flex;align-items:center;gap:8px}
.scale i{display:block;width:80px;height:6px;border:1px solid var(--muted);border-top:0}
.tmap path{vector-effect:non-scaling-stroke}
.tmap .river{fill:none;stroke:#2A5A73;stroke-width:1.4}
[data-theme=light] .tmap .river{stroke:#86AFC6}
.tmap .border{fill:none;stroke:var(--faint);stroke-width:1;stroke-dasharray:2 4}
.tmap .route-halo{fill:none;stroke:var(--halo);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.tmap .route{fill:none;stroke:var(--route);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.tmap .route.b0{stroke:#E4E8EB}.tmap .route.b1{stroke:#B9C3CB}.tmap .route.b2{stroke:#8E9BA6}.tmap .route.b3{stroke:#6E7C88}
[data-theme=light] .tmap .route.b0{stroke:#0D1013}[data-theme=light] .tmap .route.b1{stroke:#3A434B}[data-theme=light] .tmap .route.b2{stroke:#5F6A74}[data-theme=light] .tmap .route.b3{stroke:#7D8892}
.tmap .route.sel{stroke:var(--sig);stroke-width:3}
.tmap .route.dim{opacity:.25}
.tmap .stop circle{fill:var(--bg);stroke:var(--ink)}
.tmap .stop text{fill:var(--ink);font-family:var(--mono);font-weight:600;text-anchor:middle}
.tmap .stop.sel circle{fill:var(--sig);stroke:var(--sig)} .tmap .stop.sel text{fill:var(--sig-ink)}
.tmap .stop.dim{opacity:.35}
.tmap .base rect{fill:var(--ink);stroke:var(--bg)}
.tmap .base path{fill:var(--bg)}
.tmap .base-label{fill:var(--ink);font-family:var(--sans);font-weight:700;font-stretch:112%;letter-spacing:.05em;text-transform:uppercase;paint-order:stroke;stroke:var(--halo);stroke-linejoin:round}
.tmap .edge-label{fill:var(--muted);font-family:var(--mono);paint-order:stroke;stroke:var(--halo)}
/* bookings */
.frame{width:1440px;margin:0 auto 10px;border:1px solid var(--line2);border-radius:10px;overflow:hidden;position:relative;background:var(--bg)}
.frame .app{min-height:0;height:860px}
.frame .rin{height:860px;position:relative}
.fcap{width:1440px;margin:28px auto 12px;display:flex;gap:14px;align-items:baseline}
.fcap b{font:700 18px var(--sans);font-stretch:118%} .fcap span{color:var(--muted)}
.btab{width:100%;border-collapse:collapse}
.btab th{font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
.btab td{padding:10px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:13.5px}
.btab td.mono{font:500 12.5px var(--mono);white-space:nowrap}
.btab td b{font-weight:600}
.btab .k{width:30px;height:30px;border-radius:6px;background:var(--s3);display:grid;place-items:center}
.btab tr.sel td{background:var(--s2)}
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:20}
[data-theme=light] .scrim{background:rgba(13,16,19,.25)}
.palette{position:absolute;z-index:30;left:50%;top:110px;transform:translateX(-50%);width:640px;background:var(--s2);border:1px solid var(--line2);border-radius:10px;box-shadow:var(--shadow);overflow:hidden}
.palette .q{display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;border-bottom:1px solid var(--line);font-size:16px}
.palette .q span{color:var(--muted)}
.palette .q kbd{margin-left:auto}
.palette .cap{padding:10px 16px 4px}
.prow{display:grid;grid-template-columns:40px 1fr 230px 100px;gap:12px;align-items:center;padding:8px 16px}
.prow img{width:40px;height:30px;border-radius:4px;object-fit:cover;box-shadow:0 0 0 2px var(--tc)}
.prow b{font-weight:700;font-stretch:112%} .prow small{display:block;font:500 11.5px var(--mono);color:var(--muted)}
.prow .nx{font-size:12.5px;color:var(--ink2)} .prow .nx.crit{color:var(--crit)}
.prow .go{text-align:right;font:500 11px var(--mono);color:var(--muted)}
.prow.on{background:var(--s3);box-shadow:inset 2px 0 0 var(--sig)}
.prow.on .go{color:var(--ink)}
.palette .ft{display:flex;gap:16px;padding:10px 16px;border-top:1px solid var(--line);font:500 11.5px var(--mono);color:var(--muted)}
.drawerB{position:absolute;right:0;top:52px;bottom:0;width:440px;background:var(--s1);border-left:1px solid var(--line2);z-index:15;display:flex;flex-direction:column}
.drawerB .hd{padding:14px 18px;border-bottom:1px solid var(--line);position:relative}
.drawerB .hd:before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--tc)}
.drawerB .hd .who{display:flex;align-items:center;gap:10px;margin-top:4px}
.drawerB .hd img{width:44px;height:32px;border-radius:4px;object-fit:cover}
.drawerB .hd b{font:700 18px var(--sans);font-stretch:112%}
.drawerB .bd{padding:14px 18px;display:grid;gap:12px}
.fl label{display:block;font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.fl .in{height:38px;border:1px solid var(--line2);border-radius:6px;background:var(--bg);display:flex;align-items:center;gap:8px;padding:0 10px;font-size:14px}
.fl .in.mono{font:500 13px var(--mono)}
.fl .in.focus{border-color:var(--sig);box-shadow:0 0 0 2px color-mix(in srgb,var(--sig) 30%,transparent)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kindsB{display:flex;gap:4px}
.kindsB span{height:32px;padding:0 10px;border:1px solid var(--line2);border-radius:6px;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600}
.kindsB span.on{border-color:var(--sig-text);color:var(--sig-text);background:var(--sig-soft)}
.drawerB .ftr{margin-top:auto;padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}
.toastB{position:absolute;left:264px;bottom:16px;z-index:40;background:var(--s3);border:1px solid var(--line2);border-radius:8px;padding:8px 12px;display:flex;gap:10px;align-items:center;font-size:13px}
.toastB .sq{width:12px;height:12px}
/* public */
.hero{position:relative;height:560px;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,12,14,.85),rgba(10,12,14,.25) 60%,rgba(10,12,14,0))}
.hero .in{position:absolute;left:40px;top:56px;bottom:40px;z-index:2;width:560px;display:flex;flex-direction:column;color:#E4E8EB}
.hero h1{font:800 64px/.95 var(--sans);font-stretch:125%;letter-spacing:-.01em;text-transform:uppercase;margin-top:12px}
.hero p{font-size:16px;color:#C9D0D5;margin-top:14px;max-width:480px}
.spec{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.15);border-radius:8px;overflow:hidden}
.spec div{background:rgba(10,12,14,.72);padding:10px 12px}
.spec b{display:block;font:600 18px var(--mono);color:#fff}
.spec span{font:600 10px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:#9AA4AC}
.hero .acts{display:flex;gap:8px;margin-top:16px}
.hero .btn{background:rgba(22,26,30,.8);color:#E4E8EB;border-color:rgba(255,255,255,.25)}
.hero .btn.sig{background:var(--sig);color:var(--sig-ink);border-color:var(--sig)}
.wrapB{max-width:1360px;margin:0 auto;padding:24px 40px}
.seasonB{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.mchart{padding:14px}
.mchart .row{display:grid;grid-template-columns:90px repeat(12,1fr);gap:4px;align-items:end;margin-bottom:6px}
.mchart .row .l{font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);align-self:center}
.mchart .bar{background:var(--line2);border-radius:2px 2px 0 0}
.mchart .bar.on{background:var(--ink2)}
.mchart .valid{display:grid;grid-template-columns:90px repeat(12,1fr);gap:4px;margin-bottom:8px}
.mchart .valid i{height:22px;border-radius:3px;background:var(--s3)}
.mchart .valid i.on{background:var(--sig)} .mchart .valid i.sh{background:repeating-linear-gradient(135deg,var(--sig) 0 3px,transparent 3px 7px);opacity:.55}
.mchart .ml{display:grid;grid-template-columns:90px repeat(12,1fr);gap:4px;font:500 10.5px var(--mono);color:var(--muted);text-align:center}
.wxB{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}
.wxB div{padding:14px;border-right:1px solid var(--line)} .wxB div:last-child{border:0}
.wxB b{display:block;font:600 17px var(--mono);margin-top:4px} .wxB span{font-size:12.5px;color:var(--muted)}
.dayt td{vertical-align:middle}
.dayt img{width:84px;height:52px;border-radius:4px;object-fit:cover}
.dayt .n{font:600 18px var(--mono);color:var(--sig-text)}
/* trail */
.thB{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)}
.thB .ph{position:relative;height:440px}
.thB .ph img{width:100%;height:100%;object-fit:cover}
.thB .in{padding:28px 32px;display:flex;flex-direction:column}
.thB h1{font:800 46px/1 var(--sans);font-stretch:118%;text-transform:uppercase;letter-spacing:-.005em;margin-top:10px}
.thB p{color:var(--ink2);font-size:15px;margin-top:12px;max-width:560px}
.readouts{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:auto}
.readouts div{background:var(--s1);padding:10px 12px}
.readouts b{display:block;font:600 22px var(--mono)} .readouts b small{font-size:13px;color:var(--muted)}
.conf{display:inline-flex;align-items:center;gap:4px;font:600 9.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.conf i{width:6px;height:6px;border-radius:1px;background:var(--ok)} .conf.c-community i{background:var(--sig)} .conf.c-plan i{background:var(--faint)}
.tgB{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:16px;padding:16px 20px}
.elev{width:100%;height:auto;overflow:visible}
.elev .a{fill:color-mix(in srgb,var(--sig) 14%,transparent)} .elev .l{fill:none;stroke:var(--sig);stroke-width:2}
.elev .g{stroke:var(--line);stroke-width:1} .elev .gl,.elev .xl{fill:var(--muted);font:500 11px var(--mono)}
.elev .mk circle{fill:var(--bg);stroke:var(--ink);stroke-width:2}
.kvB{display:grid;grid-template-columns:140px 1fr;gap:0}
.kvB dt,.kvB dd{padding:8px 14px;border-bottom:1px solid var(--line);font-size:13.5px}
.kvB dt{color:var(--muted)} .kvB dd.mono{font:500 13px var(--mono)}
.ltab td{font-size:13px}
.ltab td.k{font:600 10.5px var(--sans);font-stretch:112%;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.ltab td.dom{font:500 12px var(--mono);color:var(--muted)}
.credits{padding:24px 20px 40px;color:var(--muted);font-size:12px;border-top:1px solid var(--line)}
.credits h2{font:600 11px var(--sans);font-stretch:112%;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
.credits ol{columns:2;column-gap:40px;margin:10px 0 0 18px}
.credits a{text-decoration:underline}
/* phones */
.canvas{display:flex;gap:48px;justify-content:center;padding:40px;background:#050607;align-items:flex-start}
[data-theme=light] .canvas{background:#E4E7EA}
.pw{display:flex;flex-direction:column;gap:12px;align-items:center}
.pcap{width:390px;font-size:13px;color:var(--muted)} .pcap b{display:block;color:var(--ink);font:700 15px var(--sans);font-stretch:118%;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.phone{width:390px;height:844px;border-radius:44px;background:var(--bg);overflow:hidden;position:relative;box-shadow:0 0 0 9px #22272C,0 0 0 10px #3A4148}
.status{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font:600 14px var(--mono)}
.ptopB{margin:0 12px 8px;display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--s1);position:relative;overflow:hidden}
.ptopB:before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--tc)}
.ptopB img{width:48px;height:38px;border-radius:5px;object-fit:cover}
.ptopB b{display:block;font:700 16px var(--sans);font-stretch:112%} .ptopB small{display:block;font:500 11.5px var(--mono);color:var(--muted)}
.bnavB{position:absolute;left:0;right:0;bottom:0;height:82px;background:var(--s1);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);padding:8px 4px 24px}
.bnavB a{display:flex;flex-direction:column;align-items:center;gap:3px;font:600 10px var(--sans);font-stretch:112%;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.bnavB a[aria-current]{color:var(--ink)} .bnavB a[aria-current] .ic{color:var(--sig-text)}
.pstrip{display:flex;gap:4px;padding:0 12px 8px;overflow:hidden}
.pstrip div{flex:none;width:46px;border:1px solid var(--line);border-radius:6px;padding:5px 0;text-align:center;font:500 10px var(--mono);color:var(--muted)}
.pstrip div b{display:block;font:600 16px var(--mono);color:var(--ink)}
.pstrip div[aria-current]{border-color:var(--sig);box-shadow:0 0 0 1px var(--sig)}
.pin{padding:0 12px}
.lv{margin:4px 12px 10px;border:1px solid var(--line2);border-radius:12px;background:var(--s1);padding:14px;position:relative;overflow:hidden}
.lv .cap{display:flex;justify-content:space-between}
.lv .big{font:600 72px/1 var(--mono);letter-spacing:-.04em;margin-top:6px;color:var(--sig-text)}
.lv .cd{font:600 15px var(--mono);margin-top:2px}
.lv p{font-size:13px;color:var(--ink2);margin-top:8px}
.lv .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.lv .btn{height:46px;justify-content:center;font-size:14px}
.ring{position:absolute;right:14px;top:34px;width:74px;height:74px}
.lateB{margin:0 12px 10px;border:1px solid var(--line);border-radius:12px;background:var(--s1);padding:12px}
.lateB .opts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.lateB .opts span{height:40px;border:1px solid var(--line2);border-radius:6px;display:grid;place-items:center;font:600 14px var(--mono)}
.lateB .opts span.on{border-color:var(--sig-text);color:var(--sig-text);background:var(--sig-soft)}
.cq{display:grid;gap:6px;margin-top:10px;font-size:12.5px}
.cq div{display:flex;gap:8px;align-items:flex-start}
.cq .crit{color:var(--crit)} .cq .ok{color:var(--ok)}
.tlB{padding:0 12px}
.tlB .r{display:grid;grid-template-columns:50px 12px 1fr;gap:10px;padding:7px 0;align-items:start;font-size:13.5px}
.tlB .r .t{font:600 13px var(--mono)} .tlB .r i{width:10px;height:10px;border:2px solid var(--muted);border-radius:50%;margin-top:4px}
.tlB .r.now i{border-color:var(--sig);background:var(--sig)}
.tlB .r b{font-weight:600;display:block} .tlB .r small{font:500 11.5px var(--mono);color:var(--muted)}
.offB{margin:0 12px 10px;display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;background:var(--s2);border:1px solid var(--line2);font:500 12px var(--mono)}
.switchnote{margin:0 12px 10px;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px dashed var(--line2);border-radius:8px;font-size:12.5px;color:var(--ink2)}
.switchnote .btn{margin-left:auto;height:28px;font-size:12px}
.sheetB{position:absolute;left:0;right:0;bottom:82px;background:var(--s1);border-top:1px solid var(--line2);border-radius:14px 14px 0 0;padding:8px 14px 12px}
.sheetB .gb{width:36px;height:4px;border-radius:2px;background:var(--line2);margin:0 auto 8px}
"""


def tc(tid: str) -> str:
    return f'style="--tc:{C.swatch(tid)}"'


def rail(cr: C.Credits, *, trip: str | None, active: str) -> str:
    if trip:
        t = D.TRIP[trip]
        tminus = {"dolomites": "T–268 d", "patagonia": "T–131 d", "elora": "T–6 d"}.get(trip, "")
        books = {"dolomites": ("3/9", "1/12", "43%"), "patagonia": ("0/8", "2/19", "8%"), "elora": ("1/1", "3/5", "60%")}[trip]
        mod = (f'<div class="tmod" {tc(trip)}><div class="ph"><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""></div><div class="in">'
               f'<b><i class="sq"></i>{esc(t["title"])}</b><div class="d">{esc(t["dates"])}</div>'
               f'<div class="tm"><span class="cap">{t["phase"]}</span><span>{tminus}</span></div>'
               f'<div class="gauge">' + "".join(f'<i><b style="width:{v * 100:.0f}%"></b></i>' for v in t["ready"]) + '</div><div class="gauge-l"><span>PLAN</span><span>BOOK</span><span>PREP</span><span>GO</span></div>'
               f'<button class="btn swb">{icon("swap", 15)} Switch trip <kbd>⌘K</kbd></button></div></div>')
        tnav = ('<nav class="nav"><div class="cap">This trip</div>' + "".join(
            f'<a href="#"{" aria-current=page" if n == active else ""}>{icon(i, 17)}{n}<span>{c}</span></a>' for n, i, c in
            [("Plan", "map", "14 d"), ("Today", "sun", ""), ("Bookings", "ticket", books[0]), ("Tasks", "check", books[1]), ("Budget", "wallet", books[2])]) + "</nav>")
    else:
        mod = (f'<div class="tmod"><div class="in"><span class="cap">No trip open</span><button class="btn swb" style="margin-top:8px">{icon("swap", 15)} Open a trip <kbd>⌘K</kbd></button></div></div>')
        tnav = ""
    gnav = ('<nav class="nav"><div class="cap">Everywhere</div>' + "".join(
        f'<a href="#"{" aria-current=page" if n == active else ""}>{icon(i, 17)}{n}<span>{c}</span></a>' for n, i, c in
        [("Home", "home", "5"), ("Trips", "layers", "12"), ("Discover", "compass", ""), ("Explore", "search", ""), ("Templates", "copy", "")]) + "</nav>")
    return (f'<aside class="rail"><div class="rin"><div class="brand"><i></i>WAYMARK</div>{mod}{tnav}{gnav}'
            f'<div class="foot"><span class="me">N</span><span>Nitin</span><span style="flex:1"></span><button class="btn icon" data-toggle-theme aria-label="Theme">{icon("sun", 15)}</button>'
            f'<button class="btn icon" aria-label="Settings">{icon("settings", 15)}</button></div></div></aside>')


def topbar(trip: str | None, section: str) -> str:
    cr = (f'<span class="sq" {tc(trip)}></span>{esc(D.TRIP[trip]["title"])} <span>/</span> {section}' if trip else section)
    return (f'<div class="bar"><div class="crumbs">{cr}</div><div class="search">{icon("search", 15)} Search places, trails, bookings <kbd>/</kbd></div>'
            f'<button class="btn icon" aria-label="Undo">{icon("undo", 15)}</button><button class="btn icon" aria-label="Notifications">{icon("bell", 15)}</button>'
            f'<button class="btn">{icon("users", 15)} Share</button></div>')


def gantt() -> str:
    # Oct 2026 .. Dec 2027 = 15 months
    lanes = [("elora", .75, .78, [(.6, True)], "CAD 180 / 220"), ("patagonia", 4.85, 5.35, [(1.0, True), (1.47, False), (1.97, False)], "USD 0 / 14,800"),
             ("costa-rica", 4.4, 4.75, [], "USD 0 / 9,600"), ("dolomites", 9.4, 9.85, [(5.47, False), (8.0, False), (8.47, False)], "CAD 7,848 / 18,390"),
             ("iceland", 11.1, 11.5, [], "ISK — / 2.1 M")]
    rows = ""
    for tid, a, b, wins, money in lanes:
        t = D.TRIP[tid]
        ws = "".join(f'<i class="w{" crit" if c else ""}" style="left:{x / 15 * 100:.2f}%"></i>' for x, c in wins)
        rows += (f'<div class="glane" {tc(tid)}><div class="nm"><i class="sq"></i>{esc(t["title"])}</div><div class="gtrack"><i class="b" style="left:{a / 15 * 100:.2f}%;width:{max(b - a, .15) / 15 * 100:.2f}%"></i>{ws}'
                 f'{"<i class=now></i>" if tid == "elora" else ""}</div><div class="money">{money}</div></div>')
    months = "".join(f"<span>{m}</span>" for m in "O N D J F M A M J J A S O N D".split())
    return (f'<div class="panel"><div class="phead"><span class="cap">Year · Oct 2026 – Dec 2027</span><span class="sp"></span><span class="muted" style="font-size:12px">'
            f'bar = trip · ◇ = booking window · <span style="color:var(--sig)">|</span> today · spend: committed / planned, each in its currency</span></div>'
            f'<div class="gantt">{rows}<div class="gmonths"><span></span><div>{months}</div><span></span></div></div></div>')


def home() -> str:
    cr = C.Credits()
    groups = ""
    for g in ["elora", "patagonia", "dolomites", "person"]:
        rows = [n for n in D.NEEDS if n["trip"] == g]
        if g == "dolomites":
            rows = [dict(trip="dolomites", what="Book the Ortisei stay, 4 nights", detail="Guest Pass hotels; nothing else due before March", due="Mon 15 Mar", when="in 5 months", tab="Bookings", urgent=False)]
        if g == "person":
            head = (f'<tr class="g"><td colspan="6"><span class="me" style="display:inline-grid;width:22px;height:22px;margin-right:8px;vertical-align:middle">A</span>Aarav'
                    f'<span class="muted">person · linked check in</span> ' + " ".join(f'<span class="tag" style="margin-left:6px"><i class="sq" {tc(x)}></i>{D.TRIP[x]["title"]}</span>' for x in ("dolomites", "patagonia")) + "</td></tr>")
        else:
            t = D.TRIP[g]
            head = (f'<tr class="g" {tc(g)}><td colspan="6"><img src="{cr.url(t["photo"], 330)}" alt="">{esc(t["title"])}<span class="muted">{esc(t["dates"])} · {t["phase"]}</span></td></tr>')
        groups += head
        for n in rows:
            tm = {"tomorrow": "T–1 d", "in 6 days": "T–6 d", "in 13 days": "T–13 d", "in 5 months": "T–148 d", "person": "T–89 d"}[n["when"]]
            groups += (f'<tr><td class="due">{n["due"].upper()}</td><td class="tminus{" crit" if n["urgent"] else ""}">{tm}</td>'
                       f'<td class="what"><b>{esc(n["what"])}</b><small>{esc(n["detail"])}</small></td><td><span class="tag">{n["tab"]}</span></td>'
                       f'<td class="acts"><button class="btn icon" style="width:28px" aria-label="Done">{icon("check", 14)}</button> <button class="btn">Snooze</button> <button class="btn primary">Open {icon("chevr", 13)}</button></td></tr>')
    needs = (f'<div class="panel"><div class="phead"><span class="cap">Needs you · next 14 days and beyond</span><span class="sp"></span><span class="tag crit">1 tomorrow</span></div>'
             f'<table class="table"><tr><th>Due</th><th>T–</th><th>Action</th><th>Lands in</th><th></th></tr>{groups}</table></div>')
    tiles = ""
    for tid, tm, m in [("elora", "T–6 d", ["BOOK 1/1", "TASKS 3/5", "CAD 180"]), ("patagonia", "T–131 d", ["BOOK 0/8", "TASKS 2/19", "USD 0"]),
                       ("dolomites", "T–268 d", ["BOOK 3/9", "TASKS 1/12", "CAD 7,848"])]:
        t = D.TRIP[tid]
        tiles += (f'<div class="tile" {tc(tid)}><div class="ph"><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""></div><div class="in">'
                  f'<div class="row"><b>{esc(t["title"])}</b><span class="t">{tm}</span></div><div class="d mono muted" style="font-size:11.5px">{esc(t["dates"])}</div>'
                  f'<div class="gauge">' + "".join(f'<i><b style="width:{v * 100:.0f}%"></b></i>' for v in t["ready"]) + '</div>'
                  f'<div class="m">{"".join(f"<span>{x}</span>" for x in m)}</div></div></div>')
    active = f'<div class="panel"><div class="phead"><span class="cap">In progress</span><span class="sp"></span><span class="muted mono" style="font-size:12px">3</span></div>{tiles}</div>'
    cards = ""
    for tid in ("costa-rica", "iceland", "chamonix", "rockies"):
        t = D.TRIP[tid]
        cards += (f'<div class="cb" {tc(tid)}><div class="ph"><img src="{cr.url(t["photo"], 330)}" alt=""><span class="tag">{t["phase"]}</span></div><div class="in">'
                  f'<b>{esc(t["title"])}</b><div class="d">{esc(t["dates"])}</div><div class="n">{esc(t["next"])}</div>'
                  f'<div class="gauge">' + "".join(f'<i><b style="width:{v * 100:.0f}%"></b></i>' for v in t["ready"]) + '</div></div></div>')
    done = "".join(
        f'<div class="r">{f"<img src={chr(34)}{cr.url(d["photo"], 330)}{chr(34)} alt={chr(34)}{chr(34)}>" if d["photo"] else "<span class=noimg>" + icon("map", 18) + "</span>"}'
        f'<div><b>{esc(d["title"])}</b><div class="mono muted" style="font-size:11.5px">{esc(d["dates"])} · read-only</div></div><span class="muted" style="font-size:12.5px">{esc(d["note"])}</span>'
        f'<button class="btn">{icon("copy", 14)} Use as template</button></div>' for d in D.DONE)
    ideas = "".join(f'<div class="r"><span class="noimg">{icon("flag", 18)}</span><div><b>{esc(i["title"])}</b><div class="mono muted" style="font-size:11.5px">{esc(i["sub"])}</div></div><span class="muted" style="font-size:12.5px">{esc(i["note"])}</span><button class="btn">Plan it</button></div>' for i in D.IDEAS)
    main = (f'<main class="main">{topbar(None, "Home")}<div class="kpis"><div><div class="cap">Mon 18 Oct 2026 · 18:42</div><h1>3 trips in motion</h1></div><span style="flex:1"></span>'
            f'<div class="k"><span class="cap">Due ≤ 14 d</span><b style="color:var(--crit)">4</b></div><div class="k"><span class="cap">To book</span><b>15</b></div>'
            f'<div class="k"><span class="cap">Committed</span><b>CAD 8,028</b></div><button class="btn sig">{icon("plus", 15)} New trip</button></div>'
            f'<div class="pad" style="padding-top:0;display:grid;gap:16px"><div class="hgrid">{needs}{active}</div>{gantt()}'
            f'<div><div style="display:flex;gap:8px;align-items:center;margin:6px 0 10px"><span class="cap">All trips · 12</span><span style="flex:1"></span><div class="search" style="margin:0;width:260px">{icon("search", 15)} Search trips <kbd>/</kbd></div>'
            + "".join(f'<button class="btn">{n} {icon("chev", 13)}</button>' for n in ("When", "Phase", "Source"))
            + f'<button class="btn">Group: when</button><button class="btn">Sort: soonest</button><div class="segB"><button aria-selected="true">Cards</button><button>List</button><button>Table</button><button>Map</button></div></div>'
            f'<div class="cap" style="margin:6px 0 10px">Planning · soonest first</div><div class="cardsB">{cards}</div></div>'
            f'<div class="hgrid" style="grid-template-columns:1fr 1fr"><div class="panel donelist"><div class="phead"><span class="cap">Done · reuse as templates</span></div>{done}</div>'
            f'<div class="panel donelist"><div class="phead"><span class="cap">Ideas · no dates</span></div>{ideas}</div></div></div>{cr.html()}</main>')
    return C.page("Altimeter · Home", CSS, f'<div class="app">{rail(cr, trip=None, active="Home")}{main}</div>', theme="dark")


def ti(cr, it, *, ghost=False, from_=False) -> str:
    time, pid, name, kind, meta, note, ticket, photo = it
    tk = {"booked": '<span class="tag ok">booked</span>', "to_book": '<span class="tag sig">to book</span>'}.get(ticket or "", "")
    img = f'<img src="{cr.url(photo, 330)}" alt="">' if photo else f'<span style="width:72px;height:54px;border-radius:4px;background:var(--s3);display:grid;place-items:center;color:var(--muted)">{icon(C.KIND_ICON.get(kind, "pin"), 18)}</span>'
    return (f'<div class="ti{" ghost" if ghost else ""}{" from" if from_ else ""}"><span class="gr">{icon("grip", 16)}</span><span class="t">{time}</span><span class="node"></span>'
            f'<div><b>{esc(name)} {tk}</b><div class="m">{esc(meta)}</div>{f"<div class=note>{esc(note)}</div>" if note else ""}</div>{img}</div>')


def strip() -> str:
    drive_min = [178, 98, 70, 81, 70, 33, 57, 47, 101, 60, 38, 47, 88, 162]
    walk = [0, 6.7, 12, 14.6, 9.2, 12, 5, 8, 2, 8, 11.6, 3, 8, 0]
    shades = ["#E4E8EB", "#B9C3CB", "#8E9BA6", "#6E7C88", "#4A545C"]
    out = ""
    for (n, date, title, drive, _), dm, wk in zip(D.DAYS, drive_min, walk):
        bc = shades[D.DAY_BASE[n]] if n < 14 else shades[4]
        out += (f'<div class="sd"{" aria-current=true" if n == 3 else ""} style="--bc:{bc}"><div class="top"><span class="n">{n:02d}</span><span class="w">{date[:3].upper()}</span></div>'
                f'<div class="base"></div><div class="bars"><i style="height:{dm / 180 * 30:.0f}px"></i><i class="walk" style="height:{wk / 15 * 30:.0f}px"></i></div>'
                f'<div class="v">{drive.replace(" ", "")} · {wk:g}k</div>{"<i class=flag></i>" if n in D.DAY_FLAG else ""}</div>')
    return f'<div class="strip">{out}</div>'


def plan() -> str:
    cr = C.Credits()
    d3, d4 = D.DAYS[2], D.DAYS[3]
    i3 = d3[4]
    day3 = (f'<div class="dh"><span class="n">03</span><h2>{esc(d3[2])}</h2></div><div class="dsum"><span>{d3[1].upper()}</span><span>{icon("drive", 13)} 1h10 · 58 km</span>'
            f'<span>{icon("trail", 13)} 12.0 km · +600 m</span><span>{icon("home", 13)} SAN CANDIDO</span></div>'
            f'<div class="tl"><div class="legB">{icon("drive", 13)} DEP 10:15 · 38 min · 29 km → toll gate</div>'
            f'<div class="ins"><span>DROP · before 11:30 · day recalculates</span></div>{ti(cr, i3[1], ghost=True)}'
            f'{ti(cr, i3[0])}<div class="legB">{icon("trail", 13)} 6 min walk</div>{ti(cr, i3[1], from_=True)}'
            f'<div class="legB">{icon("drive", 13)} 34 min · 24 km → San Candido · arr 17:55</div></div>')
    i4 = d4[4]
    day4 = (f'<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:14px"><div class="dh"><span class="n" style="color:var(--ink)">04</span><h2>{esc(d4[2])}</h2>'
            f'<span class="tag crit" style="margin-left:auto">split day</span></div><div class="dsum"><span>{d4[1].upper()}</span><span>{icon("drive", 13)} 1h21</span><span>A: Nitin, Partner · B: Aarav, Partner</span></div>'
            f'<div class="tl">{ti(cr, i4[0])}{ti(cr, i4[1])}</div></div>')
    mp = C.trip_map(MAP, pane=(596, 820), pin_px=10, pad=.13, label_px=12,
                    edges=[("→ VENICE 2h30", 12.33, 46.42, -10, 14), ("→ VENICE 2h40", 11.36, 46.42, 6, 14)])
    mapB = (f'<div class="mapB">{mp}<div class="mtools"><div class="segB"><button aria-selected="true" data-tab>All days</button><button data-tab>Day 03</button><button data-tab>Bases</button></div>'
            f'</div>'
            f'<div class="readout"><span>DAYS</span><b>14</b><span>DRIVE</span><b>18 h 40</b><span>WALK</span><b>112 km</b><span>CLIMB</span><b>+6,950 m</b></div>'
            f'<div class="scale"><i></i>10 km · contours 100 m</div></div>')
    main = (f'<main class="main">{topbar("dolomites", "Plan")}{strip()}<div class="split"><div class="daycol">{day3}{day4}</div>{mapB}</div>{cr.html()}</main>')
    return C.page("Altimeter · Plan", CSS, f'<div class="app">{rail(cr, trip="dolomites", active="Plan")}{main}</div>', theme="dark")


def bnav(cur: str) -> str:
    return ('<nav class="bnavB">' + "".join(f'<a href="#"{" aria-current=page" if n == cur else ""}>{icon(i, 21)}{n}</a>' for n, i in
            [("Plan", "map"), ("Today", "sun"), ("Bookings", "ticket"), ("Tasks", "check"), ("Budget", "wallet")]) + "</nav>")


def ptop(cr, tid, sub) -> str:
    t = D.TRIP[tid]
    return (f'<div class="ptopB" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"])}</b><small>{sub}</small></div>'
            f'<button class="btn icon" aria-label="Switch trip">{icon("swap", 16)}</button></div>')


def plan_phone() -> str:
    cr = C.Credits()
    stripp = '<div class="pstrip">' + "".join(f'<div{" aria-current=true" if d[0] == 3 else ""}><b>{d[0]:02d}</b>{d[1][:3].upper()}</div>' for d in D.DAYS[:7]) + "</div>"
    i3 = D.DAYS[2][4]
    items = ""
    for k, it in enumerate(i3):
        time, pid, name, kind, meta, note, ticket, photo = it
        items += (f'<div class="ti" style="grid-template-columns:16px 44px 1fr 60px;padding:8px 0"><span class="gr">{icon("grip", 15)}</span><span class="t">{time}</span>'
                  f'<div><b style="font-size:14.5px">{esc(name)}</b><div class="m">{esc(meta)}</div></div><img src="{cr.url(photo, 330)}" style="width:60px;height:46px" alt=""></div>')
        if k == 0:
            items += f'<div class="legB" style="margin-left:60px">{icon("trail", 12)} 6 min walk</div>'
    f1 = (f'<div class="phone"><div class="status"><span>18:42</span><span>5G</span></div>{ptop(cr, "dolomites", "13–26 JUL 2027 · T–268 d")}{stripp}<div class="pin">'
          f'<div class="dh"><span class="n" style="font-size:28px">03</span><h2 style="font-size:18px">Tre Cime di Lavaredo</h2></div>'
          f'<div class="dsum" style="flex-wrap:wrap;gap:10px"><span>THU 15 JUL</span><span>{icon("drive", 12)} 1h10</span><span>{icon("trail", 12)} 12 km +600 m</span></div>'
          f'<div class="legB" style="margin-left:60px">{icon("drive", 12)} DEP 10:15 · 38 min</div>{items}'
          + "".join(f'<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)"><span class="mono" style="font-weight:600;color:var(--muted)">{d[0]:02d}</span><b style="font-weight:600">{esc(d[2])}</b><span class="mono muted" style="margin-left:auto;font-size:11.5px">{d[3].replace(" ", "")}</span></div>' for d in D.DAYS[3:6])
          + f'</div>{bnav("Plan")}</div>')
    mp = C.trip_map(MAP, pane=(390, 644), pin_px=9, pad=.12, label_px=11)
    f2 = (f'<div class="phone"><div class="status"><span>18:43</span><span>5G</span></div>{ptop(cr, "dolomites", "MAP · ALL 14 DAYS")}'
          f'<div style="position:absolute;left:0;right:0;top:118px;bottom:82px">{mp.replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div>'
          f'<div style="position:absolute;left:12px;top:126px;z-index:2"><div class="segB"><button aria-selected="true">All</button><button>Day 03</button><button>Bases</button></div></div>'
          f'<div class="sheetB"><div class="gb"></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:500 11.5px var(--mono)">'
          + "".join(f'<div><span class="cap">{b["name"].replace("San Candido", "S. Candido")}</span><b style="display:block;font-size:14px">{b["nights"].split()[0]} N</b></div>' for b in D.BASES[:4])
          + f'</div></div>{bnav("Plan")}</div>')
    body = (f'<div class="canvas"><div class="pw">{f1}<div class="pcap"><b>Plan · one day</b>Trip module on top of every trip screen: photo, colour, dates, countdown. Swap keeps the tab.</div></div>'
            f'<div class="pw">{f2}<div class="pcap"><b>Map · all days</b>Contour basemap, base routes in four greys, the picked day in signal amber.</div></div></div>{cr.html()}')
    return C.page("Altimeter · Plan on a phone", CSS, body, theme="dark")


def today_phone() -> str:
    cr = C.Credits()
    ring = ('<svg class="ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--line2)" stroke-width="6"/>'
            '<circle cx="40" cy="40" r="34" fill="none" stroke="var(--sig)" stroke-width="6" stroke-dasharray="214" stroke-dasharray="214" stroke-dashoffset="150" transform="rotate(-90 40 40)" stroke-linecap="butt"/>'
            '<text x="40" y="45" text-anchor="middle" font-family="JetBrains Mono" font-weight="600" font-size="15" fill="var(--ink)">42m</text></svg>')
    tl = "".join(f'<div class="r{" now" if k == 0 else ""}"><span class="t">{t}</span><i></i><div><b>{esc(w)}</b><small>{esc(d)}</small></div></div>'
                 for k, (t, w, kind, d, st) in enumerate(D.ELORA_DAY[:5]))
    f1 = (f'<div class="phone"><div class="status"><span>07:28</span><span>LTE</span></div>{ptop(cr, "elora", "TODAY · SAT 24 OCT · DAY TRIP")}'
          f'<div class="switchnote"><span class="sq" {tc("dolomites")}></span><span>Opened <b>Elora</b>, the trip in progress. Last open: Dolomites.</span><button class="btn">Dolomites</button></div>'
          f'<div class="lv"><div class="cap"><span>Leave home by</span></div><div class="big">08:10</div><div class="cd">T–00:42</div>{ring}'
          f'<p>2 h 05 · 182 km to the Elora Gorge, check in 15 min before the 10:30 tubing slot.</p>'
          f'<div class="acts"><button class="btn sig">{icon("nav", 16)} Navigate</button><button class="btn">{icon("ticket", 16)} HB-5521</button></div></div>'
          f'<div class="lateB"><span class="cap">Running late</span><div class="opts"><span>+15</span><span>+30</span><span>+45</span><span>+60</span></div></div>'
          f'<div class="tlB"><div class="cap" style="margin-bottom:4px">Sat 24 Oct</div>{tl}</div>{bnav("Today")}</div>')
    f2 = (f'<div class="phone"><div class="status"><span>08:24</span><span>LTE</span></div>{ptop(cr, "elora", "TODAY · SAT 24 OCT · DAY TRIP")}'
          f'<div class="lateB" style="border-color:var(--sig)"><div class="cap" style="display:flex;justify-content:space-between"><span>Running late · left 08:24</span><span class="mono">+14 now</span></div>'
          f'<div class="opts"><span>+15</span><span class="on">+30</span><span>+45</span><span>+60</span></div>'
          f'<div class="cq"><div class="crit">{icon("alert", 14)}<span><b>ARR 10:45</b> · check-in for the 10:30 slot closes 10:15</span></div>'
          f'<div>{icon("phone", 14)}<span>The operator can move the slot once by phone; number in booking HB-5521</span></div>'
          f'<div class="ok">{icon("check", 14)}<span>Lunch, gorge trail and the drive home still fit · home 19:10</span></div></div>'
          f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px"><button class="btn sig" style="justify-content:center;height:42px">Shift the day</button><button class="btn" style="justify-content:center;height:42px">This stop only</button></div></div>'
          f'<div class="tlB"><div class="cap" style="margin-bottom:4px">Preview after +30</div>'
          + "".join(f'<div class="r"><span class="t">{t}</span><i></i><div><b>{w}</b><small>{s}</small></div></div>' for t, w, s in
                    [("10:45", "Elora Gorge Conservation Area", "was 10:15"), ("11:00", "Tubing, if the slot moves", "was 10:30"), ("13:15", "Lunch in Elora village", "was 12:45"), ("14:30", "Gorge trail", "was 14:00"), ("17:00", "Drive home", "arr 19:10")])
          + f'</div>{bnav("Today")}</div>')
    f3 = (f'<div class="phone"><div class="status"><span>10:58</span><span>NO SVC</span></div>{ptop(cr, "dolomites", "TODAY · THU 15 JUL · DAY 03/14")}'
          f'<div class="offB">{icon("offline", 15)}<span>OFFLINE · DAY 03 SAVED 07:12 · 4.2 MB</span></div>'
          f'<div class="lv"><div class="cap"><span>Toll gate entry by</span><span class="tag sig">slot 11:00</span></div><div class="big">11:30</div><div class="cd">T–00:32</div>'
          f'<p>Slot code <b class="mono">TC-0715-1100</b> shows offline at the gate. Clockwise loop; off it by 14:00 if storms build.</p>'
          f'<div class="acts"><button class="btn sig">{icon("ticket", 16)} Show slot</button><button class="btn">{icon("map", 16)} Offline map</button></div></div>'
          f'<div style="margin:0 12px 10px;height:150px;border-radius:12px;overflow:hidden;position:relative;border:1px solid var(--line)">{C.trip_map(MAP, pane=(366, 150), box=(12.22, 46.585, 12.32, 46.635), pin_px=9, only_days=[3], selected=3, label_bases=False).replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div>'
          f'<div class="tlB">' + "".join(f'<div class="r"><span class="t">{t}</span><i></i><div><b>{w}</b><small>{s}</small></div></div>' for t, w, s in
                                         [("13:00", "Rifugio Locatelli", "lunch · cash only"), ("16:30", "Cadini di Misurina", "exposed spur")])
          + f'</div>{bnav("Today")}</div>')
    body = (f'<div class="canvas"><div class="pw">{f1}<div class="pcap"><b>S5 · Today opens Elora</b>Travel day beats last-selected. The note says so; Dolomites is one tap.</div></div>'
            f'<div class="pw">{f2}<div class="pcap"><b>Running late</b>Consequences before commit, and a preview of the shifted day.</div></div>'
            f'<div class="pw">{f3}<div class="pcap"><b>Offline at Auronzo</b>Saved time and size are always shown. Map, slot code and huts work with no signal.</div></div></div>{cr.html()}')
    return C.page("Altimeter · Today on a phone", CSS, body, theme="dark")


def btable(bks, sel: str = "") -> str:
    rows = ""
    for b in sorted(bks, key=lambda b: int(b["day"].split()[1])):
        st = {"booked": '<span class="tag ok">booked</span>', "held": '<span class="tag">held</span>', "to_book": '<span class="tag sig">to book</span>'}[b["status"]]
        w = b.get("window", "")
        wcls = ' style="color:var(--crit);font-weight:600"' if "31 Oct" in w else ""
        rows += (f'<tr{" class=sel" if sel and sel in b["title"] else ""}><td><span class="k">{icon(C.KIND_ICON[b["kind"]], 15)}</span></td><td class="mono">{b["day"].upper()}</td><td><b>{esc(b["title"])}</b><div class="muted" style="font-size:12.5px">{esc(b["when"])}</div></td>'
                 f'<td>{st}</td><td class="mono"{wcls}>{esc(w) or esc(b["code"])}</td><td class="mono" style="text-align:right">{esc(b["money"])}</td></tr>')
    return f'<table class="btab"><tr><th></th><th>Day</th><th>Booking</th><th>Status</th><th>Window / code</th><th style="text-align:right">Money</th></tr>{rows}</table>'


def bookings_switch() -> str:
    cr = C.Credits()

    def screen(tid, inner, active="Bookings"):
        return f'<div class="app">{rail(cr, trip=tid, active=active)}<main class="main" style="position:relative">{topbar(tid, "Bookings")}{inner}</main></div>'
    dolo = (f'<div class="pad"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h1 class="h" style="font-size:22px">BOOKINGS</h1><span class="mono muted">3 booked · 1 held · 5 to book</span>'
            f'<span style="flex:1"></span><button class="btn">{icon("mail", 15)} Forward email</button><button class="btn sig">{icon("plus", 15)} Add booking <kbd style="background:transparent;color:var(--sig-ink);border-color:rgba(0,0,0,.3)">N</kbd></button></div>'
            f'<div class="panel">{btable(D.DOLO_BOOKINGS)}</div></div>')
    prow = ""
    for tid, nx, crit, on, kb in [("elora", "tubing slot opens Mon 19 Oct", True, False, "1"), ("patagonia", "flight + El Chaltén by Sat 31 Oct", True, True, "2"),
                                   ("dolomites", "Ortisei stay by Mon 15 Mar · current", False, False, "3"), ("costa-rica", "pick the second base", False, False, "4")]:
        t = D.TRIP[tid]
        prow += (f'<div class="prow{" on" if on else ""}" {tc(tid)}><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"])}</b><small>{esc(t["dates"])}</small></div>'
                 f'<span class="nx{" crit" if crit else ""}">{esc(nx)}</span><span class="go">{"↵ Bookings" if on else "⌘" + kb}</span></div>')
    palette = (f'<div class="scrim"></div><div class="palette"><div class="q">{icon("swap", 18)}<span>Switch trip, stays on</span><b>Bookings</b><kbd>esc</kbd></div>'
               f'<div class="cap">In progress · soonest first</div>{prow}<div class="cap">Planning</div>'
               + "".join(f'<div class="prow" {tc(x)}><img src="{cr.url(D.TRIP[x]["photo"], 330)}" alt=""><div><b>{esc(D.TRIP[x]["title"])}</b><small>{esc(D.TRIP[x]["dates"])}</small></div><span class="nx">{esc(D.TRIP[x]["next"][:34])}</span><span class="go"></span></div>' for x in ("iceland", "chamonix"))
               + '<div class="ft"><span>↑↓ move</span><span>↵ open on Bookings</span><span>⌘1–4 jump</span><span style="margin-left:auto">Done trips (3) →</span></div></div>')
    f1 = (f'<div class="fcap"><b>01 · Dolomites / Bookings → ⌘K</b><span>The switcher keeps the current tab. In-progress trips first, each with its next deadline.</span></div>'
          f'<div class="frame">{screen("dolomites", dolo + palette)}</div>')
    pat = (f'<div class="pad" style="padding-right:460px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h1 class="h" style="font-size:22px">BOOKINGS</h1><span class="mono muted">0 booked · 1 held · 7 to book</span></div>'
           f'<div class="panel">{btable(D.PATA_BOOKINGS)}</div></div>')

    def drawer(tid, title, kind_on, fields, save):
        t = D.TRIP[tid]
        kinds = "".join(f'<span class="{"on" if k == kind_on else ""}">{icon(i, 14)} {k}</span>' for k, i in [("Flight", "plane"), ("Stay", "bed"), ("Car", "car"), ("Activity", "ticket")])
        return (f'<div class="drawerB" {tc(tid)}><div class="hd"><span class="cap">New booking in</span><div class="who"><img src="{cr.url(t["photo"], 330)}" {D.focus(t["photo"])} alt=""><div><b>{esc(t["title"]).upper()}</b>'
                f'<div class="mono muted" style="font-size:11.5px">{esc(t["dates"])}</div></div></div></div><div class="bd"><div class="fl"><label>Kind</label><div class="kindsB">{kinds}</div></div>'
                f'<div class="fl"><label>Title</label><div class="in focus">{title}</div></div>{fields}'
                f'<div class="fl"><label>Files under</label><div class="in"><i class="sq" {tc(tid)}></i><b>{esc(t["title"])}</b><span class="muted mono" style="font-size:12px">matched by dates</span><a href="#" style="margin-left:auto;font-size:12.5px;text-decoration:underline">Change trip</a></div></div>'
                f'</div><div class="ftr"><button class="btn sig">Save to {esc(t["title"])}</button><button class="btn">Cancel</button><span class="mono muted" style="margin-left:auto;font-size:11.5px">⌘Z undo</span></div></div>')
    fields_p = ('<div class="two"><div class="fl"><label>Departs · Toronto</label><div class="in mono">2027-02-26 23:50</div></div><div class="fl"><label>Arrives · Buenos Aires</label><div class="in mono">2027-02-27 11:05</div></div></div>'
                '<div class="two"><div class="fl"><label>From</label><div class="in mono">YYZ</div></div><div class="fl"><label>To</label><div class="in mono">EZE</div></div></div>'
                '<div class="fl"><label>Travellers</label><div class="in">Nitin · Partner · Aarav (10)</div></div>')
    toast = f'<div class="toastB"><span class="sq" {tc("dolomites")}></span>Dolomites kept: Bookings, row Day 09 <kbd>⌘[</kbd> back</div>'
    f2 = (f'<div class="fcap"><b>02 · Patagonia / Bookings · add the flight</b><span>Same tab. The drawer header and the save button name the trip.</span></div>'
          f'<div class="frame">{screen("patagonia", pat + drawer("patagonia", "Toronto → Buenos Aires", "Flight", fields_p, "") + toast)}</div>')
    dolo3 = (f'<div class="pad" style="padding-right:460px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h1 class="h" style="font-size:22px">BOOKINGS</h1></div>'
             f'<div class="panel">{btable(D.DOLO_BOOKINGS[4:], sel="Ortisei")}</div></div>')
    fields_d = ('<div class="two"><div class="fl"><label>Check in</label><div class="in mono">2027-07-21 15:00</div></div><div class="fl"><label>Check out</label><div class="in mono">2027-07-25 10:00</div></div></div>'
                '<div class="two"><div class="fl"><label>Total</label><div class="in mono">EUR 1,560</div></div><div class="fl"><label>Free cancel until</label><div class="in mono">2027-07-05</div></div></div>')
    f3 = (f'<div class="fcap"><b>03 · ⌘[ back to Dolomites · Ortisei</b><span>Second switch, one key. Bookings again, the Ortisei row open. Nothing was filed in Patagonia.</span></div>'
          f'<div class="frame" style="height:640px"><div style="height:640px;overflow:hidden">{screen("dolomites", dolo3 + drawer("dolomites", "Ortisei, 4 nights (Guest Pass)", "Stay", fields_d, ""))}</div></div>')
    body = f'<div style="padding:4px 0 30px">{f1}{f2}{f3}</div><div style="max-width:1440px;margin:0 auto">{cr.html()}</div>'
    return C.page("Altimeter · Switching trips in Bookings", CSS, body, theme="dark")


def public() -> str:
    cr = C.Credits()
    hero = (f'<section class="hero"><img src="{cr.url("seceda", 1920)}" {D.focus("seceda")} alt=""><div class="in"><span class="cap" style="color:#9AA4AC">Published plan · South Tyrol and Veneto</span>'
            f'<h1>Dolomites<br>13 nights</h1><p>Three valley bases, early starts at the famous lakes, a Sass Pordoi day and sunset in Val di Funes. A rental car throughout.</p>'
            f'<div class="acts"><button class="btn sig">{icon("copy", 15)} Copy to my trips</button><button class="btn">{icon("share", 15)} Share</button></div>'
            f'<div class="spec">' + "".join(f'<div><span>{a}</span><b>{b}</b></div>' for a, b in [("Days", "14"), ("Bases", "4"), ("Drive / day", "1h10"), ("Walk", "6–15 km"), ("Effort", "MOD"), ("Age", "8+")])
            + '</div></div></section>')
    s = D.SEASON
    temps = [-2, 0, 4, 8, 13, 17, 20, 19, 15, 10, 4, 0]
    rain = [45, 40, 55, 75, 110, 130, 135, 125, 90, 85, 85, 55]
    valid = "".join(f'<i class="{"on" if m in s["months"] else "sh" if m in s["shoulder"] else ""}"></i>' for m in range(1, 13))
    tbar = "".join(f'<div class="bar{" on" if m + 1 in s["months"] else ""}" style="height:{max(t + 4, 2) * 2.2:.0f}px"></div>' for m, t in enumerate(temps))
    rbar = "".join(f'<div class="bar{" on" if m + 1 in s["months"] else ""}" style="height:{r / 3.5:.0f}px"></div>' for m, r in enumerate(rain))
    chart = (f'<div class="panel mchart"><div class="phead" style="margin:-14px -14px 12px"><span class="cap">Valid for · {s["label"]}</span><span class="sp"></span><span class="tag sig">Jul – Aug</span></div>'
             f'<div class="valid"><span class="cap" style="align-self:center">Plan</span>{valid}</div><div class="row"><span class="l">Valley °C</span>{tbar}</div>'
             f'<div class="row"><span class="l">Rain mm</span>{rbar}</div><div class="ml"><span></span>{"".join(f"<span>{m}</span>" for m in "J F M A M J J A S O N D".split())}</div>'
             f'<p class="muted" style="font-size:12px;margin-top:8px">Bolzano valley climate normals, shape only. Solid amber: the plan as written. Hatched: lifts and huts to check.</p></div>')
    wx = (f'<div class="panel"><div class="phead"><span class="cap">Mid-July conditions</span></div><div class="wxB">' + "".join(f'<div><span class="cap">{a}</span><b>{b}</b><span>{c}</span></div>' for a, b, c in s["weather"])
          + '</div><div style="padding:12px 14px;display:grid;gap:8px">' + "".join(f'<div style="display:flex;gap:8px;font-size:13.5px">{icon("alert", 15)}{esc(n)}</div>' for n in s["notes"]) + "</div>"
          f'<div style="padding:0 14px 14px"><p style="font-size:14px;color:var(--ink2)">{s["why"]}</p></div></div>')
    rows = ""
    for n, title, base, drive, stops, ph in D.PUBLIC_DAYS:
        img = f'<img src="{cr.url(ph, 330)}" alt="">' if ph else '<span style="display:block;width:84px;height:52px;border-radius:4px;background:var(--s3)"></span>'
        rows += f'<tr><td class="n">{n:02d}</td><td>{img}</td><td><b>{esc(title)}</b><div class="muted" style="font-size:12.5px">{esc(" · ".join(stops))}</div></td><td class="mono">{esc(base).upper()}</td><td class="mono" style="text-align:right">{drive.replace(" ", "")}</td></tr>'
    mp = C.trip_map(MAP, pane=(560, 700), pin_px=9, pad=.06)
    days = (f'<div class="hgrid" style="grid-template-columns:1fr 560px;margin-top:16px"><div class="panel"><div class="phead"><span class="cap">Day by day · days, not dates</span></div>'
            f'<table class="table dayt"><tr><th>Day</th><th></th><th>Plan</th><th>Base</th><th style="text-align:right">Drive</th></tr>{rows}</table></div>'
            f'<div class="panel" style="position:relative;overflow:hidden;height:700px;position:sticky;top:20px">{mp.replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div></div>')
    body = (f'<div class="main">{hero}<div class="wrapB"><div class="seasonB">{chart}{wx}</div>{days}</div>{cr.html()}</div>')
    return C.page("Altimeter · Public trip", CSS, body, theme="dark")


def trail() -> str:
    cr = C.Credits()
    T = D.TRAIL
    th = T["trailhead"]
    ro = "".join(f'<div><span class="cap">{k}</span><b>{v}{f" <small>{u}</small>" if u else ""}</b><span class="conf c-{c}"><i></i>{esc(src)[:26]}</span></div>' for k, v, u, src, c in T["facts"])
    head = (f'<section class="thB"><div class="ph"><img src="{cr.url("locatelli", 1920)}" {D.focus("locatelli")} alt=""></div><div class="in">'
            f'<span class="cap">Trail · {esc(T["area"])}</span><h1>{esc(T["name"])}</h1><p>{esc(T["summary"])}</p>'
            f'<div style="display:flex;gap:8px;margin:16px 0"><button class="btn sig">{icon("plus", 15)} Add to Dolomites · Day 03</button><button class="btn">{icon("download", 15)} GPX</button><button class="btn">{icon("share", 15)} Share</button></div>'
            f'<div class="readouts">{ro}</div></div></section>')
    huts = "".join(f'<tr><td><b>{esc(n)}</b></td><td class="mono">{km}</td><td class="mono">{el}</td></tr>' for n, km, el in T["huts"])
    route = (f'<div class="panel"><div class="phead"><span class="cap">Elevation · clockwise from Rifugio Auronzo</span><span class="sp"></span><span class="mono muted" style="font-size:12px">min 2,270 · max 2,454 m</span></div>'
             f'<div style="padding:14px 14px 4px">{C.elevation_svg(780, 160)}</div><table class="table"><tr><th>Waypoint</th><th>At</th><th>Elevation</th></tr>{huts}</table></div>')
    kv = "".join(f'<dt>{k}</dt><dd{" class=mono" if k in ("Coordinates", "Elevation", "Fee") else ""}>{v}</dd>' for k, v in
                 [("Trailhead", th["name"]), ("Elevation", th["elev"]), ("Coordinates", f'{th["lat"]}, {th["lon"]}'), ("Parking", th["parking"]),
                  ("Fee", th["fee"]), ("Fills", th["fills"]), ("Booking", th["booking"]), ("Opens", th["opens"]), ("Bus", th["shuttle"])])
    park = (f'<div class="panel"><div class="phead"><span class="cap">Trailhead and parking</span><span class="sp"></span><span class="tag sig">window · opens 15 Jun 2027</span></div>'
            f'<div style="display:grid;grid-template-columns:300px 1fr"><img src="{cr.url("auronzo-park", 960)}" style="width:300px;height:100%;object-fit:cover;object-position:50% 60%" alt=""><dl class="kvB">{kv}</dl></div></div>')
    when = "".join(f'<dt>{k}</dt><dd>{esc(v)} <span class="conf c-plan"><i></i>{esc(s)}</span></dd>' for k, v, s in T["when"]) + "".join(f'<dt>{k}</dt><dd>{esc(v)}</dd>' for k, v, s in T["who"])
    whenp = f'<div class="panel"><div class="phead"><span class="cap">When and who</span></div><dl class="kvB">{when}</dl></div>'
    links = "".join(f'<tr><td><span class="conf c-official" style="margin-bottom:2px">{k}</span><b style="display:block">{esc(l)}</b><div class="mono muted" style="font-size:11.5px">{esc(dom)} · {esc(n)}</div></td><td class="mono muted" style="font-size:11.5px;white-space:nowrap;text-align:right">✓ 18 Oct</td></tr>' for k, l, dom, n, c in T["links"])
    linksp = f'<div class="panel"><div class="phead"><span class="cap">Links · all {len(T["links"])}</span><span class="sp"></span><button class="btn">{icon("plus", 14)} Add link</button></div><table class="table ltab">{links}</table></div>'
    mm = C.trip_map(MAP, pane=(420, 300), box=(12.24, 46.59, 12.32, 46.63), pin_px=10, label_bases=False, only_days=[3], selected=3)
    hz = "".join(f'<div style="display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:13.5px">{icon("alert", 15)}{esc(h)}</div>' for h in T["hazards"])
    right = (f'<div style="display:grid;gap:16px;align-content:start"><div class="panel" style="position:relative;height:300px;overflow:hidden">{mm.replace("<svg ", "<svg style=position:absolute;inset:0;width:100%;height:100% ")}</div>'
             f'<div class="panel"><div class="phead"><span class="cap">Hazards</span></div>{hz}</div>{linksp}</div>')
    grid = f'<div class="tgB"><div style="display:grid;gap:16px;align-content:start">{route}{park}{whenp}</div>{right}</div>'
    main = f'<main class="main">{topbar("dolomites", "Explore / Trail")}{head}{grid}{cr.html()}</main>'
    return C.page("Altimeter · Trail page", CSS, f'<div class="app">{rail(cr, trip="dolomites", active="Explore")}{main}</div>', theme="dark")


PAGES = {"home": home, "plan": plan, "plan-phone": plan_phone, "today-phone": today_phone, "bookings-switch": bookings_switch,
         "public-trip": public, "trail": trail}


def build() -> None:
    for name, fn in PAGES.items():
        C.write(f"{DIR}/{name}.html", fn())


if __name__ == "__main__":
    build()
