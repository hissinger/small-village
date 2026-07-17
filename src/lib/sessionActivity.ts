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
 * `last_active`(ISO 문자열)로부터 `nowMs` 까지의 경과(ms). 파싱 불가하면 null.
 *
 * "지금 접속 중인가" 판정에서 last_active 파싱 + NaN 처리를 한 곳에 모은다.
 * NaN 정책은 호출부가 정한다:
 *  - 로비 카운트([roomCounts.ts])는 null 을 "비접속"으로 제외(유령 방지, 보수적).
 *  - 로스터 뷰([RoomParticipantsContext.tsx])는 null 을 "방금 도착"으로 포함(초기 write 레이스 방지).
 */
export function activeAgeMs(lastActive: string, nowMs: number): number | null {
  const t = new Date(lastActive).getTime();
  return Number.isNaN(t) ? null : nowMs - t;
}
