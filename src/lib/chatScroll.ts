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

// 이 픽셀 이내면 "맨 아래에 붙어 있다"고 보고 새 메시지를 자동으로 따라 내려간다.
export const SCROLL_STICK_THRESHOLD = 50;

/**
 * 스크롤 컨테이너가 맨 아래 근처(threshold 이내)에 있는지 판정한다.
 * "최근 메시지로 이동" 버튼 노출 / auto-stick 여부의 기준. DOM 없이 검증 가능하도록 순수 함수.
 */
export const isScrolledToBottom = (
  el: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">,
  threshold: number = SCROLL_STICK_THRESHOLD
): boolean => el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
