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

import { spatialAudioGain, FADE_START_RATIO } from "./spatialAudioRange";
import { proximityRingRadii } from "./proximityRing";
import { SPATIAL_AUDIO } from "../constants/scene";

// #29: ring EDGE(= MAX_DISTANCE) 밖이면 무음이어야 한다. exponential 모델은 자동으로
// 컷하지 않으므로 게이트가 링 경계와 오디오 컷오프를 일치시키는지 검증한다.
// EDGE 안쪽 마지막 구간(FADE_START_RATIO~1.0)은 1→0 선형 페이드아웃.
describe("spatialAudioGain", () => {
  const edge = SPATIAL_AUDIO.MAX_DISTANCE;
  const fadeStart = edge * FADE_START_RATIO;

  it("페이드 시작점 이내(가까움)에서는 풀 게인(1)", () => {
    expect(spatialAudioGain(0, 0)).toBe(1);
    expect(spatialAudioGain(fadeStart - 1, 0)).toBe(1);
    expect(spatialAudioGain(fadeStart, 0)).toBe(1);
  });

  it("페이드 구간에서는 1→0 으로 선형 감소", () => {
    // 페이드 구간 중간점 → gain 0.5
    const mid = (fadeStart + edge) / 2;
    expect(spatialAudioGain(mid, 0)).toBeCloseTo(0.5, 5);
    // 페이드 시작 직후는 1 미만, 0 초과
    const g = spatialAudioGain(fadeStart + 1, 0);
    expect(g).toBeLessThan(1);
    expect(g).toBeGreaterThan(0);
  });

  it("링 EDGE(= MAX_DISTANCE) 및 그 밖이면 완전 무음(0)", () => {
    expect(spatialAudioGain(edge, 0)).toBe(0);
    expect(spatialAudioGain(edge + 1, 0)).toBe(0);
    // 대각선 거리도 유클리드로 계산 — 축 합이 아니라 실제 거리 기준
    expect(spatialAudioGain(edge, edge)).toBe(0);
  });

  it("컷오프 경계가 ring EDGE 반경과 동일하다", () => {
    expect(proximityRingRadii().EDGE).toBe(SPATIAL_AUDIO.MAX_DISTANCE);
  });
});
