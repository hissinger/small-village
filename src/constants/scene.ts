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

export const NUM_CHARACTERS = 40;

// 내 위치를 broadcast 로 방송하는 최소 간격(ms). 씬 update() 는 매 프레임(~60Hz) 돌지만
// 위치는 이 주기(~10Hz)로만 내보내 전송 예산(supabaseClient eventsPerSecond)을 아낀다.
export const POSITION_BROADCAST_INTERVAL_MS = 100;

// 게임 화면 하단 바(BottomBar)의 높이(px).
// 게임 캔버스가 하단 바를 침범하지 않도록 이 값만큼 아래를 비워둔다.
export const BOTTOM_BAR_HEIGHT = 48;
