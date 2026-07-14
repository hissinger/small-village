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

// 스피커 링(발화 표시)의 순수 로직 모음. RTK/React 에 의존하지 않아 Jest 로
// 단위테스트할 수 있다. 실제 이벤트 구독/정리는 useSpeakingPeers 훅이 담당한다.

/** RTK 참가자에서 매핑에 필요한 최소 형태(self/원격 공통). */
export interface ParticipantLike {
  id: string;
  customParticipantId?: string | null;
}

/** RTK `meeting.participants` 에서 우리가 쓰는 부분만. */
export interface ParticipantsLike {
  joined: Map<string, ParticipantLike>;
}

/** debounce 리듀서의 상태: 발화 중인 userId 집합 + id 별 마지막 관측 시각. */
export interface SpeakingState {
  state: Set<string>;
  lastSeen: Record<string, number>;
}

/** 무이벤트로 자동 제거되기까지의 기본 타임아웃(ms). RTK 는 발화 "멈춤" 이벤트를
 * 주지 않으므로, 마지막 activeSpeaker 이후 이 시간이 지나면 링을 끈다. */
export const SPEAKING_TIMEOUT_MS = 800;

/**
 * activeSpeaker 의 `peerId`(RTK 피어 id) 를 Supabase `users.id`(=customParticipantId)
 * 로 해석한다.
 *  - self 분기: `peerId === self.id` 이면 `self.customParticipantId`.
 *  - 원격: `participants.joined` 에서 찾아 `customParticipantId`.
 *  - 못 찾거나 customParticipantId 가 없으면 null(미해결).
 */
export function resolveSpeakingUserId(
  peerId: string,
  participants: ParticipantsLike,
  self: ParticipantLike
): string | null {
  if (peerId === self.id) {
    return self.customParticipantId ?? null;
  }
  return participants.joined.get(peerId)?.customParticipantId ?? null;
}

/**
 * userId 를 발화 집합에 추가하고 마지막 관측 시각을 갱신한다(불변). 이미 있는
 * id 도 시각만 새로 찍혀 debounce 타이머가 리셋된다.
 */
export function addSpeaking(
  state: Set<string>,
  lastSeen: Record<string, number>,
  id: string,
  nowMs: number
): SpeakingState {
  const nextState = new Set(state);
  nextState.add(id);
  return {
    state: nextState,
    lastSeen: { ...lastSeen, [id]: nowMs },
  };
}

/**
 * 마지막 관측이 `timeoutMs` 이상 지난 id 를 제거한다(불변). 남은 id 만 담은
 * 새 state/lastSeen 을 돌려준다.
 */
export function pruneStale(
  state: Set<string>,
  lastSeen: Record<string, number>,
  nowMs: number,
  timeoutMs: number
): SpeakingState {
  const nextState = new Set<string>();
  const nextLastSeen: Record<string, number> = {};
  state.forEach((id) => {
    const seen = lastSeen[id];
    if (seen !== undefined && nowMs - seen < timeoutMs) {
      nextState.add(id);
      nextLastSeen[id] = seen;
    }
  });
  return { state: nextState, lastSeen: nextLastSeen };
}
