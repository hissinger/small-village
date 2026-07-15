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

// 스피커 링(발화 표시)의 순수 로직 모음. WebAudio/React 에 의존하지 않아 Jest 로
// 단위테스트할 수 있다. 실제 오디오 측정/폴링은 useSpeakingPeers 훅이 담당한다.
//
// 왜 볼륨 측정인가: RTK v2 의 `activeSpeaker` 이벤트는 "dominant speaker 가 바뀔
// 때만 1회" emit 되고(같은 사람이 계속 말해도 재발생 없음) 동시에 1명만 표현한다.
// 그래서 이벤트 기반 debounce/타임아웃으로는 연속 발화/다중 발화를 표시할 수 없다.
// 대신 각 참가자의 audioTrack 을 WebAudio AnalyserNode 로 직접 재서 판정한다.

/** 발화 판정 RMS 임계값(0~1, 정규화된 진폭 기준). 배경 잡음보다 크고 말소리보다
 * 작게 잡는다. 환경에 따라 조정 가능. */
export const SPEAKING_RMS_THRESHOLD = 0.05;

/** 임계값 아래로 떨어져도 이 시간 동안은 발화로 유지(hangover). 음절 사이의 짧은
 * 무음에 링이 깜빡이는 것을 막는다. */
export const SPEAKING_HANGOVER_MS = 250;

/** analyser 를 읽는 주기(ms). 10Hz 면 발화 표시에 충분하고 부하가 낮다. */
export const POLL_INTERVAL_MS = 100;

/**
 * 시간영역 바이트 샘플(`getByteTimeDomainData`, 무음 ≈ 128)에서 RMS(0~1)를 구한다.
 * 각 샘플을 -1~1 로 정규화해 제곱평균제곱근을 계산한다.
 */
export function computeRms(samples: Uint8Array): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = (samples[i] - 128) / 128; // -1 ~ 1
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / n);
}

/** 한 참가자의 발화 상태: 현재 발화 중인지 + 마지막으로 임계값을 넘긴 시각. */
export interface SpeakingEntry {
  active: boolean;
  lastLoudMs: number;
}

/**
 * RMS + hangover(hysteresis)로 한 참가자의 발화 상태를 갱신한다(불변).
 *  - rms ≥ threshold → 발화 on, 마지막 관측 시각 갱신.
 *  - rms < threshold 라도 마지막 관측 후 hangoverMs 이내면 발화 유지.
 *  - 그 외에는 발화 off.
 * 이벤트가 아니라 매 폴링마다 rms 를 재므로, 같은 사람이 계속 말하면 계속 on 으로
 * 남고(= RTK activeSpeaker 의 emit-on-change 한계 해소) 진짜 무음이면 자연히 off 된다.
 */
export function updateSpeaking(
  prev: SpeakingEntry | undefined,
  rms: number,
  nowMs: number,
  threshold: number,
  hangoverMs: number
): SpeakingEntry {
  if (rms >= threshold) {
    return { active: true, lastLoudMs: nowMs };
  }
  if (prev?.active && nowMs - prev.lastLoudMs < hangoverMs) {
    return { active: true, lastLoudMs: prev.lastLoudMs };
  }
  return { active: false, lastLoudMs: prev?.lastLoudMs ?? 0 };
}

/** 두 문자열 Set 의 원소가 완전히 같은지. 발화 집합 변화 시에만 리렌더하려고 쓴다. */
export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
