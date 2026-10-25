"""Render symbol.svg as a high-res PNG: theme blue on white.

Run from keysy/:
    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib uv run --with cairosvg \
        python design/logo/convert_logo.py design/logo/symbol.svg design/logo/symbol-light.png
"""

import sys
from pathlib import Path

import cairosvg

LOGO_BLUE = "#2f5aba"  # `button` token, light mode (design/theme/README.md)
SIZE_PX = 1024


def convert_logo(svg_path: Path, png_path: Path) -> None:
    svg = svg_path.read_text().replace("currentColor", LOGO_BLUE)
    cairosvg.svg2png(
        bytestring=svg.encode(),
        write_to=str(png_path),
        output_width=SIZE_PX,
        output_height=SIZE_PX,
        background_color="#ffffff",
    )


if __name__ == "__main__":
    convert_logo(Path(sys.argv[1]), Path(sys.argv[2]))
