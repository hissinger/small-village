#!/usr/bin/env python3
"""Build the Village world from the Tiled map and the licensed Tiny RPG Town artwork.

입력은 세 가지다.
  scripts/assets/village.tmj   Tiled 맵 — 어느 칸에 어느 타일이 놓였나 (커밋됨)
  scripts/assets/village.tsx   타일셋 — 타일마다 팩의 어디서 왔나 · 무엇인가 · 어디가
                               막히나 (커밋됨, 그림 없음)
  tiny-rpg-town-files/         라이선스 원본과 거기서 구운 아틀라스 (로컬에만 둔다)

충돌은 **타일에 적혀 있다.** 예전에는 "팩의 이 영역은 벽/줄기/물" 이라는 좌표 표로
배치 결과에서 매번 추정했는데, 표에서 빠진 그림이 조용히 안 막히는 사고가 났다
(박공집 아래층으로 걸어 들어갈 수 있었다). 이제는 Tiled 에서 조각을 보고 상자를 그리면
그게 그대로 맵의 충돌이 된다.

Outputs
  public/assets/village-bg.png        모든 레이어를 합친 배경
  public/assets/village-above.png     above_* 레이어 — 늘 캐릭터 위(지붕·수관)
  public/assets/village-sorted.png    sorted_* 레이어 — 발치(depthY)로 캐릭터와 Y 정렬
  public/assets/tilemaps/village.json 씬이 읽는 Tiled 형식 월드 데이터

팩은 16px 타일이고 씬은 32px 로 그린다. 그래서 1x(352x288)로 합성한 뒤 정수 2배로
확대한다 — 픽셀아트를 비정수 배율로 늘리면 색이 번진다(예전 소스가 68색 팩에서
139,369색까지 번져 있었다).
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from typing import NamedTuple

import numpy as np
from PIL import Image
from scipy import ndimage

from village_layout import CELL, fit_colliders

ROOT = Path(__file__).resolve().parents[1]
TILEMAP_SOURCE = ROOT / "scripts/assets/village.tmj"
TILESET_SOURCE = ROOT / "scripts/assets/village.tsx"
BACKGROUND = ROOT / "public/assets/village-bg.png"
OVERLAY = ROOT / "public/assets/village-above.png"
SORTED = ROOT / "public/assets/village-sorted.png"
TILEMAP = ROOT / "public/assets/tilemaps/village.json"

SCALE = 2
TILE = 32  # 확대 후 타일 크기 (팩은 16px)
CREDIT = "Tiny RPG Town — artwork by Luis Zuno (@ansimuz), GameDev Market Pro Licence"
PACK_SOURCE = "tiny-rpg-town-files/tileset/tileset.png"


def scale_named(rects: list[list]) -> list[tuple]:
    """[name, x, y, w, h] 목록을 씬 좌표로 올린다."""
    return [(name, *(value * SCALE for value in box)) for name, *box in rects]


def scale_numbered(rects: list[list[int]], prefix: str) -> list[tuple]:
    """[x, y, w, h] 목록에 번호 이름을 붙여 씬 좌표로 올린다."""
    return [
        (f"{prefix}-{index:02d}", *(value * SCALE for value in box))
        for index, box in enumerate(rects)
    ]


# 남쪽 집 바로 위 동서 길. e2e/village-bg-world.mjs 는 "스폰 바로 아래 충돌체"로
# 밀어붙여 충돌을 검증하므로, 스폰 아래에 건물이 있어야 그 판정이 실제로 돈다.
SPAWN = (200, 400)

# 스폰에서 지도 사방으로 실제로 걸어갈 수 있는지 확인하는 지점들.
# 건물 오른쪽의 짙은 풀은 **그림자**다. 울타리로 오해해 막아 버린 적이 있어
# (그때는 above 로도 올라가 있어서 캐릭터가 그림자에 덮였다) 여기 못 박아 둔다.
NAVIGATION_CHECKS = [
    ("spawn", *SPAWN),
    ("west-path", 72, 400),
    ("road-crossing", 556, 400),
    ("north-path", 556, 40),
    ("south-path", 556, 552),
    ("east-meadow", 672, 500),
    ("gable-shadow", 464, 470),
    ("inn-shadow", 464, 240),
    # 나무는 밑동만 막는다 — 수관 밑 그늘까지 세면 나무 사이가 벽이 된다.
    ("pine-gap", 226, 186),
]

# 반대로 **절대 들어갈 수 없어야** 하는 지점들 — 건물 벽 그림 위다.
# 벽 그림의 충돌이 빠지면 길은 그대로 열려 있어서 NAVIGATION_CHECKS 만으로는
# 통과해 버린다(박공집 아래층이 그랬다).
# 판자 사이 빈 줄·벽에 낀 자투리도 같이 센다 — 픽셀만 세던 시절엔 여기가 뚫려 있었다.
BLOCKED_CHECKS = [
    ("gable-house-flowerbox", 400, 490),
    ("gable-house-panel-gap", 368, 472),
    ("gable-house-nook", 432, 528),
    ("gable-house-ground-floor", 400, 540),
    ("inn-front-wall", 300, 300),
    ("pine-trunk-foot", 209, 186),
]

# 항상 열려 있어야 하는 길. axis 축의 폭이 minClearance 보다 좁아지면 감사에서 잡힌다.
# 길 자체는 24px 이지만(팩 원본이 12px), 사각형은 캐릭터 몸통이 지나갈 여유를
# 포함해 한 타일로 잡는다.
NAVIGATION_CORRIDORS = [
    ("east-west-path", 32, 384, 544, TILE, "horizontal", TILE),
    ("north-south-path", 544, 0, TILE, 576, "vertical", TILE),
]


def load_tileset() -> tuple[Image.Image, int, dict[int, str], dict[int, list[list[int]]]]:
    """아틀라스와 타일별 이름·충돌. 아틀라스는 로컬에서 구운 파생물이다."""
    root = ElementTree.parse(TILESET_SOURCE).getroot()
    atlas_path = (TILESET_SOURCE.parent / root.find("image").get("source")).resolve()
    if not atlas_path.exists():
        raise SystemExit(
            f"타일 아틀라스가 없다: {atlas_path}\n"
            "npm run build:village-tiles 로 구워라 (라이선스 원본이 필요하다)."
        )
    names: dict[int, str] = {}
    boxes: dict[int, list[list[int]]] = {}
    for tile in root.findall("tile"):
        index = int(tile.get("id"))
        properties = {p.get("name"): p.get("value")
                      for p in tile.findall("properties/property")}
        if properties.get("name"):
            names[index] = properties["name"]
        group = tile.find("objectgroup")
        if group is not None:
            boxes[index] = [
                [int(float(o.get(key))) for key in ("x", "y", "width", "height")]
                for o in group.findall("object")
            ]
    return (Image.open(atlas_path).convert("RGBA"), int(root.get("columns")),
            names, boxes)


def compose(tilemap: dict, atlas: Image.Image, columns: int,
            layers: list[str]) -> Image.Image:
    """레이어를 파일에 적힌 순서대로 그린다 — 뒤에 그린 것이 위로 온다."""
    width = tilemap["width"] * CELL
    height = tilemap["height"] * CELL
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for layer in tilemap["layers"]:
        if layer["type"] != "tilelayer" or layer["name"] not in layers:
            continue
        for index, gid in enumerate(layer["data"]):
            if not gid:
                continue
            row, column = divmod(index, tilemap["width"])
            ar, ac = divmod(gid - 1, columns)
            tile = atlas.crop((ac * CELL, ar * CELL, (ac + 1) * CELL, (ar + 1) * CELL))
            canvas.alpha_composite(tile, (column * CELL, row * CELL))
    return canvas


def solid_mask(tilemap: dict, atlas: Image.Image, columns: int,
               boxes: dict[int, list[list[int]]]) -> np.ndarray:
    """타일에 적힌 충돌 상자를 맵 위에 펼친다(1x 좌표).

    **안 보이는 상자는 막지 않는다.** 한 칸에 조각이 여러 장 겹치고, 아래 조각이 위
    조각에 가려지는 경우가 있다 — 배치가 팩 그림을 짜맞추다 보니 채움용으로 깔린
    것이다. 타일 충돌은 놓인 자리를 모르므로 그런 조각도 상자를 그대로 내는데, 그러면
    잔디밖에 안 보이는 자리가 막힌다(길 옆 돌담 자투리가 그랬다). 조각이 아니라
    **상자 단위**로 본다 — 한 조각 안에서도 보이는 부분과 가려진 부분이 갈린다.
    """
    opaque = np.array(atlas.convert("RGBA"))[..., 3] > 0
    mask = np.zeros((tilemap["height"] * CELL, tilemap["width"] * CELL), bool)
    tiles = [layer for layer in tilemap["layers"] if layer["type"] == "tilelayer"]
    for index in range(tilemap["width"] * tilemap["height"]):
        row, column = divmod(index, tilemap["width"])
        covered = np.zeros((CELL, CELL), bool)
        # 위에서부터 내려오며 "아직 안 가려진 곳이 있나" 를 본다.
        for layer in reversed(tiles):
            gid = layer["data"][index]
            if not gid:
                continue
            ar, ac = divmod(gid - 1, columns)
            here = opaque[ar * CELL : (ar + 1) * CELL, ac * CELL : (ac + 1) * CELL]
            visible = here & ~covered
            for bx, by, bw, bh in boxes.get(gid - 1, ()):
                # 상자가 덮인 자리에 있으면 막지 않는다. 조각의 다른 데가 보인다고
                # 가려진 상자까지 세면 잔디밖에 안 보이는 자리에 유령 충돌이 생긴다.
                if visible[by : by + bh, bx : bx + bw].any():
                    y, x = row * CELL + by, column * CELL + bx
                    mask[y : y + bh, x : x + bw] = True
            covered |= here
    return mask


def regions(tilemap: dict, names: dict[int, str]) -> list[list]:
    """"무엇이 어디 있는지" 목록. 같은 이름의 타일이 붙어 있는 덩어리마다 한 상자다.

    사람이 읽는 목록이자 villageMapAudit 의 입력이다. 같은 그림이 여러 곳에 놓이므로
    (숲 두 군데, 집 두 채) 이름별로 한 상자가 아니라 붙어 있는 칸끼리 묶는다.
    """
    rows, columns = tilemap["height"], tilemap["width"]
    grids: dict[str, np.ndarray] = {}
    for layer in tilemap["layers"]:
        if layer["type"] != "tilelayer":
            continue
        for index, gid in enumerate(layer["data"]):
            name = names.get(gid - 1)
            if not name:
                continue
            grid = grids.setdefault(name, np.zeros((rows, columns), bool))
            grid[index // columns, index % columns] = True

    found: list[list] = []
    for name, grid in sorted(grids.items()):
        labels, _ = ndimage.label(grid, structure=np.ones((3, 3)))
        boxes = [(box[1].start, box[0].start,
                  box[1].stop - box[1].start, box[0].stop - box[0].start)
                 for box in ndimage.find_objects(labels)]
        ordered = sorted(boxes, key=lambda box: (box[1], box[0]))
        for number, (cx, cy, cw, ch) in enumerate(ordered, 1):
            label = name if len(ordered) == 1 else f"{name}-{number}"
            found.append([label, cx * CELL, cy * CELL, cw * CELL, ch * CELL])
    return found


def upscale(image: Image.Image) -> Image.Image:
    return image.resize((image.width * SCALE, image.height * SCALE), Image.NEAREST)


def rectangles(layer_id: int, name: str, rects: list[tuple], first_id: int) -> dict:
    return {
        "draworder": "index",
        "id": layer_id,
        "name": name,
        "objects": [
            {
                "height": h, "id": first_id + index, "name": label,
                "rotation": 0, "visible": True, "width": w, "x": x, "y": y,
            }
            for index, (label, x, y, w, h) in enumerate(rects)
        ],
        "opacity": 1,
        "type": "objectgroup",
        "visible": True,
        "x": 0,
        "y": 0,
    }


def image_layer(layer_id: int, name: str, image: str, width: int, height: int) -> dict:
    return {
        "id": layer_id, "image": image, "imageheight": height, "imagewidth": width,
        "name": name, "opacity": 1, "repeatx": False, "repeaty": False,
        "type": "imagelayer", "visible": True, "x": 0, "y": 0,
    }


def points(layer_id: int, name: str, items: list[tuple], first_id: int) -> dict:
    return {
        "draworder": "index", "id": layer_id, "name": name,
        "objects": [
            {
                "height": 0, "id": first_id + index, "name": label, "point": True,
                "rotation": 0, "visible": True, "width": 0, "x": x, "y": y,
            }
            for index, (label, x, y) in enumerate(items)
        ],
        "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0,
    }


class Band(NamedTuple):
    """sorted_* 레이어 하나 — 잘라 쓸 사각형과 발치 y(맵 원본 px)."""
    name: str
    x: int
    y: int
    width: int
    height: int
    depth_y: int


def sorted_bands(layers: list[dict]) -> list[Band]:
    """sorted_* 레이어 → (이름, 잘라 쓸 사각형, 발치 y). 씬이 이걸로 깊이를 준다."""
    bands = []
    for layer in layers:
        depth = next((int(p["value"]) for p in layer.get("properties", [])
                      if p["name"] == "depthY"), None)
        if depth is None:
            raise SystemExit(
                f"{layer['name']} 에 depthY 속성이 없다 (Tiled 에서 지정하라)"
            )
        used = [index for index, gid in enumerate(layer["data"]) if gid]
        if not used:
            raise SystemExit(
                f"{layer['name']} 이 비어 있다 — 쓰지 않을 레이어는 Tiled 에서 지워라"
            )
        rows = [index // layer["width"] for index in used]
        cols = [index % layer["width"] for index in used]
        # depthY 는 맵 원본 px 그대로 둔다 — 씬이 배율을 곱한다(Office 와 같은 규칙).
        bands.append(Band(layer["name"],
                          min(cols) * CELL * SCALE, min(rows) * CELL * SCALE,
                          (max(cols) - min(cols) + 1) * CELL * SCALE,
                          (max(rows) - min(rows) + 1) * CELL * SCALE,
                          depth))
    return bands


def assert_bands_disjoint(bands: list[Band]) -> None:
    """밴드끼리 겹치면 안 된다.

    sorted_* 는 전부 village-sorted.png 한 장에 굽고 씬은 밴드 사각형으로 잘라 쓴다.
    두 밴드가 겹치면 겹친 자리가 두 번 그려지고, 한쪽 조각이 남의 depth 를 얻는다.
    """
    for index, band in enumerate(bands):
        for other in bands[index + 1:]:
            if (band.x < other.x + other.width
                    and band.x + band.width > other.x
                    and band.y < other.y + other.height
                    and band.y + band.height > other.y):
                raise SystemExit(
                    f"sorted 레이어 범위가 겹친다: {band.name} / {other.name} — "
                    "겹치는 조각은 한 레이어로 합쳐라"
                )


def tilemap_json(width: int, height: int, catalog: list[list],
                 colliders: list[list[int]], bands: list[Band]) -> dict:
    layers = [
        image_layer(1, "background", "../village-bg.png", width, height),
        image_layer(2, "above", "../village-above.png", width, height),
        rectangles(3, "objects", scale_named(catalog), 100),
        rectangles(4, "colliders", scale_numbered(colliders, "solid"), 200),
        points(5, "spawn", [("spawn", *SPAWN)], 300),
        points(6, "navigation_checks", NAVIGATION_CHECKS, 400),
        {
            "draworder": "index", "id": 7, "name": "navigation_corridors",
            "objects": [
                {
                    "height": h, "id": 500 + index, "name": label,
                    "properties": [
                        {"name": "axis", "type": "string", "value": axis},
                        {"name": "minClearance", "type": "int", "value": clearance},
                    ],
                    "rotation": 0, "visible": True, "width": w, "x": x, "y": y,
                }
                for index, (label, x, y, w, h, axis, clearance)
                in enumerate(NAVIGATION_CORRIDORS)
            ],
            "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0,
        },
        points(8, "blocked_checks", BLOCKED_CHECKS, 600),
        {
            "draworder": "index", "id": 9, "name": "sorted_overlays",
            "objects": [
                {
                    "height": band.height, "id": 700 + index, "name": band.name,
                    "properties": [
                        {"name": "depthY", "type": "int", "value": band.depth_y},
                    ],
                    "rotation": 0, "visible": True,
                    "width": band.width, "x": band.x, "y": band.y,
                }
                for index, band in enumerate(bands)
            ],
            "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0,
        },
    ]
    return {
        "compressionlevel": -1,
        "height": height // TILE,
        "infinite": False,
        "layers": layers,
        "nextlayerid": len(layers) + 1,
        "nextobjectid": 800,
        "orientation": "orthogonal",
        "properties": [
            {"name": "assetSource", "type": "string", "value": PACK_SOURCE},
            {"name": "assetCredit", "type": "string", "value": CREDIT},
            {"name": "layoutSource", "type": "string",
             "value": "scripts/assets/village.tmj"},
            {"name": "referenceUsedForPixels", "type": "bool", "value": False},
        ],
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "tileheight": TILE,
        "tilesets": [],
        "tilewidth": TILE,
        "type": "map",
        "version": "1.10",
        "width": width // TILE,
    }


def assert_pack_palette(image: Image.Image, path: Path) -> None:
    """출력에 팩 밖 픽셀이 섞이지 않았는지 확인한다.

    팩은 68색이다. 256색을 넘으면 리샘플링 등으로 색이 번진 것이고, 그건 곧 팩
    원본이 아닌 그림이 소스로 들어왔다는 뜻이다(예전 소스가 139,369색이었다).
    """
    data = np.array(image)
    if image.mode == "RGBA":  # 투명한 곳의 RGB 는 의미가 없으니 세지 말자
        flat = data.reshape(-1, 4)
        pixels = flat[flat[:, 3] > 0][:, :3]
    else:
        pixels = data.reshape(-1, 3)
    colours = len(np.unique(pixels, axis=0))
    if colours > 256:
        raise SystemExit(f"{path.name}: {colours}색 — 팩 원본이 아닌 픽셀이 섞였다")


def save_pixel_art(image: Image.Image, path: Path) -> None:
    """팩은 68색이라 인덱스 PNG 로 저장해도 손실이 없고 파일이 훨씬 작다."""
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] == 255:
        image = image.convert("RGB")
    assert_pack_palette(image, path)
    image.quantize(colors=256, method=Image.Quantize.MAXCOVERAGE,
                   dither=Image.Dither.NONE).save(path, optimize=True)


def main() -> None:
    tilemap = json.loads(TILEMAP_SOURCE.read_text())
    atlas, columns, names, boxes = load_tileset()
    order = [layer["name"] for layer in tilemap["layers"]
             if layer["type"] == "tilelayer"]
    above = [name for name in order if name.startswith("above")]
    # sorted_* 레이어는 "바닥에 선 가림 물건" 이다. 레이어마다 depthY(발치 y)를 달아 두면
    # 씬이 캐릭터와 같은 축으로 정렬한다 — Office 의 depthY 와 같은 규칙이다.
    # 늘 위인 지붕·수관(above_*)과 갈라 놓는 게 핵심이다. 바닥 물건을 above 에 넣으면
    # 그 앞에 서도 캐릭터가 덮인다.
    sorted_layers = [layer for layer in tilemap["layers"]
                     if layer["type"] == "tilelayer"
                     and layer["name"].startswith("sorted")]
    background = upscale(compose(tilemap, atlas, columns, order))
    overlay = upscale(compose(tilemap, atlas, columns, above))
    sorted_overlay = upscale(compose(
        tilemap, atlas, columns, [layer["name"] for layer in sorted_layers]))
    width, height = background.size
    if (width, height) != (704, 576):
        raise SystemExit(f"확대 결과가 704x576 이어야 한다 (지금 {width}x{height})")

    bands = sorted_bands(sorted_layers)
    assert_bands_disjoint(bands)
    catalog = regions(tilemap, names)
    # 타일에 그려 둔 상자를 한 픽셀도 버리지 않고 덮는다. 예전엔 픽셀에서 충돌을
    # **추정**했으니 잔털을 버려도 됐지만, 이제 상자는 사람이 그린 값이다 — 나무 밑동처럼
    # 작은 상자가 칸 경계에서 쪼개지면 그대로 사라져 버린다(실제로 그렇게 뚫렸다).
    colliders, missed, hit_limit = fit_colliders(
        solid_mask(tilemap, atlas, columns, boxes), min_area=1, limit=400
    )
    if not catalog or not colliders:
        raise SystemExit("타일에 이름도 충돌도 없다 — 타일셋이 망가졌나?")
    if missed:
        raise SystemExit(f"타일 상자 {missed}px 를 충돌로 못 옮겼다")
    if hit_limit:
        raise SystemExit("충돌 사각형 개수 상한에 걸렸다 — 덩어리째 빠진 곳이 있다")

    # 여기까지가 검증이다. 아래부터 파일을 쓴다 — 중간에 멈추면 PNG 만 새것이고
    # village.json 은 옛것으로 남아 조용히 어긋난다.
    save_pixel_art(background, BACKGROUND)
    # 오버레이는 알파를 살려야 해서 인덱스화하지 않지만, 출처 검사는 똑같이 받는다.
    assert_pack_palette(overlay, OVERLAY)
    overlay.save(OVERLAY, optimize=True)
    assert_pack_palette(sorted_overlay, SORTED)
    sorted_overlay.save(SORTED, optimize=True)
    TILEMAP.write_text(
        json.dumps(tilemap_json(width, height, catalog, colliders, bands), indent=2)
        + "\n"
    )

    for path in (BACKGROUND, OVERLAY, SORTED, TILEMAP):
        print(f"{path.relative_to(ROOT)} {path.stat().st_size // 1024}KB")
    print(f"  영역 {len(catalog)}개, 충돌 {len(colliders)}개")


if __name__ == "__main__":
    main()
