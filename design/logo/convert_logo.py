"""Render logo.svg as a high-res PNG: theme blue on white, equal margins.

Run from keysy/:
    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib uv run --with cairosvg \
        python design/logo/convert_logo.py design/logo/logo.svg design/logo/logo-light.png
"""

import sys
from pathlib import Path

import cairosvg

LOGO_BLUE = "#2f5aba"  # `button` token, light mode (design/theme/README.md)
SCALE = 10

# Painted bounds of logo.svg in viewBox units: x 6.5..232.634, y 21.36..80.88.
MARGIN = 6.5
X, Y = 6.5 - MARGIN, 21.36 - MARGIN
WIDTH = 232.634 - 6.5 + 2 * MARGIN
HEIGHT = 80.88 - 21.36 + 2 * MARGIN


def convert_logo(svg_path: Path, png_path: Path) -> None:
    svg = (
        svg_path.read_text()
        .replace("currentColor", LOGO_BLUE)
        .replace('width="234" height="85" viewBox="0 0 234 85"',
                 f'width="{WIDTH}" height="{HEIGHT}" viewBox="{X} {Y} {WIDTH} {HEIGHT}"')
    )
    cairosvg.svg2png(
        bytestring=svg.encode(),
        write_to=str(png_path),
        scale=SCALE,
        background_color="#ffffff",
    )


if __name__ == "__main__":
    convert_logo(Path(sys.argv[1]), Path(sys.argv[2]))
