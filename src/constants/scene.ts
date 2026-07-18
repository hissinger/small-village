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

// useRemotePositions 훅이 broadcast 수신을 React state 로 flush 하는 최소 간격(ms).
// 공간오디오만 이 state 를 쓰며, 오디오는 60fps 가 필요 없어 이 주기로 리렌더를 묶는다.
export const POSITION_STREAM_THROTTLE_MS = 100;

// 게임 화면 하단 바(BottomBar)의 높이(px).
// 게임 캔버스가 하단 바를 침범하지 않도록 이 값만큼 아래를 비워둔다.
export const BOTTOM_BAR_HEIGHT = 48;

// 공간 오디오 거리 경계(단위: world px = users.x/y 스프라이트 좌표계).
// SpatialAudioRenderer 의 PannerNode refDistance/maxDistance 와
// Proximity ring(#29) 반경(→ proximityRingRadii() 헬퍼)이 함께 참조하는 공유 출처다.
// 오디오도 ring 도 이 값을 매직 넘버로 재선언하지 않는다.
export const SPATIAL_AUDIO = {
  REF_DISTANCE: 100, // 풀볼륨 반경. ring FILL 은 여기 +20px.
  MAX_DISTANCE: 300, // PannerNode maxDistance. ring EDGE 가 이 값에 결속(= 같은 값 참조).
} as const;
