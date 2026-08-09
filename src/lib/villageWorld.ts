/**
 * Copyright 2024 SmallVillageProject
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * village 이미지 월드의 렌더 유틸.
 *
 * 맵의 그림은 라이선스 아트(Tiny RPG Town — Luis Zuno/@ansimuz, GameDev Market
 * Pro Licence)에서만 나온다. 배치는 좌표만 든 Tiled 파일
 * [scripts/assets/village.tmj] · [scripts/assets/village.tsx] 에 있고,
 * `python3 scripts/build-village-map.py` 가 원본 + 배치를 두 장의 PNG +
 * 월드 데이터로 굽는다. 원본은 재배포가 금지되어 리포에 없다 —
 * [scripts/assets/README.md] 에 받는 방법이 있다.
 *
 * 맵 데이터(치수·충돌·스폰)는 default.json 과 동일한 **Tiled 형식**으로
 * [public/assets/tilemaps/village.json] 에 있다:
 *  - imagelayer "background" → village-bg.png (모든 레이어를 합친 배경)
 *  - imagelayer "above"      → village-above.png (above 레이어만 남긴 가림 오버레이)
 *  - objectgroup "colliders" → 충돌 사각형(밑동)
 *  - objectgroup "spawn"     → 스폰 point
 * 좌표는 모두 704x576(미확대) 기준이며, 씬이 VILLAGE_SCALE 로 확대해 배치한다.
 * 충돌은 **타일에 그려 둔 상자**가 유일한 출처다 — Tiled 의 타일 충돌 편집기에서
 * 조각마다 그려 두면 빌드가 맵 위에 펼친다
 * (인게임 정렬은 ?debugWorld 로 켜서 확인, 오프라인 점검은 npm run audit:village).
 *
 * SCALE 만은 맵 데이터가 아니라 렌더 선택(픽셀아트는 정수 배율로만 확대해야 선명)이라
 * 여기 코드에 둔다. 레이아웃이 1x(352x288)인 것과 같은 이유다.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** village 월드 확대 배율(정수). 타일맵의 LAYER.SCALE 과는 별개다. */
export const VILLAGE_SCALE = 2;

/** 사각형을 배율로 확대해 월드 좌표로 환산한다. */
export function scaleRect(r: Rect, scale: number): Rect {
  return { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale };
}
