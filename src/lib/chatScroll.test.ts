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

import { isScrolledToBottom, SCROLL_STICK_THRESHOLD } from "./chatScroll";

// "최근 메시지로 이동" 버튼 / auto-stick 판정의 핵심 로직.
// 맨 아래에 붙어 있을 때만 새 메시지를 따라 내려가야 한다.
describe("isScrolledToBottom", () => {
  it("맨 아래에 정확히 닿아 있으면 true", () => {
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 800, clientHeight: 200 })
    ).toBe(true);
  });

  it(`threshold(기본 ${SCROLL_STICK_THRESHOLD}px) 이내면 붙어 있는 것으로 본다`, () => {
    // 남은 여백 = 1000 - 770 - 200 = 30px <= 50px
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 770, clientHeight: 200 })
    ).toBe(true);
  });

  it("threshold 를 넘게 위로 올라가 있으면 false (버튼 노출 대상)", () => {
    // 남은 여백 = 1000 - 700 - 200 = 100px > 50px
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 200 })
    ).toBe(false);
  });

  it("맨 위로 스크롤한 상태면 false", () => {
    expect(
      isScrolledToBottom({ scrollHeight: 1000, scrollTop: 0, clientHeight: 200 })
    ).toBe(false);
  });

  it("threshold 를 직접 넘길 수 있다", () => {
    const el = { scrollHeight: 1000, scrollTop: 700, clientHeight: 200 };
    expect(isScrolledToBottom(el, 50)).toBe(false);
    expect(isScrolledToBottom(el, 100)).toBe(true);
  });

  it("내용이 스크롤할 만큼 없으면(짧은 대화) 항상 맨 아래로 본다", () => {
    expect(
      isScrolledToBottom({ scrollHeight: 200, scrollTop: 0, clientHeight: 200 })
    ).toBe(true);
  });
});
