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

// barrel(../constants)이 아니라 정의 파일에서 직접 import 한다(순수성 보증).
import { SPATIAL_AUDIO } from "../constants/scene";

// PannerNode 의 distanceModel="exponential" 은 maxDistance 를 넘어도 볼륨을 0 으로
// 자르지 않는다 — 거리를 maxDistance 로 clamp 할 뿐이라 그 지점의 gain(≈4%)이 무한히
// 유지된다. 그래서 Proximity ring(EDGE = MAX_DISTANCE) 밖에서도 소리가 들렸다(#29).
// 이 게이트로 ring EDGE 밖이면 무음(gain 0)이 되게 해 "링 밖 = 무음" 을 오디오와 링에서 일치시킨다.
//
// 딱 끊기면 경계에서 소리가 툭 끊겨 어색하므로 EDGE 안쪽 마지막 구간(FADE_START_RATIO~1.0)에서
// gain 을 1→0 으로 선형 페이드아웃한다. FADE_START_RATIO 미만은 풀 게인(1), EDGE 밖은 완전 무음(0).
export const FADE_START_RATIO = 0.9;

export function spatialAudioGain(dx: number, dy: number): number {
  const distance = Math.hypot(dx, dy);
  const edge = SPATIAL_AUDIO.MAX_DISTANCE;
  const fadeStart = edge * FADE_START_RATIO;

  if (distance <= fadeStart) return 1;
  if (distance >= edge) return 0;
  // fadeStart..edge 구간을 1..0 으로 선형 보간
  return (edge - distance) / (edge - fadeStart);
}
