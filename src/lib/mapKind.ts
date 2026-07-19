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
 * 게임 월드 맵 종류. 방(rooms.map)마다 하나로 고정된다 — 위치는 방 참가자끼리
 * 절대좌표로 공유되고 맵마다 월드 크기·충돌이 다르므로, 한 방 안에서는 모두 같은
 * 맵을 써야 좌표가 어긋나지 않는다(그래서 방별 속성이지 개인 설정이 아니다).
 *  - VILLAGE: village-bg 픽셀아트 이미지 월드(로비 첫 화면과 동일). 기본값.
 *  - TILEMAP: 기존 Serene Village 타일맵(레이어드, 타일 기반 충돌).
 */
// ⚠️ 맵을 추가/변경하면 Edge Function 의 화이트리스트
//    (supabase/functions/create-meeting/index.ts 의 ALLOWED_MAPS)도 같이 고쳐야 한다.
//    Deno 런타임이라 이 파일을 import 할 수 없어 값이 이원화되어 있다.
export const MAPS = {
  VILLAGE: "village",
  TILEMAP: "tilemap",
} as const;

export type MapKind = (typeof MAPS)[keyof typeof MAPS];

export const DEFAULT_MAP: MapKind = MAPS.VILLAGE;

/** 로비/UI 에 보여줄 사람이 읽을 이름. */
export const MAP_LABELS: Record<MapKind, string> = {
  [MAPS.VILLAGE]: "Village",
  [MAPS.TILEMAP]: "Classic",
};

/**
 * 외부에서 온 값(DB·localStorage·쿼리 등, 오래된 null 포함)을 유효한 MapKind 로 정규화한다.
 * 알 수 없는 값이면 DEFAULT_MAP 로 폴백해 렌더가 절대 깨지지 않게 한다.
 */
export function resolveMap(value: string | null | undefined): MapKind {
  return (Object.values(MAPS) as string[]).includes(value ?? "")
    ? (value as MapKind)
    : DEFAULT_MAP;
}
