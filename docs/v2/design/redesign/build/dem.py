"""Fetch Mapterhorn terrarium tiles (zoom 10) for the Dolomites box into build/dem/ and save dem.npy. Sequential, cached."""
import math, time, urllib.request, io, os, sys
import numpy as np
from PIL import Image
UA = "nks-travel-redesign/0.1 (design preview)"
Z = 10
HERE = os.path.dirname(os.path.abspath(__file__))
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat):
    r = math.radians(lat); return (1 - math.log(math.tan(r) + 1/math.cos(r)) / math.pi) / 2 * 2**Z
W, E, S, N = 11.10, 12.60, 45.85, 47.30
xs = range(int(tx(W)), int(tx(E)) + 1); ys = range(int(ty(N)), int(ty(S)) + 1)
print(list(xs), list(ys))
rows = []
for y in ys:
    row = []
    for x in xs:
        os.makedirs(os.path.join(HERE, "dem"), exist_ok=True); fn = os.path.join(HERE, "dem", f"{Z}-{x}-{y}.webp")
        if not os.path.exists(fn):
            req = urllib.request.Request(f"https://tiles.mapterhorn.com/{Z}/{x}/{y}.webp", headers={"User-Agent": UA})
            open(fn, "wb").write(urllib.request.urlopen(req, timeout=30).read()); time.sleep(0.5)
        a = np.asarray(Image.open(fn).convert("RGB")).astype(np.float64)
        row.append(a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768)
    rows.append(np.hstack(row))
dem = np.vstack(rows)
# crop to the exact bounds
T = 512
x0 = (tx(W) - xs[0]) * T; x1 = (tx(E) - xs[0]) * T; y0 = (ty(N) - ys[0]) * T; y1 = (ty(S) - ys[0]) * T
dem = dem[int(y0):int(y1), int(x0):int(x1)]
np.save(os.path.join(HERE, "dem", "dem.npy"), dem); print(dem.shape, dem.min(), dem.max())
