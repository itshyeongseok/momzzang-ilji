"""icon.svg 디자인을 PNG로 렌더링 (아이폰 홈 화면 아이콘용). 4x 슈퍼샘플링으로 부드럽게."""
from PIL import Image, ImageDraw

# 블루 그라데이션 (앱 강조색): #38BDF8 -> #3B82F6 -> #2563EB
G1 = (56, 189, 248)   # #38BDF8
G2 = (59, 130, 246)   # #3B82F6
G3 = (37, 99, 235)    # #2563EB
WHITE = (255, 255, 255)
GREEN = (22, 185, 129)  # #16B981

S = 4  # 슈퍼샘플 배율
BASE = 512


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad_rounded(size, r, c1, c2, c3):
    """대각(좌상->우하) 3색 선형 그라데이션 + 둥근 사각 마스크."""
    w = h = size
    base = Image.new("RGB", (w, h))
    px = base.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            if t < 0.55:
                col = lerp(c1, c2, t / 0.55)
            else:
                col = lerp(c2, c3, (t - 0.55) / 0.45)
            px[x, y] = col
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def rr(d, x, y, w, h, r, fill):
    d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=r * S, fill=fill)


def render():
    # 배경: 그라데이션 (256에서 그린 뒤 업스케일 -> 픽셀 루프 부담 줄임)
    bg = grad_rounded(256, 56, G1, G2, G3).resize((BASE * S, BASE * S), Image.LANCZOS)
    img = bg
    d = ImageDraw.Draw(img)
    # 성장 막대 3개 (흰색, 라운드): 낮음 -> 높음
    rr(d, 120, 300, 64, 92, 24, WHITE)
    rr(d, 224, 232, 64, 160, 24, WHITE)
    rr(d, 328, 150, 64, 242, 24, WHITE)
    # 상승 포인트 점 (에메랄드 악센트)
    cx, cy, r = 360, 120, 26
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=GREEN)
    return img.resize((BASE, BASE), Image.LANCZOS)


master = render()
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "icon-180.png")]:
    master.resize((size, size), Image.LANCZOS).save(name)
    print("저장:", name)
