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

export interface User {
  id: string;
  character_index: number;
  name: string;
  room_id: string;
  x: number;
  y: number;
  last_active: string;
}

export interface Room {
  id: string;
  title: string;
  created_at: string;
  // 방의 게임 월드 맵. 없거나 알 수 없는 값이면 resolveMap 이 기본 맵으로 폴백한다
  // (map 컬럼 도입 전에 만들어진 오래된 rooms row 대비).
  map?: string;
}
