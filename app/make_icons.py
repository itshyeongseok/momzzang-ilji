"""icon.svg 디자인을 PNG로 렌더링 (아이폰 홈 화면 아이콘용). 4x 슈퍼샘플링으로 부드럽게."""
from PIL import Image, ImageDraw

BG = (15, 17, 21)
SURF = (23, 26, 33)
LINE = (42, 49, 64)
GREEN = (74, 222, 128)
BLUE = (56, 189, 248)

S = 4  # 슈퍼샘플 배율
BASE = 512


def rr(d, x, y, w, h, r, fill, outline=None, width=0):
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=r * S,
                        fill=fill, outline=outline, width=width * S)


def render():
    img = Image.new("RGBA", (BASE * S, BASE * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rr(d, 0, 0, 512, 512, 112, BG)
    rr(d, 56, 56, 400, 400, 84, SURF, outline=LINE, width=4)
    # 덤벨 (초록)
    rr(d, 150, 236, 212, 40, 14, GREEN)
    rr(d, 104, 200, 46, 112, 18, GREEN)
    rr(d, 362, 200, 46, 112, 18, GREEN)
    rr(d, 74, 224, 34, 64, 14, GREEN)
    rr(d, 404, 224, 34, 64, 14, GREEN)
    # 파란 점
    cx, cy, r = 256, 150, 18
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=BLUE)
    return img.resize((BASE, BASE), Image.LANCZOS)


master = render()
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "icon-180.png")]:
    master.resize((size, size), Image.LANCZOS).save(name)
    print("저장:", name)
