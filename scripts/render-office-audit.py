#!/usr/bin/env python3
"""Render the generated Office map with navigation and collision overlays."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw
from tiled_renderer import layer_data, properties, render_tilemap


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "public" / "assets" / "tilemaps" / "office.json"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/office-map-audit.png"),
    )
    args = parser.parse_args()

    tilemap, canvas = render_tilemap(MAP_PATH)
    tile_width = tilemap["tilewidth"]
    tile_height = tilemap["tileheight"]
    world_width = tilemap["width"] * tile_width
    world_height = tilemap["height"] * tile_height
    colliding_gids = set()
    for tileset in tilemap["tilesets"]:
        for tile in tileset.get("tiles", []):
            if properties(tile).get("collides"):
                colliding_gids.add(tileset["firstgid"] + tile["id"])

    tile_layers = [layer for layer in tilemap["layers"] if layer["type"] == "tilelayer"]

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    corridor_layer = next(
        layer for layer in tilemap["layers"] if layer["name"] == "navigation_corridors"
    )
    for corridor in corridor_layer["objects"]:
        box = (
            corridor["x"],
            corridor["y"],
            corridor["x"] + corridor["width"],
            corridor["y"] + corridor["height"],
        )
        draw.rectangle(box, fill=(44, 210, 110, 45), outline=(44, 255, 130, 230), width=2)
        draw.text((corridor["x"] + 3, corridor["y"] + 3), corridor["name"], fill=(220, 255, 230, 255))

    collision_layers = {
        "decoration_0",
        "decoration_1",
        "decoration_2",
    }
    for layer in tile_layers:
        if layer["name"] not in collision_layers:
            continue
        for index, raw_gid in enumerate(layer_data(layer)):
            if (raw_gid & 0x1FFFFFFF) not in colliding_gids:
                continue
            x = (index % tilemap["width"]) * tile_width
            y = (index // tilemap["width"]) * tile_height
            draw.rectangle(
                (x, y, x + tile_width, y + tile_height),
                fill=(255, 154, 45, 45),
                outline=(255, 174, 60, 220),
                width=1,
            )

    collider_layer = next(
        layer for layer in tilemap["layers"] if layer["name"] == "furniture_colliders"
    )
    for collider in collider_layer["objects"]:
        box = (
            collider["x"],
            collider["y"],
            collider["x"] + collider["width"],
            collider["y"] + collider["height"],
        )
        draw.rectangle(box, fill=(255, 45, 75, 90), outline=(255, 45, 75, 255), width=2)

    check_layer = next(
        layer for layer in tilemap["layers"] if layer["name"] == "navigation_checks"
    )
    for checkpoint in check_layer["objects"]:
        x, y = checkpoint["x"], checkpoint["y"]
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(60, 220, 255, 255))
        draw.text((x + 7, y - 6), checkpoint["name"], fill=(210, 250, 255, 255))

    canvas = Image.alpha_composite(canvas, overlay)
    legend = Image.new("RGBA", (world_width, 34), (22, 28, 36, 255))
    legend_draw = ImageDraw.Draw(legend)
    legend_draw.text(
        (10, 10),
        "GREEN navigation corridors   CYAN checkpoints   ORANGE tile collision   RED furniture collision",
        fill=(240, 244, 248, 255),
    )
    result = Image.new("RGBA", (world_width, world_height + legend.height))
    result.alpha_composite(legend, (0, 0))
    result.alpha_composite(canvas, (0, legend.height))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, optimize=True)
    print(args.output)


if __name__ == "__main__":
    main()
