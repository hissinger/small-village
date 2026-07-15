# TODO

Presence & Visibility 개선 작업 중 미완료 항목. (상세 배경/설계는 삭제된 `docs/presence-visibility-plan.md` 참고 — 아카이브 필요 시 git history `dc48016` 참조)

## PR-1 — ④ 말풍선 오버플로우 · 긴 URL · 동시발화 타이머 버그

**문제 (라이브 확인).**
- `SmallVillageScene.ts`의 `speechBubbleHideTimer`가 씬 전역 단일 필드. A가 말한 뒤 B가 말하면 `setMessage()`가 A의 타이머를 `remove()`하고 B용만 걸어 → **A의 말풍선이 영원히 안 사라짐** (명백한 버그).
- 긴 URL/장문이 버블 밖으로 잘리거나 과도하게 커짐.

**범위.** 인-월드 말풍선(`SpeechBubble`)만. 채팅 패널(`ChatPanel`)은 이미 깨진 상태 아님.

**구현.**
- 버블별 타이머: `SpeechBubble`에 `private hideTimer` 필드 + `display(text, durationMs=10000)` 메서드로 텍스트 표시/숨김을 버블 자신이 관리. 씬의 `speechBubbleHideTimer` 필드와 `setMessage()` 타이머 로직 제거, `showChatMessage()`가 각 버블 `display()` 호출.
- 장문 자르기: 순수 함수 `truncateBubbleText(text, maxLen=200)` → `src/scenes/bubbleText.ts`(신규), `maxLen` 초과 시 `…` 붙임. `display()`에서 `setText` 전 적용.
- 오버플로우 정합: char-cap(`truncateBubbleText`) + 생성자 `wordWrap.width` 정합. `maxLines`(예:6)는 선택적 세로폭 안전장치(초과분은 말줄임 없이 잘림 — 말줄임은 char-cap 담당). 긴 무공백 토큰(URL)은 `useAdvancedWrap:true`로 문자 단위 끊김.

**테스트.** `src/scenes/bubbleText.test.ts` — 짧은 문자열 그대로 / 201자→200자+`…` / 경계값 / 멀티바이트.

**변경 파일.** `src/scenes/SmallVillageScene.ts`(SpeechBubble·setMessage·showChatMessage), `src/scenes/bubbleText.ts`(신규), `src/scenes/bubbleText.test.ts`(신규).

**수용 조건.** 두 클라이언트 연달아 말해도 각자 10초 뒤 개별 소멸 / 긴 URL·장문이 버블 밖으로 안 넘침.

---

## PR-4 — ③ 참가자 목록 패널

**문제.** 방 안에 누가 있는지, 마이크는 켜졌는지 볼 방법이 없음.

**구현.**
- 데이터 병합: 순수 함수 `buildParticipantList(self, remoteMap, rtkParticipants, speakingIds)` → `src/lib/participantList.ts`(신규). 반환: `{ id, name, isMe, micOn, speaking }[]`.
  - 원격: 기존 `useRemoteParticipants()` 재사용(id·name·character_index).
  - self: `RoomContext`에서 이름.
  - 마이크: RTK 참가자 `customParticipantId===id` 매칭 → `micOn=audioEnabled`. self는 `useRealtimeKitSelector((m)=>m.self.audioEnabled)` 재사용.
  - speaking: **PR-3 공용 훅 `useSpeakingPeers()` 그대로 구독**(별도 구독 금지).
- UI: `src/components/ParticipantPanel.tsx`(신규) — `ChatPanel` 우측 슬라이드인 패턴 복제(좌측 배치). 각 행: 이름(+ "나") + 마이크 아이콘(`Mic`/`MicOff`) + 발화 중 하이라이트. **아바타 v1 비포함.**
- 바텀바: `BottomBar.tsx`에 `Users` 아이콘 `IconButton` 추가(채팅 토글과 동일 패턴), 인원수 배지 표시.

**테스트.** `src/lib/participantList.test.ts` — self 항상 포함·isMe, 원격 병합, RTK 매칭 실패 시 `micOn=false`, speaking 반영, 중복 id 제거.

**변경 파일.** `src/lib/participantList.ts`(+`.test.ts`, 신규), `src/components/ParticipantPanel.tsx`(신규), `src/components/BottomBar.tsx`.

**수용 조건.** 두 클라이언트 접속 시 양쪽 패널에 서로 표시 / 한쪽 음소거 시 상대 패널 마이크 off / 바텀바 배지 = 실제 접속자 수.

---

## 완료된 항목 (참고)

- PR-2 — ① 방 목록 실시간 인원수 배지 (`roomCounts.ts`, `presence.ts`, commit `0ef72cf`)
- PR-3 — ② 스피커 링 (`SpeakerIndicators.tsx`, `useSpeakingPeers.tsx`, commit `60c6b0a`)
- RealtimeKit React 통합 정리 (selector 단일 참조, join await+isJoined, unmount leave, 팬텀 의존성, commit `cb28878`)
