#!/usr/bin/env python3
"""Generate the Office Tiled map directly from the two CC0 source packs."""

import json
import math
from pathlib import Path

from PIL import Image, ImageOps


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
WORKSTATION_FRONT_EXTENSION = 30 / TILE_SIZE

# Object-layer collision footprints measured at each sprite's floor contact.
# Values are map-source pixels (the rendered map is scaled later by Phaser).
# Full tile collision is deliberately avoided because it over-blocks up to
# 32 px of empty floor around small furniture.
FURNITURE_FOOTPRINTS = {
    "couch_gray": (58, 6),
    "couch_peach": (58, 6),
    "plant": (14, 8),
    "service_counter": (48, 8),
    "bookshelf": (44, 8),
    "water_cooler": (14, 8),
    "bin_green": (14, 8),
    "bin_red": (14, 8),
    "vending_machine": (42, 8),
}


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
    "orange_desk": (85, 47, 111, 63),
    "yellow_desk": (188, 63, 205, 82),
    "chair": (71, 41, 82, 63),
    "computer_wide": (233, 106, 248, 125),
    "computer_thin": (233, 128, 250, 158),
    "terminal": (169, 95, 177, 102),
    "tower": (159, 91, 166, 102),
    "india_flag": (179, 94, 191, 103),
    "uk_flag": (193, 94, 205, 103),
    "us_flag": (207, 94, 219, 103),
    "paper": (183, 105, 191, 116),
    "notes": (217, 106, 224, 116),
    "blue_display": (221, 94, 230, 103),
    "pod5_display_base": (222, 94, 228, 102),
    "outlet": (211, 151, 222, 158),
    "red_drawer": (211, 119, 222, 127),
    "blue_drawer": (211, 129, 222, 138),
    "green_drawer": (211, 140, 222, 149),
    "red_bin": (126, 143, 135, 157),
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

        if name.startswith("workstation_pod_"):
            pod_name = (
                name.removesuffix("_back")
                .removesuffix("_furniture")
                .removesuffix("_front")
            )
            # Rebuild the five cubicle pods demonstrated in the pack example.
            # Human and animal sprites are deliberately excluded from map
            # furniture; only the source furniture/decor pieces are composed.
            partition = scaled(PREFAB_PIECES["partition"])
            desk = scaled(PREFAB_PIECES["yellow_desk"])
            chair = scaled(PREFAB_PIECES["chair"])
            computer_wide = scaled(PREFAB_PIECES["computer_wide"])
            computer_thin = scaled(PREFAB_PIECES["computer_thin"])
            terminal = scaled(PREFAB_PIECES["terminal"])
            outlet = scaled(PREFAB_PIECES["outlet"])
            plant = scaled(SPRITES["plant"])

            pod5_note = Image.new("RGBA", (4, 6))
            pod5_note.putdata(
                [
                    (177, 62, 83, 255),
                    (177, 62, 83, 255),
                    (51, 60, 87, 255),
                    (177, 62, 83, 255),
                    *((255, 205, 117, 255),) * 4,
                    (255, 205, 117, 255),
                    (239, 125, 87, 255),
                    (239, 125, 87, 255),
                    (255, 205, 117, 255),
                    *((255, 205, 117, 255),) * 8,
                    *((148, 176, 194, 255),) * 4,
                ]
            )
            pod5_note = pod5_note.resize((8, 12), Image.Resampling.NEAREST)

            pod5_display = scaled(PREFAB_PIECES["pod5_display_base"])
            display_palette = {
                (115, 239, 247, 255): (167, 240, 112, 255),
                (65, 166, 246, 255): (56, 183, 100, 255),
                (59, 93, 201, 255): (37, 113, 121, 255),
            }
            pod5_display.putdata(
                [display_palette.get(pixel, pixel) for pixel in pod5_display.getdata()]
            )

            back = Image.new("RGBA", (158, 60))
            furniture = Image.new("RGBA", (158, 60))
            back.alpha_composite(partition, (0, 0))

            # Match the example's shared wall: it starts at the rear
            # partition cap and runs between both desks until it meets the
            # foreground partition. Colors come from the pack's wall tiles.
            central_wall = Image.new("RGBA", (8, 60))
            wall_pixels = central_wall.load()
            for wall_y in range(60):
                for wall_x in range(8):
                    if wall_y < 2:
                        color = (148, 176, 194, 255)
                    elif wall_y < 6 or 2 <= wall_x < 6:
                        color = (244, 244, 244, 255)
                    else:
                        color = (86, 108, 134, 255)
                    wall_pixels[wall_x, wall_y] = color

            def left_wide():
                furniture.alpha_composite(chair, (14, 14))
                furniture.alpha_composite(desk, (38, 22))
                furniture.alpha_composite(computer_wide, (40, 12))

            def left_thin(with_terminal=True):
                furniture.alpha_composite(chair, (14, 14))
                furniture.alpha_composite(desk, (38, 22))
                furniture.alpha_composite(computer_thin, (38, 12))
                if with_terminal:
                    furniture.alpha_composite(terminal, (54, 44))

            def right_wide(drawer_name=None):
                furniture.alpha_composite(desk, (80, 22))
                furniture.alpha_composite(
                    ImageOps.mirror(computer_wide),
                    (82, 12),
                )
                if drawer_name:
                    furniture.alpha_composite(
                        scaled(PREFAB_PIECES[drawer_name]),
                        (84, 50),
                    )
                furniture.alpha_composite(ImageOps.mirror(chair), (116, 14))

            def cabinet(drawer_name):
                furniture.alpha_composite(desk, (80, 22))
                furniture.alpha_composite(outlet, (84, 28))
                furniture.alpha_composite(
                    scaled(PREFAB_PIECES[drawer_name]),
                    (84, 42),
                )

            if pod_name == "workstation_pod_1":
                back.alpha_composite(scaled(PREFAB_PIECES["notes"]), (14, 10))
                back.alpha_composite(scaled(PREFAB_PIECES["us_flag"]), (128, 10))
                left_wide()
                cabinet("red_drawer")
            elif pod_name == "workstation_pod_2":
                back.alpha_composite(scaled(PREFAB_PIECES["india_flag"]), (8, 10))
                back.alpha_composite(scaled(PREFAB_PIECES["paper"]), (134, 10))
                left_thin()
                right_wide("green_drawer")
            elif pod_name == "workstation_pod_3":
                back.alpha_composite(scaled(PREFAB_PIECES["blue_display"]), (8, 10))
                back.alpha_composite(scaled(PREFAB_PIECES["paper"]), (134, 10))
                left_thin(with_terminal=False)
                right_wide("green_drawer")
            elif pod_name == "workstation_pod_4":
                back.alpha_composite(scaled(PREFAB_PIECES["uk_flag"]), (8, 10))
                back.alpha_composite(scaled(PREFAB_PIECES["notes"]), (134, 10))
                left_thin(with_terminal=False)
                furniture.alpha_composite(desk, (80, 22))
                furniture.alpha_composite(
                    scaled(PREFAB_PIECES["blue_drawer"]),
                    (84, 42),
                )
                furniture.alpha_composite(
                    scaled(PREFAB_PIECES["red_bin"]),
                    (126, 38),
                )
            elif pod_name == "workstation_pod_5":
                back.alpha_composite(scaled(PREFAB_PIECES["notes"]), (14, 10))
                back.alpha_composite(pod5_note, (126, 10))
                back.alpha_composite(pod5_display, (138, 10))
                left_wide()
                cabinet("red_drawer")
            else:
                raise ValueError(f"unknown workstation pod: {name}")

            furniture.alpha_composite(central_wall, (72, 0))
            # In the pack example the following cubicle row masks the desks'
            # unsupported lower edge. Standalone map pods need their own
            # foreground partition to preserve the same depth cue.
            pod = Image.new("RGBA", (158, 110))
            pod.alpha_composite(back, (0, 0))
            pod.alpha_composite(furniture, (0, 0))
            pod.alpha_composite(partition, (0, 60))
            plant_x = 122 if pod_name in {
                "workstation_pod_1",
                "workstation_pod_3",
                "workstation_pod_5",
            } else 8
            if name.endswith("_back"):
                return back
            if name.endswith("_furniture"):
                return furniture
            if name.endswith("_front"):
                return pod.crop((0, 60, 158, 110))
            pod.alpha_composite(plant, (plant_x, 72))
            return pod

        if name == "service_counter":
            desk = scaled(PREFAB_PIECES["orange_desk"])
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
                # The plant extends into the prefab's final tile row, but it
                # must not turn the visible aisle in front of the partition
                # into a full-width collision wall. Keep the blocking edge on
                # the partition's inner row so players can walk past its face.
                collision_row = grid_height - 2
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
                # A workstation is one connected object. Splitting its upper
                # chunks onto the fixed above-player layer makes the partition
                # cover a player who is standing in the aisle in front.
                "render_below_player": name.startswith("workstation_"),
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
    visual_layer=None,
) -> None:
    height = definition["height"]
    visual_bottom_layer = decoration_2 if decorative else decoration_1

    for row, tile_row in enumerate(definition["tile_ids"]):
        for column, tile_id in enumerate(tile_row):
            if tile_id is None:
                continue
            gid = OFFICE_FIRST_GID + tile_id
            if visual_layer is not None:
                target = visual_layer
            else:
                target = (
                    visual_bottom_layer
                    if definition["render_below_player"] or row == height - 1
                    else above_0
                )
            set_tile(target, x + column, y + row, gid)

    if collides:
        for collision_row, column in definition["collision_cells"]:
            set_tile(
                decoration_0,
                x + column,
                y + collision_row,
                OFFICE_FIRST_GID,
            )


def make_tile_layer(
    layer_id: int,
    name: str,
    data: list[int],
    depth=None,
    depth_y=None,
):
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
    if depth_y is not None:
        layer["properties"] = [
            {"name": "depthY", "type": "int", "value": depth_y}
        ]
    return layer


def build_map(atlas: OfficeAtlas) -> dict:
    ground = empty_layer()
    decoration_0 = empty_layer()
    decoration_1 = empty_layer()
    decoration_2 = empty_layer()
    above_0 = empty_layer()
    above_1 = empty_layer()
    dynamic_depth_layers: list[tuple[str, list[int], int]] = []
    furniture_colliders = []

    floor_columns = {
        (0, 0): 9,
        (1, 0): 4,
        (0, 1): 6,
        (1, 1): 5,
    }
    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            quadrant = (0 if x < 16 else 1, 0 if y < 12 else 1)
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
    horizontal_partition = empty_layer()
    for x in range(MAP_WIDTH):
        if x in north_south_passages:
            continue
        set_tile(horizontal_partition, x, 11, wall_top)
        set_tile(decoration_0, x, 11, collision_mask)
        set_tile(decoration_0, x, 12, wall_face)
    dynamic_depth_layers.append(
        ("partition_horizontal", horizontal_partition, 12 * TILE_SIZE)
    )

    # Vertical partition; two 2-tile passages connect east and west.
    east_west_passages = {6, 7, 16, 17}
    for y in range(2, MAP_HEIGHT):
        if y in east_west_passages:
            continue
        vertical_partition = empty_layer()
        set_tile(vertical_partition, 15, y, wall_top)
        set_tile(decoration_0, 15, y, collision_mask)
        set_tile(decoration_0, 16, y, wall_face)
        dynamic_depth_layers.append(
            (
                f"partition_vertical_{y}",
                vertical_partition,
                (y + 1) * TILE_SIZE,
            )
        )

    def place_at(name, tile_x, tile_y, visual_layer=None, **kwargs):
        # Build tile chunks with transparent in-tile offsets so the approved
        # sample's bottom-center anchor survives the Tiled grid exactly.
        definition, x, y = atlas.definition_at(name, tile_x, tile_y)
        collides = kwargs.pop("collides", True)
        instance_name = None
        if collides and visual_layer is None:
            instance_name = f"{name}_{len(furniture_colliders) + 1}"
            visual_layer = empty_layer()
        place_sprite(
            definition,
            x,
            y,
            decoration_0,
            decoration_1,
            decoration_2,
            above_0,
            visual_layer=visual_layer,
            # Furniture uses precise object rectangles below. Tile collision
            # is retained only for architectural walls.
            collides=False,
            **kwargs,
        )
        if collides:
            width, height = FURNITURE_FOOTPRINTS[name]
            center_x = tile_x * TILE_SIZE
            bottom_y = tile_y * TILE_SIZE
            if instance_name is None:
                raise ValueError(f"missing depth-sorted instance name: {name}")
            furniture_colliders.append(
                (
                    instance_name,
                    round(center_x - width / 2),
                    round(bottom_y - height),
                    width,
                    height,
                )
            )
            dynamic_depth_layers.append(
                (f"floor_{instance_name}", visual_layer, round(bottom_y))
            )

    workstation_pods = (
        ("workstation_pod_1", 20.5, 4.5 + WORKSTATION_FRONT_EXTENSION),
        ("workstation_pod_2", 28.5, 4.5 + WORKSTATION_FRONT_EXTENSION),
        ("workstation_pod_3", 20.5, 9.0 + WORKSTATION_FRONT_EXTENSION),
        ("workstation_pod_4", 28.5, 9.0 + WORKSTATION_FRONT_EXTENSION),
        ("workstation_pod_5", 7.5, 16.5 + 55 / TILE_SIZE),
    )

    def place_workstation(name: str, tile_x: float, tile_y: float) -> None:
        # A pod needs independent Y-sorted planes for the back partition,
        # furniture, front partition, and plant. This keeps the back wall from
        # covering a player whose feet have already passed its lower edge.
        pod_top = round(tile_y * TILE_SIZE - 110)
        back_layer = empty_layer()
        furniture_layer = empty_layer()
        front_layer = empty_layer()
        plant_layer = empty_layer()
        back_sort_y = pod_top + 34
        furniture_sort_y = pod_top + 60
        front_sort_y = pod_top + 94
        place_at(
            f"{name}_back",
            tile_x,
            (pod_top + 60) / TILE_SIZE,
            visual_layer=back_layer,
            collides=False,
        )
        place_at(
            f"{name}_furniture",
            tile_x,
            (pod_top + 60) / TILE_SIZE,
            visual_layer=furniture_layer,
            collides=False,
        )
        place_at(
            f"{name}_front",
            tile_x,
            tile_y,
            visual_layer=front_layer,
            collides=False,
        )
        plant_x = 122 if name in {
            "workstation_pod_1",
            "workstation_pod_3",
            "workstation_pod_5",
        } else 8
        pod_left = round(tile_x * TILE_SIZE - 158 / 2)
        place_at(
            "plant",
            (pod_left + plant_x + 14) / TILE_SIZE,
            (pod_top + 110) / TILE_SIZE,
            visual_layer=plant_layer,
            collides=False,
        )
        dynamic_depth_layers.extend(
            (
                (f"{name}_back", back_layer, back_sort_y),
                (f"{name}_furniture", furniture_layer, furniture_sort_y),
                (f"{name}_front", front_layer, front_sort_y),
                (f"{name}_plant", plant_layer, pod_top + 110),
            )
        )

        # The desks, chairs, center divider, and both horizontal partitions
        # form one inaccessible workstation island. Separate thin rectangles
        # left side entrances between them, so a player's foot body could
        # enter the pod and visually walk through chairs/partitions. Block the
        # complete occupied footprint while keeping every surrounding aisle
        # available.
        furniture_colliders.append(
            (f"{name}_footprint", pod_left, pod_top, 158, 94)
        )
        plant_width, plant_height = FURNITURE_FOOTPRINTS["plant"]
        plant_center_x = pod_left + plant_x + 14
        plant_bottom_y = pod_top + 110
        furniture_colliders.append(
            (
                f"{name}_front_plant",
                round(plant_center_x - plant_width / 2),
                plant_bottom_y - plant_height,
                plant_width,
                plant_height,
            )
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

    # Open workspace: four source-example pods form a balanced 2x2 bank while
    # keeping the room's west passage and center aisle clear.
    place_at("clock", 27.8, 1.7, collides=False)
    for name, x, y in workstation_pods[:4]:
        place_workstation(name, x, y)

    # Focus room: the final pod stands alone, without the person or animal
    # sprites visible in the pack's sample scene.
    for name, x, y in workstation_pods[4:]:
        place_workstation(name, x, y)
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

    # Navigation audit anchors cover every room, doorway, and tight office
    # aisle. Tests inflate all collision geometry by the player's foot body
    # and require every point to remain connected to spawn.
    navigation_checks = (
        ("spawn", 240, 240),
        ("reception", 160, 240),
        ("upper-west-door", 512, 224),
        ("open-row-aisle-left", 620, 184),
        ("open-row-aisle-right", 900, 184),
        ("open-column-aisle", 784, 240),
        ("north-south-west", 240, 384),
        ("focus-room", 96, 512),
        ("lower-west-door", 512, 528),
        ("north-south-east", 752, 384),
        ("lounge", 800, 544),
    )
    navigation_corridors = (
        ("open-between-rows", 577, 174, 414, 34, "horizontal", 32),
        ("open-below-desks", 577, 318, 414, 34, "horizontal", 32),
        ("open-between-columns", 735, 64, 98, 288, "vertical", 48),
        ("open-west-side", 544, 64, 33, 288, "vertical", 32),
        ("focus-front", 161, 583, 158, 64, "horizontal", 48),
        # Visible floor gap between the reception counter and bookshelf.
        ("reception-counter-bookshelf-gap", 398, 64, 31, 160, "vertical", 24),
    )

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
            *[
                make_tile_layer(
                    10 + index,
                    name,
                    data,
                    depth_y=depth_y,
                )
                for index, (name, data, depth_y) in enumerate(
                    dynamic_depth_layers
                )
            ],
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
                        "width": width * TILE_SIZE,
                        "height": height * TILE_SIZE,
                    }
                    for index, (name, x, y, width, height) in enumerate(
                        (
                            ("Reception", 0, 0, 16, 12),
                            ("Open Workspace", 16, 0, 16, 12),
                            ("Focus Room", 0, 12, 16, 10),
                            ("Lounge", 16, 12, 16, 10),
                        )
                    )
                ],
                "x": 0,
                "y": 0,
            },
            {
                "id": 9,
                "name": "furniture",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": True,
                "objects": [
                    {
                        "id": index + 6,
                        "name": name,
                        "point": True,
                        "rotation": 0,
                        "type": "furniture",
                        "visible": True,
                        "x": x * TILE_SIZE,
                        "y": y * TILE_SIZE,
                        "properties": [
                            {
                                "name": "frontPartition",
                                "type": "bool",
                                "value": True,
                            },
                            {
                                "name": "frontPlant",
                                "type": "bool",
                                "value": True,
                            },
                            {
                                "name": "centralWallStartPx",
                                "type": "int",
                                "value": 0,
                            },
                            {
                                "name": "centralWallEndPx",
                                "type": "int",
                                "value": 60,
                            },
                            *(
                                [
                                    {
                                        "name": "wallDecor",
                                        "type": "string",
                                        "value": "example-note-and-green-display",
                                    }
                                ]
                                if name == "workstation_pod_5"
                                else []
                            ),
                        ],
                    }
                    for index, (name, x, y) in enumerate(workstation_pods)
                ],
                "x": 0,
                "y": 0,
            },
            {
                "id": 30,
                "name": "furniture_colliders",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": True,
                "objects": [
                    {
                        "id": index + 11,
                        "name": name,
                        "rotation": 0,
                        "type": "furniture-collider",
                        "visible": True,
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height,
                    }
                    for index, (name, x, y, width, height) in enumerate(
                        furniture_colliders
                    )
                ],
                "x": 0,
                "y": 0,
            },
            {
                "id": 31,
                "name": "navigation_checks",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": False,
                "objects": [
                    {
                        "id": index + 43,
                        "name": name,
                        "point": True,
                        "rotation": 0,
                        "type": "navigation-check",
                        "visible": True,
                        "x": x,
                        "y": y,
                    }
                    for index, (name, x, y) in enumerate(navigation_checks)
                ],
                "x": 0,
                "y": 0,
            },
            {
                "id": 32,
                "name": "navigation_corridors",
                "type": "objectgroup",
                "draworder": "topdown",
                "opacity": 1,
                "visible": False,
                "objects": [
                    {
                        "id": index + 54,
                        "name": name,
                        "rotation": 0,
                        "type": "navigation-corridor",
                        "visible": True,
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height,
                        "properties": [
                            {
                                "name": "axis",
                                "type": "string",
                                "value": axis,
                            },
                            {
                                "name": "minClearance",
                                "type": "int",
                                "value": min_clearance,
                            },
                        ],
                    }
                    for index, (
                        name,
                        x,
                        y,
                        width,
                        height,
                        axis,
                        min_clearance,
                    ) in enumerate(navigation_corridors)
                ],
                "x": 0,
                "y": 0,
            },
        ],
        "nextlayerid": 33,
        "nextobjectid": 60,
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
