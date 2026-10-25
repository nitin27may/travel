import sys, json, io
sys.path.insert(0,'.')
import cm
from PIL import Image, ImageDraw
# usage: sheet.py out.jpg "File:A.jpg" "File:B.jpg" ...
out, titles = sys.argv[1], sys.argv[2:]
tw, th, cols = 400, 280, 3
rows = (len(titles)+cols-1)//cols
sh = Image.new("RGB",(cols*tw, rows*(th+16)),"white"); d = ImageDraw.Draw(sh)
for i,t in enumerate(titles):
    x,y = (i%cols)*tw, (i//cols)*(th+16)
    try:
        im = Image.open(io.BytesIO(cm.thumb(t,400))).convert("RGB")
        im.thumbnail((tw-4,th-2)); sh.paste(im,(x+2,y+16))
    except Exception as e:
        d.text((x+4,y+20),f"FAIL {e}",fill="red")
    d.text((x+4,y+2),f"{i}: {t[5:50]}",fill="black")
sh.save(out, quality=82); print(out)
