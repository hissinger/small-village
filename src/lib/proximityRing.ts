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

// barrel(../constants)이 아니라 정의 파일(../constants/scene)에서 직접 import 한다.
// → 헬퍼의 side-effect-free 보증이 barrel(index.ts) 의 re-export 구성 변화와 무관하게 견고해진다.
import { SPATIAL_AUDIO } from "../constants/scene";

// Proximity ring(#29) 반경의 유일 계산처. 렌더(SmallVillageScene.drawProximityRing)와
// e2e 게터(exposeE2EHooks.proximityRing)가 모두 이 함수를 호출한다
// → 두 곳이 반경식을 각자 재선언할 여지가 없어 drift 불가.
//  - EDGE 는 오디오 maxDistance 에 결속. 오디오 튜닝으로 MAX_DISTANCE 를 바꾸면
//    링 경계선 크기도 함께 바뀐다(의도된 결속).
//  - FILL 은 refDistance 에 +20px fudge 를 더해 오디오 값과 분리(순수 시각 여유).
export function proximityRingRadii() {
  return {
    FILL: SPATIAL_AUDIO.REF_DISTANCE + 20, // 120 — 풀볼륨 근처 체감 여유
    EDGE: SPATIAL_AUDIO.MAX_DISTANCE, // 500 — 경계선 반경(= 오디오 maxDistance)
  };
}
