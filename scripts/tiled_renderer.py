#!/usr/bin/env python3
"""Shared Tiled JSON compositor used by lobby previews and map audits."""

import base64
import json
import struct
from pathlib import Path

from PIL import Image


FLIPPED_HORIZONTALLY = 0x80000000
FLIPPED_VERTICALLY = 0x40000000
FLIPPED_DIAGONALLY = 0x20000000
GID_MASK = 0x1FFFFFFF


def properties(item):
    return {entry["name"]: entry["value"] for entry in item.get("properties", [])}


def layer_data(layer):
    data = layer["data"]
    if isinstance(data, list):
        return data
    decoded = base64.b64decode(data)
    return [value[0] for value in struct.iter_unpack("<I", decoded)]


def _load_tilesets(map_path, tilemap):
    loaded = []
    for tileset in tilemap["tilesets"]:
        image_path = (map_path.parent / tileset["image"]).resolve()
        image = Image.open(image_path).convert("RGBA") if image_path.exists() else None
        loaded.append((tileset["firstgid"], tileset, image_path, image))
    return loaded


def _transform_tile(tile, raw_gid):
    transpose = Image.Transpose
    if raw_gid & FLIPPED_DIAGONALLY:
        tile = tile.transpose(transpose.TRANSPOSE)
    if raw_gid & FLIPPED_HORIZONTALLY:
        tile = tile.transpose(transpose.FLIP_LEFT_RIGHT)
    if raw_gid & FLIPPED_VERTICALLY:
        tile = tile.transpose(transpose.FLIP_TOP_BOTTOM)
    return tile


def _tile_image(raw_gid, loaded_tilesets, tile_width, tile_height):
    gid = raw_gid & GID_MASK
    if gid == 0:
        return None
    candidates = [entry for entry in loaded_tilesets if entry[0] <= gid]
    if not candidates:
        raise ValueError(f"tile GID {gid} has no matching tileset")

    firstgid, tileset, image_path, source = max(
        candidates, key=lambda entry: entry[0]
    )
    local_id = gid - firstgid
    tile_count = int(tileset["tilecount"])
    if local_id >= tile_count:
        raise ValueError(
            f"tile GID {gid} exceeds tileset '{tileset['name']}' ({tile_count} tiles)"
        )
    if source is None:
        raise FileNotFoundError(
            f"tileset '{tileset['name']}' is used but its image is missing: {image_path}"
        )

    column = local_id % tileset["columns"]
    row = local_id // tileset["columns"]
    x = column * tile_width
    y = row * tile_height
    if x + tile_width > source.width or y + tile_height > source.height:
        raise ValueError(
            f"tile GID {gid} is outside tileset image '{tileset['name']}'"
        )
    tile = source.crop((x, y, x + tile_width, y + tile_height))
    return _transform_tile(tile, raw_gid)


def _layer_depth(layer, canvas_height):
    if layer["name"] == "above_0":
        return 10
    if layer["name"] == "above_1":
        return 11
    depth_y = properties(layer).get("depthY")
    return 1 + float(depth_y) / canvas_height if depth_y is not None else 0


def render_tilemap(map_path):
    """Return parsed map data and a runtime-depth-ordered RGBA composition."""
    map_path = Path(map_path)
    tilemap = json.loads(map_path.read_text())
    tile_width = tilemap["tilewidth"]
    tile_height = tilemap["tileheight"]
    canvas = Image.new(
        "RGBA",
        (tilemap["width"] * tile_width, tilemap["height"] * tile_height),
        (0, 0, 0, 0),
    )
    loaded_tilesets = _load_tilesets(map_path, tilemap)
    layers = [layer for layer in tilemap["layers"] if layer["type"] == "tilelayer"]
    layers.sort(key=lambda layer: _layer_depth(layer, canvas.height))

    for layer in layers:
        data = layer_data(layer)
        expected_size = layer["width"] * layer["height"]
        if len(data) != expected_size:
            raise ValueError(
                f"layer '{layer['name']}' has {len(data)} tiles; expected {expected_size}"
            )
        for index, raw_gid in enumerate(data):
            tile = _tile_image(
                raw_gid, loaded_tilesets, tile_width, tile_height
            )
            if tile is None:
                continue
            canvas.alpha_composite(
                tile,
                (
                    (index % layer["width"]) * tile_width,
                    (index // layer["width"]) * tile_height,
                ),
            )

    return tilemap, canvas
