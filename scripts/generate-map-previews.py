#!/usr/bin/env python3
"""Render lobby map previews directly from the Tiled map data and tilesets."""

from pathlib import Path

from tiled_renderer import render_tilemap


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUTPUT = ASSETS / "map-previews"
def render_map(name):
    map_path = ASSETS / "tilemaps" / f"{name}.json"
    _, canvas = render_tilemap(map_path)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    output_name = "classic" if name == "default" else name
    canvas.save(OUTPUT / f"{output_name}.png", optimize=True)


if __name__ == "__main__":
    render_map("default")
    render_map("office")
