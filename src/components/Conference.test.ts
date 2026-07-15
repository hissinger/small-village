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

import type RTKClient from "@cloudflare/realtimekit";

// Conference 는 supabase/RTK/오디오 모듈을 전이 import 하므로, selector 순수 로직만
// 검증하기 위해 무거운 의존성을 스텁으로 대체한다.
jest.mock("@cloudflare/realtimekit-react", () => ({
  useRealtimeKitSelector: jest.fn(),
}));
jest.mock("./SpatialAudioController", () => ({
  SpatialAudioController: () => null,
}));
jest.mock("../hooks/useLocalParticipant", () => ({
  useLocalParticipant: jest.fn(),
}));

import { selectParticipants } from "./Conference";

describe("selectParticipants (useRealtimeKitSelector selector)", () => {
  it("participants 를 새 객체로 감싸지 않고 참조 그대로 리턴한다", () => {
    const participants = { joined: new Map() };
    const meeting = { participants } as unknown as RTKClient;
    // 새 객체({participants})를 리턴하는 회귀가 생기면 toBe 가 깨진다.
    expect(selectParticipants(meeting)).toBe(participants);
  });

  it("같은 meeting 을 반복 호출해도 동일 참조를 돌려준다 (getSnapshot 캐시 안정)", () => {
    const participants = { joined: new Map() };
    const meeting = { participants } as unknown as RTKClient;
    expect(selectParticipants(meeting)).toBe(selectParticipants(meeting));
  });
});
