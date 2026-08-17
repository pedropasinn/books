#!/usr/bin/env python3
"""Gera os ícones e o splash do app a partir de uma marca desenhada em código.

A marca é um parágrafo que se desfaz: três linhas de texto, cada uma mais
curta que a anterior — um "fragmento". Fundo quase preto, traços na cor de
destaque. Rodar com `python3 scripts/gen-icons.py` a partir de mobile/.
"""

from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"

BG = (8, 8, 10, 255)
BRAND = (45, 212, 191, 255)
BRAND_DIM = (45, 212, 191, 130)

# densidade -> lado do ícone (px)
LAUNCHER = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# splash: (largura, altura) por densidade, retrato
SPLASH_PORT = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280),
               "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}


def draw_mark(img: Image.Image, cx: float, cy: float, unit: float) -> None:
    """Três barras arredondadas, larguras 100/68/40%, na cor de destaque."""
    d = ImageDraw.Draw(img)
    bar_h = unit * 0.155
    gap = unit * 0.145
    widths = (1.0, 0.68, 0.40)
    colors = (BRAND, BRAND, BRAND_DIM)
    total = len(widths) * bar_h + (len(widths) - 1) * gap
    top = cy - total / 2
    for i, (w, color) in enumerate(zip(widths, colors)):
        y = top + i * (bar_h + gap)
        half = unit * w / 2
        d.rounded_rectangle(
            [cx - half, y, cx + half, y + bar_h],
            radius=bar_h / 2,
            fill=color,
        )


def launcher(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=BG)
    draw_mark(img, size / 2, size / 2, size * 0.52)
    return img


def round_launcher(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], fill=BG)
    draw_mark(img, size / 2, size / 2, size * 0.48)
    return img


def splash(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), BG)
    draw_mark(img, w / 2, h / 2, min(w, h) * 0.28)
    return img


def main() -> None:
    for density, size in LAUNCHER.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)
        launcher(size).save(out / "ic_launcher.png")
        round_launcher(size).save(out / "ic_launcher_round.png")
        # foreground do ícone adaptativo: glifo menor, dentro da zona segura
        fg = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
        draw_mark(fg, size, size, size * 0.62)
        fg.save(out / "ic_launcher_foreground.png")

    for density, (w, h) in SPLASH_PORT.items():
        for orient, (sw, sh) in (("port", (w, h)), ("land", (h, w))):
            out = RES / f"drawable-{orient}-{density}"
            out.mkdir(parents=True, exist_ok=True)
            splash(sw, sh).save(out / "splash.png")

    base = RES / "drawable"
    base.mkdir(parents=True, exist_ok=True)
    splash(480, 800).save(base / "splash.png")

    print("ícones e splash gerados em", RES)


if __name__ == "__main__":
    main()
