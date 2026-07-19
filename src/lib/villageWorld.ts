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
 * 맵 데이터(치수·충돌·가림 영역·스폰)는 default.json 과 동일한 **Tiled 형식**으로
 * [public/assets/tilemaps/village.json] 에 있다:
 *  - imagelayer "background" → village-bg.png
 *  - objectgroup "colliders" → 충돌 사각형(밑동)
 *  - objectgroup "above"     → 가림(overlay) 사각형(나무 캔버스·지붕)
 *  - objectgroup "spawn"     → 스폰 point
 * 좌표는 모두 원본 픽셀(704x576, 미확대) 기준이며, 씬이 VILLAGE_SCALE 로 확대해 배치한다.
 * 충돌/가림 영역은 Tiled 에디터에서 village-bg 위에 사각형을 드래그해 편집한다
 * (인게임 정렬은 ?debugWorld 로 켜서 확인).
 *
 * SCALE 만은 맵 데이터가 아니라 렌더 선택(픽셀아트는 정수 배율로만 확대해야 선명)이라
 * 여기 코드에 둔다.
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
