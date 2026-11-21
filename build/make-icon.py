# 生成 app.ico / favicon.ico（六边形 3G 徽标）
from PIL import Image, ImageDraw, ImageFont
import os, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
os.makedirs(BUILD, exist_ok=True)

S = 256
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角深色底
d.rounded_rectangle([6, 6, S - 6, S - 6], radius=52, fill=(10, 14, 9, 255))

def hexagon(cx, cy, r, rot=math.pi / 2):
    return [(cx + math.cos(rot + i * math.pi / 3) * r,
             cy + math.sin(rot + i * math.pi / 3) * r) for i in range(6)]

# 外圈青柠六边形 + 内圈深色
d.polygon(hexagon(128, 128, 104), fill=(184, 242, 74, 255))
d.polygon(hexagon(128, 128, 80), fill=(17, 26, 12, 255))
# 顶部高光
d.polygon([(64, 62), (128, 28), (192, 62), (176, 74), (128, 46), (80, 74)], fill=(255, 255, 255, 36))

# 3G 文字
font = None
for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(p):
        font = ImageFont.truetype(p, 86)
        break
text = "3G"
if font:
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text((128 - tw / 2 - bb[0], 128 - th / 2 - bb[1] - 2), text, font=font, fill=(184, 242, 74, 255))
else:
    d.rectangle([84, 104, 172, 152], fill=(184, 242, 74, 255))

img.save(os.path.join(BUILD, "app.ico"),
         sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
img.save(os.path.join(BUILD, "app-256.png"))
img.save(os.path.join(ROOT, "favicon.ico"),
         sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)])
print("ok:", BUILD)
