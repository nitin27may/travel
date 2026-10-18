#!/usr/bin/env python3
"""Rebuild public/relief-{light,dark}.webp: shaded relief + hypsometric tint for the Dolomites box,
from AWS Terrain Tiles (Terrarium PNG, open data, Mapzen) at zoom 12. Needs numpy and pillow.
    python3 scripts/make_relief.py   # downloads ~350 tiles (~47 MB) into .cache/dem, writes public/*.webp
The image corners are printed; MapView.tsx's RELIEF constant must match them."""
import concurrent.futures as cf, math, os, pathlib, urllib.request
import numpy as np
from PIL import Image

Z, BOX = 12, (10.9, 46.15, 12.75, 47.05)          # west, south, east, north
CACHE = pathlib.Path(".cache/dem"); CACHE.mkdir(parents=True, exist_ok=True)

def xy(lon, lat, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n

x0, y0 = xy(BOX[0], BOX[3], Z); x1, y1 = xy(BOX[2], BOX[1], Z)
X = list(range(int(x0), int(x1) + 1)); Y = list(range(int(y0), int(y1) + 1))

def fetch(t):
    x, y = t; f = CACHE / f"{Z}_{x}_{y}.png"
    if not f.exists():
        urllib.request.urlretrieve(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png", f)
with cf.ThreadPoolExecutor(8) as ex: list(ex.map(fetch, [(x, y) for x in X for y in Y]))

W, H = len(X) * 256, len(Y) * 256
elev = np.zeros((H, W), np.float32)
for i, x in enumerate(X):
    for j, y in enumerate(Y):
        a = np.asarray(Image.open(CACHE / f"{Z}_{x}_{y}.png").convert("RGB")).astype(np.float32)
        elev[j*256:(j+1)*256, i*256:(i+1)*256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

def lonlat(px, py):
    n = 2 ** Z
    return px / 256 / n * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * py / 256 / n))))
print("top-left", lonlat(X[0] * 256, Y[0] * 256), "bottom-right", lonlat((X[-1] + 1) * 256, (Y[-1] + 1) * 256))

res = 40075016.686 * math.cos(math.radians(46.6)) / (256 * 2 ** Z)
gy, gx = np.gradient(elev, res)
slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
def shade(az, alt):
    az, alt = math.radians(az), math.radians(alt)
    return np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
hs = 0.5 * shade(315, 40) + 0.3 * shade(270, 45) + 0.2 * shade(0, 50)
e = np.clip((elev - 200) / 3100, 0, 1)

def ramp(stops, t):
    out = np.zeros(t.shape + (3,), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1); f = ((t - t0) / (t1 - t0))[m][:, None]
        out[m] = np.array(c0) * (1 - f) + np.array(c1) * f
    return out
LIGHT = [(0, (214, 224, 214)), (.25, (226, 232, 222)), (.5, (236, 236, 228)), (.75, (244, 242, 238)), (1, (252, 252, 252))]
DARK = [(0, (14, 19, 17)), (.3, (18, 24, 21)), (.6, (24, 30, 27)), (1, (36, 42, 40))]
for name, stops, amb, k in (("light", LIGHT, .62, .48), ("dark", DARK, .55, .75)):
    rgb = ramp(stops, e) * (amb + k * hs[..., None]) + ((hs[..., None] ** 3) * 14 if name == "dark" else 0)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(f"public/relief-{name}.webp", quality=72, method=6)
print("wrote public/relief-light.webp, public/relief-dark.webp")
