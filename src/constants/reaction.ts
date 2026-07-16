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

// 정적 이모지 목록 (이미지 에셋 최소화 — 유니코드 문자열)
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "😢"] as const;

// 스크린리더 친화적 라벨 맵. 버튼 aria-label 에 `reaction-❤️` 대신 사람이 읽는 문구를 쓴다.
export const REACTION_EMOJI_LABELS: Record<string, string> = {
  "👍": "React with thumbs up",
  "❤️": "React with heart",
  "😂": "React with laughing face",
  "🎉": "React with party popper",
  "😮": "React with surprised face",
  "😢": "React with crying face",
};

// 아바타 머리 위로 떠오르는 애니메이션 설정
export const REACTION_ANIMATION = {
  OFFSET_Y: -70, // 스프라이트 중심 기준 위로 띄우는 거리
  RISE_DISTANCE: 40, // 떠오르며 이동하는 픽셀
  DURATION_MS: 2000, // 표시 지속 시간
  FONT_SIZE: "32px",
} as const;
