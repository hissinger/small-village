#!/usr/bin/env python3
"""Generate the Office Tiled map directly from the two CC0 source packs."""

import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TILESET_DIR = ROOT / "public" / "assets" / "tilesets"
TILEMAP_DIR = ROOT / "public" / "assets" / "tilemaps"
TINY_SOURCE = TILESET_DIR / "source" / "Tiny_Top_Down_32x32.png"
OFFICE_SOURCE = TILESET_DIR / "source" / "PixelOfficeAssets.png"
OFFICE_TILESET = TILESET_DIR / "Office_Furniture_32x32.png"
OFFICE_MAP = TILEMAP_DIR / "office.json"

TILE_SIZE = 32
MAP_WIDTH = 32
MAP_HEIGHT = 22
TINY_COLUMNS = 10
TINY_FIRST_GID = 1
OFFICE_FIRST_GID = 101
ATLAS_COLUMNS = 16


SPRITES = {
    "vending_machine": (159, 123, 183, 157),
    "bookshelf": (184, 126, 208, 157),
    "plant": (170, 65, 184, 84),
    "long_desk": (115, 47, 155, 63),
    "short_desk": (85, 47, 111, 63),
    "couch_gray": (119, 66, 152, 81),
    "couch_blue": (120, 83, 153, 99),
    "couch_green": (120, 102, 153, 118),
    "couch_peach": (120, 121, 153, 137),
    "chair": (6, 41, 17, 63),
    "cat": (59, 146, 83, 157),
    "calendar": (234, 81, 251, 92),
    "clock": (159, 108, 178, 114),
    "uk_flag": (193, 94, 205, 103),
    "us_flag": (207, 94, 219, 103),
    "water_cooler": (147, 140, 156, 157),
    "bin_green": (116, 143, 125, 157),
    "bin_red": (126, 143, 135, 157),
    "bin_blue": (136, 143, 145, 157),
}

PREFAB_PIECES = {
    "partition": (171, 44, 250, 61),
    "desk": (85, 47, 111, 63),
    "chair": (71, 41, 82, 63),
    "computer": (233, 106, 248, 125),
    "terminal": (169, 95, 177, 102),
    "tower": (159, 91, 166, 102),
}


def tiny_gid(column: int, row: int) -> int:
    return TINY_FIRST_GID + row * TINY_COLUMNS + column


def empty_layer() -> list[int]:
    return [0] * (MAP_WIDTH * MAP_HEIGHT)


def set_tile(layer: list[int], x: int, y: int, gid: int) -> None:
    if not (0 <= x < MAP_WIDTH and 0 <= y < MAP_HEIGHT):
        raise ValueError(f"tile outside map: ({x}, {y})")
    layer[y * MAP_WIDTH + x] = gid


class OfficeAtlas:
    """Build grid tiles from source sprites while preserving sample anchors."""

    def __init__(self, source: Image.Image):
        self.source = source
        # Tile 0 is transparent and used only as a collision mask.
        self.tiles = [Image.new("RGBA", (TILE_SIZE, TILE_SIZE))]
        self.definitions = {}

    def sprite(self, name: str) -> Image.Image:
        def scaled(box):
            item = self.source.crop(box)
            return item.resize(
                (item.width * 2, item.height * 2),
                Image.Resampling.NEAREST,
            )

        if name in SPRITES:
            return scaled(SPRITES[name])

        if name in {"workstation_left", "workstation_right"}:
            # Pixel Office is a scene-asset pack, not a directional tileset.
            # Preserve the source perspective and reproduce its demonstrated
            # cubicle composition instead of rotating individual pieces.
            partition = scaled(PREFAB_PIECES["partition"])
            desk = scaled(PREFAB_PIECES["desk"])
            chair = scaled(PREFAB_PIECES["chair"])
            computer = scaled(PREFAB_PIECES["computer"])
            workstation = Image.new("RGBA", (158, 60))
            workstation.alpha_composite(partition, (0, 0))
            if name == "workstation_left":
                chair_x, desk_x, computer_x = 14, 44, 44
            else:
                # Keep the same chair-to-desk direction and shift the complete
                # arrangement right within the partition. The source pack has
                # no opposite-facing chair, so mirroring it would be invalid.
                chair_x, desk_x, computer_x = 76, 104, 104
            workstation.alpha_composite(chair, (chair_x, 14))
            workstation.alpha_composite(desk, (desk_x, 28))
            workstation.alpha_composite(computer, (computer_x, 8))
            return workstation

        if name == "service_counter":
            desk = scaled(PREFAB_PIECES["desk"])
            terminal = scaled(PREFAB_PIECES["terminal"])
            tower = scaled(PREFAB_PIECES["tower"])
            counter = Image.new("RGBA", (52, 42))
            counter.alpha_composite(desk, (0, 10))
            counter.alpha_composite(terminal, (4, 4))
            counter.alpha_composite(tower, (34, 0))
            return counter

        raise ValueError(f"unknown office sprite or prefab: {name}")

    def definition_at(self, name: str, tile_x: float, tile_y: float):
        crop = self.sprite(name)

        pixel_x = round(tile_x * TILE_SIZE - crop.width / 2)
        pixel_y = round(tile_y * TILE_SIZE - crop.height)
        grid_x = math.floor(pixel_x / TILE_SIZE)
        grid_y = math.floor(pixel_y / TILE_SIZE)
        offset_x = pixel_x - grid_x * TILE_SIZE
        offset_y = pixel_y - grid_y * TILE_SIZE
        key = (name, offset_x, offset_y)

        if key not in self.definitions:
            grid_width = math.ceil((offset_x + crop.width) / TILE_SIZE)
            grid_height = math.ceil((offset_y + crop.height) / TILE_SIZE)
            padded = Image.new(
                "RGBA",
                (grid_width * TILE_SIZE, grid_height * TILE_SIZE),
            )
            padded.alpha_composite(crop, (offset_x, offset_y))

            tile_ids: list[list[int | None]] = []
            for row in range(grid_height):
                tile_row: list[int | None] = []
                for column in range(grid_width):
                    chunk = padded.crop(
                        (
                            column * TILE_SIZE,
                            row * TILE_SIZE,
                            (column + 1) * TILE_SIZE,
                            (row + 1) * TILE_SIZE,
                        )
                    )
                    if chunk.getbbox() is None:
                        tile_row.append(None)
                        continue
                    tile_row.append(len(self.tiles))
                    self.tiles.append(chunk)
                tile_ids.append(tile_row)

            if name.startswith("workstation_"):
                collision_row = grid_height - 1
                collision_cells = [
                    (collision_row, column)
                    for column in range(grid_width)
                ]
            else:
                collision_cells = [
                    (grid_height - 1, column)
                    for column, tile_id in enumerate(tile_ids[-1])
                    if tile_id is not None
                ]

            self.definitions[key] = {
                "width": grid_width,
                "height": grid_height,
                "tile_ids": tile_ids,
                # The chair is visual overlap; only the desk edge blocks feet.
                "collision_cells": collision_cells,
            }

        return self.definitions[key], grid_x, grid_y

    def save(self):
        rows = math.ceil(len(self.tiles) / ATLAS_COLUMNS)
        atlas = Image.new(
            "RGBA",
            (ATLAS_COLUMNS * TILE_SIZE, rows * TILE_SIZE),
        )
        for tile_id, tile in enumerate(self.tiles):
            atlas.alpha_composite(
                tile,
                (
                    (tile_id % ATLAS_COLUMNS) * TILE_SIZE,
                    (tile_id // ATLAS_COLUMNS) * TILE_SIZE,
                ),
            )
        OFFICE_TILESET.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(OFFICE_TILESET, optimize=True)
        return len(self.tiles), atlas.size


def place_sprite(
    definition,
    x: int,
    y: int,
    decoration_0: list[int],
    decoration_1: list[int],
    decoration_2: list[int],
    above_0: list[int],
    *,
    decorative: bool = False,
    collides: bool = True,
) -> None:
    height = definition["height"]
    visual_bottom_layer = decoration_2 if decorative else decoration_1

    for row, tile_row in enumerate(definition["tile_ids"]):
        for column, tile_id in enumerate(tile_row):
            if tile_id is None:
                continue
            gid = OFFICE_FIRST_GID + tile_id
            target = visual_bottom_layer if row == height - 1 else above_0
            set_tile(target, x + column, y + row, gid)

    if collides:
        for collision_row, column in definition["collision_cells"]:
            set_tile(
                decoration_0,
                x + column,
                y + collision_row,
                OFFICE_FIRST_GID,
            )


def make_tile_layer(layer_id: int, name: str, data: list[int], depth=None):
    layer = {
        "id": layer_id,
        "name": name,
        "type": "tilelayer",
        "width": MAP_WIDTH,
        "height": MAP_HEIGHT,
        "x": 0,
        "y": 0,
        "opacity": 1,
        "visible": True,
        "data": data,
    }
    if depth is not None:
        layer["properties"] = [
            {"name": "depth", "type": "int", "value": depth}
        ]
    return layer


def build_map(atlas: OfficeAtlas) -> dict:
    ground = empty_layer()
    decoration_0 = empty_layer()
    decoration_1 = empty_layer()
    decoration_2 = empty_layer()
    above_0 = empty_layer()
    above_1 = empty_layer()

    floor_columns = {
        (0, 0): 9,
        (1, 0): 4,
        (0, 1): 6,
        (1, 1): 5,
    }
    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            quadrant = (0 if x < 16 else 1, 0 if y < 11 else 1)
            set_tile(ground, x, y, tiny_gid(floor_columns[quadrant], 5))

    wall_top = tiny_gid(9, 0)
    wall_face = tiny_gid(9, 1)
    door = tiny_gid(9, 9)
    collision_mask = OFFICE_FIRST_GID

    # Top exterior wall.
    for x in range(MAP_WIDTH):
        set_tile(above_1, x, 0, wall_top)
        set_tile(decoration_0, x, 0, collision_mask)
        set_tile(decoration_0, x, 1, wall_face)
    for x in (7, 23):
        set_tile(decoration_0, x, 1, door)

    # Horizontal partition; two 2-tile passages connect north and south.
    north_south_passages = {7, 8, 23, 24}
    for x in range(MAP_WIDTH):
        if x in north_south_passages:
            continue
        set_tile(above_0, x, 10, wall_top)
        set_tile(decoration_0, x, 10, collision_mask)
        set_tile(decoration_0, x, 11, wall_face)

    # Vertical partition; two 2-tile passages connect east and west.
    east_west_passages = {6, 7, 16, 17}
    for y in range(2, MAP_HEIGHT):
        if y in east_west_passages:
            continue
        set_tile(above_0, 15, y, wall_top)
        set_tile(decoration_0, 15, y, collision_mask)
        set_tile(decoration_0, 16, y, wall_face)

    def place_at(name, tile_x, tile_y, **kwargs):
        # Build tile chunks with transparent in-tile offsets so the approved
        # sample's bottom-center anchor survives the Tiled grid exactly.
        definition, x, y = atlas.definition_at(name, tile_x, tile_y)
        place_sprite(
            definition,
            x,
            y,
            decoration_0,
            decoration_1,
            decoration_2,
            above_0,
            **kwargs,
        )

    # Reception and waiting area. All front-facing furniture backs onto a
    # wall; the entrance axis at x=7..8 remains open to the internal passage.
    place_at("couch_peach", 3.8, 4.1)
    place_at("plant", 5.7, 4.1, decorative=True)
    place_at("clock", 3.8, 1.7, collides=False)
    place_at("calendar", 12.0, 1.85, collides=False)
    place_at("service_counter", 11.7, 5.0)
    place_at("bookshelf", 14.1, 5.0)
    place_at("water_cooler", 1.5, 8.8)
    place_at("bin_green", 10.3, 5.0, decorative=True)

    # Open workspace: validated left/right cubicle modules repeat in two
    # perimeter banks. Their source perspective is never rotated, and a
    # four-tile center aisle connects the exterior and internal doors.
    place_at("clock", 27.8, 1.7, collides=False)
    for y in (5.0, 9.0):
        place_at("workstation_left", 19.5, y)
        place_at("workstation_right", 28.5, y)
    place_at("bin_blue", 22.0, 9.1, decorative=True)
    place_at("plant", 25.5, 9.1, decorative=True)

    # Focus room. The pack has no perspective-correct conference set, so this
    # room uses two quiet cubicles instead of fabricated rotated chairs.
    place_at("calendar", 3.8, 11.85, collides=False)
    place_at("clock", 12.2, 11.7, collides=False)
    place_at("workstation_left", 4.0, 14.8)
    place_at("workstation_right", 11.5, 14.8)
    place_at("bookshelf", 1.5, 20.5)
    place_at("plant", 13.8, 20.3, decorative=True)
    place_at("bin_red", 11.8, 20.5, decorative=True)

    # Lounge and refreshment corner. Service appliances share the left wall;
    # the sofa backs onto the upper wall with clear usable space in front.
    place_at("calendar", 18.5, 11.85, collides=False)
    place_at("clock", 28.0, 11.7, collides=False)
    place_at("vending_machine", 18.0, 14.4)
    place_at("water_cooler", 20.2, 14.2)
    place_at("bin_green", 21.8, 14.2, decorative=True)
    place_at("couch_gray", 27.5, 14.0)
    place_at("plant", 30.1, 14.0, decorative=True)
    place_at("cat", 27.5, 18.5, decorative=True, collides=False)

    office_tile_count, atlas_size = atlas.save()
    atlas_width, atlas_height = atlas_size
    return {
        "compressionlevel": -1,
        "height": MAP_HEIGHT,
        "infinite": False,
        "layers": [
            make_tile_layer(1, "ground", ground),
            make_tile_layer(2, "decoration_0", decoration_0),
            make_tile_layer(3, "decoration_1", decoration_1),
            make_tile_layer(4, "decoration_2", decoration_2),
            make_tile_layer(5, "above_0", above_0, 10),
            make_tile_layer(6, "above_1", above_1, 11),
            {
                "id": 7,
                "name": "spawn",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": True,
                "objects": [
                    {
                        "id": 1,
                        "name": "spawn",
                        "point": True,
                        "rotation": 0,
                        "type": "",
                        "visible": True,
                        "x": 7.5 * TILE_SIZE,
                        "y": 7.5 * TILE_SIZE,
                    }
                ],
                "x": 0,
                "y": 0,
            },
            {
                "id": 8,
                "name": "zones",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": True,
                "objects": [
                    {
                        "id": index + 2,
                        "name": name,
                        "rotation": 0,
                        "type": "office-zone",
                        "visible": True,
                        "x": x * TILE_SIZE,
                        "y": y * TILE_SIZE,
                        "width": 16 * TILE_SIZE,
                        "height": 11 * TILE_SIZE,
                    }
                    for index, (name, x, y) in enumerate(
                        (
                            ("Reception", 0, 0),
                            ("Open Workspace", 16, 0),
                            ("Focus Room", 0, 11),
                            ("Lounge", 16, 11),
                        )
                    )
                ],
                "x": 0,
                "y": 0,
            },
        ],
        "nextlayerid": 9,
        "nextobjectid": 6,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.11.0",
        "tileheight": TILE_SIZE,
        "tilewidth": TILE_SIZE,
        "tilesets": [
            {
                "columns": TINY_COLUMNS,
                "firstgid": TINY_FIRST_GID,
                "image": "../tilesets/source/Tiny_Top_Down_32x32.png",
                "imageheight": 320,
                "imagewidth": 320,
                "margin": 0,
                "name": "Tiny_Top_Down_32x32",
                "spacing": 0,
                "tilecount": 100,
                "tileheight": TILE_SIZE,
                "tilewidth": TILE_SIZE,
                "tiles": [
                    {
                        "id": tile_id,
                        "properties": [
                            {"name": "collides", "type": "bool", "value": True}
                        ],
                    }
                    for tile_id in (9, 19)
                ],
            },
            {
                "columns": ATLAS_COLUMNS,
                "firstgid": OFFICE_FIRST_GID,
                "image": "../tilesets/Office_Furniture_32x32.png",
                "imageheight": atlas_height,
                "imagewidth": atlas_width,
                "margin": 0,
                "name": "Office_Furniture_32x32",
                "spacing": 0,
                "tilecount": office_tile_count,
                "tileheight": TILE_SIZE,
                "tilewidth": TILE_SIZE,
                "tiles": [
                    {
                        "id": 0,
                        "properties": [
                            {"name": "collides", "type": "bool", "value": True}
                        ],
                    }
                ],
            },
        ],
        "type": "map",
        "version": "1.10",
        "width": MAP_WIDTH,
    }


def main() -> None:
    tiny = Image.open(TINY_SOURCE)
    if tiny.size != (320, 320):
        raise ValueError(f"unexpected Tiny Top Down size: {tiny.size}")
    source = Image.open(OFFICE_SOURCE).convert("RGBA")
    office_map = build_map(OfficeAtlas(source))
    OFFICE_MAP.parent.mkdir(parents=True, exist_ok=True)
    OFFICE_MAP.write_text(
        json.dumps(office_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OFFICE_TILESET)
    print(OFFICE_MAP)


if __name__ == "__main__":
    main()
