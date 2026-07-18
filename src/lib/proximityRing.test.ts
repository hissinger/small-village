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

import { proximityRingRadii } from "./proximityRing";
// 헬퍼와 동일하게 barrel 이 아닌 정의 파일에서 직접 import 한다 — barrel 구성과 무관하게 순수.
import { SPATIAL_AUDIO } from "../constants/scene";

// 상수 리터럴끼리 대조하는 게 아니라 헬퍼의 파생식이 SPATIAL_AUDIO 와 어긋나지 않음을 검증한다.
// SPATIAL_AUDIO 를 튜닝하면 두 assert 가 자동으로 따라오고, 파생식만 잘못 바뀌면 즉시 실패한다.
describe("proximityRingRadii", () => {
  it("FILL 은 refDistance + 20 (시각 여유 fudge)", () => {
    expect(proximityRingRadii().FILL).toBe(SPATIAL_AUDIO.REF_DISTANCE + 20);
  });
  it("EDGE 는 오디오 maxDistance 에 결속", () => {
    expect(proximityRingRadii().EDGE).toBe(SPATIAL_AUDIO.MAX_DISTANCE);
  });
});
