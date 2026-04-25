#!/usr/bin/env python3
"""Regenerate public favicon + PWA icons from logos/LLLIA_logo_trans.png. Run after changing the source logo."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "logos" / "LLLIA_logo_trans.png"


def make_square(im: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    margin = 0.09
    max_side = int(size * (1 - 2 * margin))
    w, h = im.size
    scale = min(max_side / w, max_side / h)
    nw, nh = int(w * scale), int(h * scale)
    r = im.resize((nw, nh), Image.Resampling.LANCZOS)
    x, y = (size - nw) // 2, (size - nh) // 2
    canvas.paste(r, (x, y), r)
    return canvas


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    make_square(im, 192).save(ROOT / "public" / "icons" / "app-icon-192.png", "PNG")
    make_square(im, 512).save(ROOT / "public" / "icons" / "app-icon-512.png", "PNG")
    im.save(ROOT / "public" / "LLLIA_logo_trans.png", "PNG")
    f32 = make_square(im, 32)
    f16 = f32.resize((16, 16), Image.Resampling.LANCZOS)
    f32.save(
        ROOT / "public" / "favicon.ico",
        format="ICO",
        sizes=[(32, 32), (16, 16)],
        append_images=[f16],
    )
    print(f"OK: {SRC} ({im.size[0]}x{im.size[1]}) -> public favicon + icons")


if __name__ == "__main__":
    main()
