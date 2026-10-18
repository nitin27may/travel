import numpy as np
from PIL import Image, ImageFilter
"""Render the three directions' relief maps from build/dem/dem.npy into ../assets/."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets") + "/"
os.makedirs(OUT, exist_ok=True)
dem0 = np.load(os.path.join(HERE, "dem", "dem.npy"))
SC = 1.2
h0, w0 = dem0.shape
demI = Image.fromarray(dem0.astype(np.float32), "F").resize((int(w0*SC), int(h0*SC)), Image.BILINEAR)
dem = np.asarray(demI).astype(np.float64)
def blur(a, r=2, n=3):
    for _ in range(n):
        k = 2*r+1
        c = np.cumsum(np.pad(a, ((0,0),(r+1,r)), mode="edge"), axis=1); a = (c[:, k:] - c[:, :-k]) / k
        c = np.cumsum(np.pad(a, ((r+1,r),(0,0)), mode="edge"), axis=0); a = (c[k:, :] - c[:-k, :]) / k
    return a
dem = blur(dem)
px = 52.6 / SC
def hillshade(z, az=315, alt=45, zf=1.6):
    gy, gx = np.gradient(z * zf, px)
    slope = np.pi/2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, al = np.radians(az), np.radians(alt)
    hs = np.sin(al)*np.sin(slope) + np.cos(al)*np.cos(slope)*np.cos(a - aspect)
    return np.clip(hs, 0, 1)
hs = 0.6*hillshade(dem, 315) + 0.25*hillshade(dem, 270, 50) + 0.15*hillshade(dem, 0, 60)
def contours(z, step):
    b = np.floor(z / step)
    e = np.zeros_like(b, dtype=bool)
    e[:, 1:] |= b[:, 1:] != b[:, :-1]
    e[1:, :] |= b[1:, :] != b[:-1, :]
    return e
c100 = contours(dem, 100); c500 = contours(dem, 500)
def hexrgb(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float)
def ramp(z, stops):
    zs = [s[0] for s in stops]; cols = np.array([hexrgb(s[1]) for s in stops])
    out = np.zeros(z.shape + (3,))
    for i in range(3): out[..., i] = np.interp(z, zs, cols[:, i])
    return out
def mix(base, col, alpha):
    a = alpha[..., None] if np.ndim(alpha) == 2 else alpha
    return base*(1-a) + hexrgb(col)*a if isinstance(col, str) else base*(1-a) + col*a
def save(rgb, name, width=1800):
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    im = im.resize((width, int(width * im.size[1] / im.size[0])), Image.LANCZOS)
    im.save(OUT + name, "WEBP", quality=72, method=6); print(name, im.size, os.path.getsize(OUT + name)//1024, "KB")
shade = (hs - hs.mean()) / hs.std()     # centred shading
# ---- A. Atlas: paper, very soft relief, no contours
base = np.ones(dem.shape + (3,)) * hexrgb("#F3F1EC")
lum = np.clip(0.5 + 0.11*shade, 0, 1)[..., None]
atl = base * (0.82 + 0.36*lum)
atl = mix(atl, "#FFFFFF", np.clip((dem-2300)/900, 0, 1)*0.55)
save(atl, "map-atlas-light.webp")
based = np.ones(dem.shape + (3,)) * hexrgb("#16181B")
atd = based * (0.75 + 0.55*np.clip(0.5 + 0.16*shade, 0, 1)[..., None])
save(atd, "map-atlas-dark.webp")
# ---- B. Altimeter: dark first, contour instrument
b = np.ones(dem.shape + (3,)) * hexrgb("#0C0F12")
b = b * (0.75 + 0.75*np.clip(0.5 + 0.2*shade, 0, 1)[..., None])
b = mix(b, "#2C3D49", c100*0.85); b = mix(b, "#557286", c500*0.95)
save(b, "map-alt-dark.webp")
bl = np.ones(dem.shape + (3,)) * hexrgb("#F7F8F9")
bl = bl * (0.93 + 0.12*np.clip(0.5 + 0.18*shade, 0, 1)[..., None])
bl = mix(bl, "#D3D9DE", c100*0.8); bl = mix(bl, "#AEB8C0", c500*0.9)
save(bl, "map-alt-light.webp")
# ---- C. Trailhead: hypsometric field-map tint + relief + brown contours
stops = [(200, "#E2E5E8"), (900, "#DEE2E5"), (1500, "#D8DCE0"), (2000, "#D6DADE"), (2400, "#E3E6E9"), (2800, "#F3F5F6"), (3400, "#FFFFFF")]
t = ramp(dem, stops)
t = t * (0.8 + 0.4*np.clip(0.5 + 0.17*shade, 0, 1)[..., None])
t = mix(t, "#A98E6C", c100*0.30); t = mix(t, "#8C7254", c500*0.5)
save(t, "map-trail-light.webp")
stopsd = [(200, "#111821"), (1500, "#162030"), (2400, "#1F2B3A"), (3400, "#2E3B4B")]
td = ramp(dem, stopsd)
td = td * (0.75 + 0.6*np.clip(0.5 + 0.17*shade, 0, 1)[..., None])
td = mix(td, "#2C3B4C", c100*0.7); td = mix(td, "#4A5F75", c500*0.85)
save(td, "map-trail-dark.webp")
