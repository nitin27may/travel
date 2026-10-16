#!/usr/bin/env python3
"""Sequenced Google Maps loop per day, in visiting order. Coordinates where names are ambiguous."""
import json, urllib.parse
P={r["name"]:r for r in json.load(open("pins-final.json"))}
def c(n):
    r=P[n]; return f'{r["lat"]},{r["lon"]}'
def link(stops):
    return "https://www.google.com/maps/dir/" + "/".join(urllib.parse.quote(s,safe=",") for s in stops) + "/"

BASE=c("Base — 1592 Center Rd, Hyde Park")
DAYS={
"Day 1 — Thu 1 Oct · Whitby → Hyde Park":[
  "Whitby, ON","1555 Provencher Blvd, Brossard, QC","Saint-Armand, QC",
  "Highgate Springs, VT","St. Albans, VT",BASE,c("Moss Glen Falls (Stowe)"),
  c("Hannaford, Morrisville"),c("Raja Indian & Nepali, Stowe"),BASE],
"Day 2 — Fri 2 Oct · Stowe loop":[
  BASE,c("Stowe Pinnacle trailhead"),c("Emily's Bridge (Gold Brook)"),
  c("Stowe Community Church"),c("Stowe Gondola SkyRide"),c("Bingham Falls"),
  c("Smugglers' Notch"),c("Sunset Rock, Stowe"),c("von Trapp Bierhall"),BASE],
"Day 3 — Sat 3 Oct · Northeast Kingdom":[
  BASE,c("Mount Pisgah South trailhead"),c("Lake Willoughby South Beach"),
  c("Lake Willoughby North Beach"),c("Craftsbury Common"),c("Craftsbury General Store"),
  c("Barr Hill Natural Area"),c("Fisher Covered Railroad Bridge"),BASE],
"Day 4A — Sun 4 Oct · covered bridges home":[
  BASE,c("Cambridge Junction / Poland Bridge"),c("Gates Farm Covered Bridge"),
  c("Longley Covered Bridge"),c("Comstock Covered Bridge"),c("Fuller Covered Bridge"),
  c("Hutchins Covered Bridge"),c("Creamery Covered Bridge, Montgomery"),
  "Swanton, VT","Highgate Springs, VT"],
"Day 4B — Sun 4 Oct · Appalachian Gap traverse home":[
  BASE,"Waitsfield, VT",c("Appalachian Gap overlook"),"Bristol, VT",
  "Burlington, VT","Highgate Springs, VT"],
"Backup — Two Gaps day":[
  BASE,c("Great Eddy Covered Bridge, Waitsfield"),c("Warren Store / Warren village"),
  c("Warren Falls"),c("Lincoln Gap (top of pass)"),c("Sunset Ledge trailhead"),
  c("Appalachian Gap overlook"),"Waitsfield, VT",BASE],
}
out={}
for k,v in DAYS.items():
    assert len(v)<=10, (k,len(v))
    out[k]=link(v); print(f"{k}  ({len(v)} points)\n  {link(v)}\n")
json.dump(out,open("day-loops.json","w"),indent=1)
