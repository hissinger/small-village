#!/usr/bin/env python3
"""Bake the derived tile atlas that `village.tsx` points at.

아틀라스는 팩 아트를 잘라 붙인 파생물이라 커밋하지 않는다. 어느 타일이 팩의 어디서
왔는지는 `village.tsx` 의 타일 속성(source / sourceX / sourceY)에 적혀 있으므로,
팩 원본만 있으면 여기서 언제든 똑같이 다시 굽는다.

사용법 (라이선스 원본이 로컬에 있어야 한다. scripts/assets/README.md 참고):
    npm run build:village-tiles
"""

from __future__ import annotations

import xml.etree.ElementTree as ElementTree
from pathlib import Path

import numpy as np
from PIL import Image

from village_layout import CELL, strip_credits

ROOT = Path(__file__).resolve().parents[1]
TILESET = ROOT / "scripts/assets/village.tsx"
PACK = ROOT / "tiny-rpg-town-files/tileset/tileset.png"
GRASS = ROOT / "tiny-rpg-town-files/tileset/grass-tile.png"


def tiles(root: ElementTree.Element) -> list[tuple[str, int, int]]:
    """타일 id 순서대로 (출처, x, y)."""
    found: dict[int, tuple[str, int, int]] = {}
    for tile in root.findall("tile"):
        properties = {p.get("name"): p.get("value")
                      for p in tile.findall("properties/property")}
        found[int(tile.get("id"))] = (properties["source"],
                                      int(properties["sourceX"]),
                                      int(properties["sourceY"]))
    # 아틀라스는 id 순서대로 채우고 빌드는 gid-1 로 그 자리를 읽는다. Tiled 에서 타일을
    # 지워 id 에 구멍이 나면 그림·충돌이 통째로 밀리므로, 어긋나면 여기서 멈춘다.
    if sorted(found) != list(range(len(found))):
        raise SystemExit(
            "타일 id 가 0..N-1 로 이어지지 않는다 — 지운 타일이 있으면 "
            "village.tsx 의 id 와 village.tmj 의 gid 를 다시 매겨야 한다."
        )
    return [found[index] for index in sorted(found)]


def atlas_path(root: ElementTree.Element) -> Path:
    return (TILESET.parent / root.find("image").get("source")).resolve()


def bake() -> tuple[Path, Image.Image, int, ElementTree.Element]:
    root = ElementTree.parse(TILESET).getroot()
    missing = [p for p in (PACK, GRASS) if not p.exists()]
    if missing:
        raise SystemExit(
            "라이선스 원본이 없다:\n  "
            + "\n  ".join(str(p.relative_to(ROOT)) for p in missing)
            + "\n자세한 배치는 scripts/assets/README.md 를 보라."
        )
    pack = np.array(Image.open(PACK).convert("RGBA"))
    pack[~strip_credits(pack)] = 0  # 워터마크는 절대 아틀라스에 실리면 안 된다
    grass = np.tile(np.array(Image.open(GRASS).convert("RGBA")), (3, 3, 1))

    keys = tiles(root)
    columns = int(root.get("columns"))
    rows = -(-len(keys) // columns)
    canvas = np.zeros((rows * CELL, columns * CELL, 4), np.uint8)
    for index, (source, x, y) in enumerate(keys):
        row, column = divmod(index, columns)
        patch = (grass if source == "grass" else pack)[y : y + CELL, x : x + CELL]
        canvas[row * CELL : (row + 1) * CELL, column * CELL : (column + 1) * CELL] = patch

    return atlas_path(root), Image.fromarray(canvas), len(keys), root


def main() -> None:
    path, image, count, root = bake()
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    # 타일이 늘면 아틀라스도 커진다. tsx 의 선언값을 여기서 맞춰 둔다 — 손으로 고치게
    # 두면 "크기가 기록과 다르다" 로 빌드가 멈추고 고칠 방법이 tsx 직접 편집뿐이다.
    node = root.find("image")
    if (node.get("width"), node.get("height")) != (str(image.width), str(image.height)):
        node.set("width", str(image.width))
        node.set("height", str(image.height))
        ElementTree.indent(root, space=" ")
        ElementTree.ElementTree(root).write(TILESET, encoding="UTF-8",
                                            xml_declaration=True)
        print(f"{TILESET.relative_to(ROOT)} 의 아틀라스 크기를 갱신했다")
    print(f"{path.relative_to(ROOT)} {image.width}x{image.height} ({count} tiles)")


if __name__ == "__main__":
    main()
