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

import {
  SPEAKING_HANGOVER_MS,
  SPEAKING_RMS_THRESHOLD,
  SpeakingEntry,
  computeRms,
  setsEqual,
  updateSpeaking,
} from "./speakingPeers";

// 시간영역 바이트 버퍼(무음 = 128)를 만든다. amp 만큼 128 위아래로 흔든다.
function buffer(amp: number, len = 512): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = 128 + (i % 2 === 0 ? amp : -amp);
  }
  return out;
}

describe("computeRms", () => {
  it("무음(모두 128)이면 0", () => {
    expect(computeRms(buffer(0))).toBe(0);
  });

  it("빈 버퍼는 0(0으로 나눔 방지)", () => {
    expect(computeRms(new Uint8Array(0))).toBe(0);
  });

  it("진폭이 클수록 RMS 가 크다(단조 증가)", () => {
    const quiet = computeRms(buffer(4));
    const loud = computeRms(buffer(64));
    expect(loud).toBeGreaterThan(quiet);
  });

  it("풀스케일(±127)이면 RMS 는 1 에 근접", () => {
    // ±127 로 흔들면 정규화값이 ±0.992 → RMS ≈ 0.992
    expect(computeRms(buffer(127))).toBeCloseTo(127 / 128, 5);
  });
});

describe("updateSpeaking", () => {
  const T = SPEAKING_RMS_THRESHOLD;
  const H = SPEAKING_HANGOVER_MS;

  it("임계값 이상이면 발화 on 이고 lastLoud 가 현재 시각으로 갱신", () => {
    const next = updateSpeaking(undefined, T + 0.1, 1000, T, H);
    expect(next.active).toBe(true);
    expect(next.lastLoudMs).toBe(1000);
  });

  it("처음부터 조용하면 발화 off", () => {
    const next = updateSpeaking(undefined, 0, 1000, T, H);
    expect(next.active).toBe(false);
  });

  it("발화 중 임계값 아래로 잠깐 떨어져도 hangover 이내면 유지", () => {
    const prev: SpeakingEntry = { active: true, lastLoudMs: 1000 };
    const next = updateSpeaking(prev, 0, 1000 + H - 1, T, H);
    expect(next.active).toBe(true);
    expect(next.lastLoudMs).toBe(1000); // 마지막 관측 시각은 보존
  });

  it("발화 중이라도 hangover 를 넘겨 조용하면 off", () => {
    const prev: SpeakingEntry = { active: true, lastLoudMs: 1000 };
    const next = updateSpeaking(prev, 0, 1000 + H + 1, T, H);
    expect(next.active).toBe(false);
  });

  // 회귀 방지: 예전 구현(RTK activeSpeaker + 800ms 타임아웃)은 "발화 중 이벤트가
  // 계속 온다"고 가정해, 한 명이 계속 말하면 800ms 뒤 링이 사라지고 다시 안 떴다.
  // 볼륨 폴링 방식은 매 tick 마다 loud 를 관측하므로 연속 발화 내내 on 이어야 한다.
  it("연속 발화(매 tick loud)면 예전 800ms 타임아웃을 훨씬 넘겨도 계속 on", () => {
    let entry: SpeakingEntry | undefined;
    let now = 0;
    for (let i = 0; i < 40; i++) {
      // 100ms 간격 40회 = 4000ms 동안 계속 발화
      now += 100;
      entry = updateSpeaking(entry, T + 0.2, now, T, H);
      expect(entry.active).toBe(true);
    }
  });

  it("한 번 loud 후 계속 무음이면 hangover 후 off 로 전환", () => {
    let entry = updateSpeaking(undefined, T + 0.2, 0, T, H);
    expect(entry.active).toBe(true);
    entry = updateSpeaking(entry, 0, 100, T, H); // hangover(250) 이내 → 유지
    expect(entry.active).toBe(true);
    entry = updateSpeaking(entry, 0, 400, T, H); // hangover 초과 → off
    expect(entry.active).toBe(false);
  });
});

describe("setsEqual", () => {
  it("같은 원소면 true(순서 무관)", () => {
    expect(setsEqual(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
  });

  it("크기가 다르면 false", () => {
    expect(setsEqual(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
  });

  it("원소가 다르면 false", () => {
    expect(setsEqual(new Set(["a"]), new Set(["b"]))).toBe(false);
  });

  it("둘 다 비면 true", () => {
    expect(setsEqual(new Set(), new Set())).toBe(true);
  });
});
