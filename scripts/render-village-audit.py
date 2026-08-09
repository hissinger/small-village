#!/usr/bin/env python3
"""Draw collider/navigation data on the built Village background.

판정은 하지 않는다 — 통행·차단·회랑 검사는 `src/lib/villageMapAudit.ts` 가 단일 출처이고
`npm run audit:village` 가 그 테스트를 돌린다. 여기서 같은 판정을 한 벌 더 구현하면
캐릭터 충돌 상자 같은 상수를 손으로 베껴야 하고, 두 판정이 조용히 갈라진다.
이 스크립트는 **눈으로 볼 그림**만 만든다.

레이아웃 가이드가 로컬에 있으면 50/50 비교 이미지도 같이 쓴다. 가이드는 배포되는
맵에 픽셀을 한 개도 주지 않는다 — 배치 참고용일 뿐이다.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "public/assets/tilemaps/village.json"
BACKGROUND = ROOT / "public/assets/village-bg.png"
OVERLAY = ROOT / "public/assets/village-above.png"
REFERENCE = ROOT / "tiny-rpg-town-files/layout/village-target-reference.png"
# 감사 이미지는 개발용이다. public/ 에 두면 배포에 섞여 나가고, 비교 이미지는
# 라이선스 아트에서 나온 파생물이라 배포·커밋 대상이 아니다(.gitignore 참고).
AUDIT = ROOT / ".audit/village-audit.png"
COMPARISON = ROOT / ".audit/village-comparison-overlay.png"


def main() -> None:
    tilemap = json.loads(MAP.read_text())
    by_name = {layer["name"]: layer for layer in tilemap["layers"]}
    width = tilemap["width"] * tilemap["tilewidth"]
    height = tilemap["height"] * tilemap["tileheight"]

    AUDIT.parent.mkdir(exist_ok=True)
    image = Image.open(BACKGROUND).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    for obj in by_name["colliders"]["objects"]:
        draw.rectangle((obj["x"], obj["y"], obj["x"] + obj["width"],
                        obj["y"] + obj["height"]),
                       fill=(255, 40, 40, 70), outline=(255, 40, 40, 230), width=2)
    for obj in by_name["navigation_corridors"]["objects"]:
        draw.rectangle((obj["x"], obj["y"], obj["x"] + obj["width"],
                        obj["y"] + obj["height"]), outline=(20, 255, 220, 230), width=2)
    for obj in by_name["navigation_checks"]["objects"]:  # 꼭 갈 수 있어야 하는 곳
        x, y = obj["x"], obj["y"]
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 230, 0, 255))
    for obj in by_name["blocked_checks"]["objects"]:  # 절대 못 들어가야 하는 곳
        x, y = obj["x"], obj["y"]
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(30, 60, 255, 255))
    image.convert("RGB").save(AUDIT)
    print(AUDIT.relative_to(ROOT))

    if REFERENCE.exists():
        built = Image.open(BACKGROUND).convert("RGBA")
        reference = Image.open(REFERENCE).convert("RGBA")
        if built.size == reference.size:
            Image.blend(reference, built, 0.5).convert("RGB").save(COMPARISON)
            print(COMPARISON.relative_to(ROOT))

    alpha = Image.open(OVERLAY).convert("RGBA").getchannel("A")
    covered = sum(1 for value in alpha.getdata() if value > 8)
    print(f"above coverage {100 * covered / (width * height):.1f}%")


if __name__ == "__main__":
    main()
