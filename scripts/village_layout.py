#!/usr/bin/env python3
"""Village 빌드 공용 로직 — 아틀라스 굽기와 맵 굽기가 같이 쓴다.

"무엇이 벽인가" 는 더 이상 여기서 추정하지 않는다. Tiled 타일셋(`village.tsx`)의
타일마다 충돌 상자가 그려져 있고, 빌드는 그걸 맵 위에 펼칠 뿐이다. 예전에는 팩 좌표
표로 추정했는데, 표에서 빠진 벽 그림이 조용히 안 막히는 사고가 났다.
"""

from __future__ import annotations

import numpy as np
from scipy import ndimage

CELL = 16  # 팩의 타일 크기
# 팩 PSD 의 "Credits" 레이어(작가 크레딧 워터마크)가 tileset.png 에 합쳐져 있다.
# 맵에 실려 배포되면 안 되므로 원본을 읽는 쪽에서 항상 이 덩어리를 떼고 시작한다.
CREDITS_LAYER = (226, 240, 126, 48)


def strip_credits(tileset: np.ndarray) -> np.ndarray:
    """Credits 레이어 덩어리를 뗀 불투명 마스크."""
    opaque = tileset[..., 3] > 0
    cx, cy, cw, ch = CREDITS_LAYER
    labels, _ = ndimage.label(opaque, structure=np.ones((3, 3)))
    for index, box in enumerate(ndimage.find_objects(labels), 1):
        if (box[1].start, box[0].start) != (cx, cy):
            continue
        if (box[1].stop - cx, box[0].stop - cy) != (cw, ch):
            raise SystemExit("Credits 레이어 크기가 기록과 다르다 — 팩이 바뀌었나?")
        return opaque & (labels != index)
    raise SystemExit("tileset 에서 Credits 레이어를 찾지 못했다 — 팩이 바뀌었나?")


def largest_rectangle(mask: np.ndarray) -> tuple[int, int, int, int]:
    """마스크 안에서 가장 넓은 축정렬 사각형 (x, y, w, h)."""
    height, width = mask.shape
    heights = np.zeros(width, int)
    best = (0, 0, 0, 0, 0)  # area, x, y, w, h
    for row in range(height):
        heights = np.where(mask[row], heights + 1, 0)
        stack: list[int] = []
        for col in range(width + 1):
            current = int(heights[col]) if col < width else 0
            while stack and int(heights[stack[-1]]) > current:
                h = int(heights[stack.pop()])
                left = stack[-1] + 1 if stack else 0
                area = h * (col - left)
                if area > best[0]:
                    best = (area, left, row - h + 1, col - left, h)
            stack.append(col)
    return best[1], best[2], best[3], best[4]


def fit_colliders(mask: np.ndarray, min_area: int,
                  limit: int) -> tuple[list[list[int]], int, bool]:
    """마스크를 사각형 몇 개로 덮는다 — 넓은 것부터 떼어낸다.

    (사각형 목록, 못 덮은 픽셀 수, 개수 상한에 걸렸는지) 를 돌려준다. min_area 보다
    작게 남는 픽셀은 버려지므로, 버리면 안 되는 값(사람이 그린 상자)을 다룰 때는
    1 을 넘겨야 한다. 상한에 걸린 경우는 덩어리째 빠진 것이므로 부르는 쪽에서 알려야 한다.
    """
    remaining = mask.copy()
    rects: list[list[int]] = []
    while len(rects) < limit:
        x, y, w, h = largest_rectangle(remaining)
        if w * h < min_area:
            return rects, int(remaining.sum()), False
        rects.append([int(x), int(y), int(w), int(h)])
        remaining[y : y + h, x : x + w] = False
    return rects, int(remaining.sum()), True
