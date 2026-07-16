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

// isolatedModules 대응: top-level export 로 모듈로 만든다.
export {};

// 회귀 방지 테스트: 말풍선 폭은 텍스트 크기에 맞춰 줄어들어야 한다(shrink-to-fit).
//
// 버그: SpeechBubble 분리 리팩터링에서 폭을
//   width = Math.max(originalWidth, bounds.width + margin)
// 로 바꾸면서 originalWidth(=200)가 사실상 "최소 폭"이 됐다. 그 탓에 "안녕" 같은
// 짧은 텍스트도 200px 폭 말풍선으로 길게 나왔다. originalWidth 는 wordWrap(줄바꿈)
// 기준 폭일 뿐 최소 폭이 아니다.
//
// 수정: width = bounds.width + margin 으로 되돌려 텍스트 폭을 따라간다.
// 이 테스트는 실제 updateLayout() 의 폭 계산을 mock scene 으로 구동해 검증한다.

// extends Phaser.GameObjects.Container 가 모듈 로드 시 평가되므로 전역 Phaser 를 먼저 심는다.
class MockContainer {}
(global as unknown as { Phaser: unknown }).Phaser = {
  GameObjects: { Container: MockContainer },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SpeechBubble } = require("./SpeechBubble");

const MARGIN = 18;

// updateLayout() 이 만지는 부분만 최소로 갖춘 가짜 버블을 만들고, setSize 로 전달된
// 최종 폭을 돌려준다.
function layoutWidthForTextBounds(boundsWidth: number): number {
  // scene.add.* 는 setOrigin 체이닝을 지원하는 스텁 객체를 반환한다.
  const gameObject = {
    setOrigin: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };
  const scene = {
    add: {
      tileSprite: jest.fn(() => ({ ...gameObject })),
      image: jest.fn(() => ({ ...gameObject })),
    },
  };

  const bubble = Object.create(SpeechBubble.prototype);
  bubble.scene = scene;
  bubble.originalWidth = 200;
  bubble.offsetY = 0;
  bubble.margin = MARGIN;
  bubble.borders = [];
  bubble.tail = { ...gameObject };
  bubble.textObject = {
    getBounds: () => ({ width: boundsWidth, height: 20 }),
    setY: jest.fn(),
  };
  // Container 메서드 스텁
  bubble.remove = jest.fn();
  bubble.add = jest.fn();
  let capturedWidth = 0;
  bubble.setSize = jest.fn((w: number) => {
    capturedWidth = w;
  });

  bubble.updateLayout();
  return capturedWidth;
}

describe("SpeechBubble width (shrink-to-fit)", () => {
  it("shrinks below originalWidth for short text (no forced 200px minimum)", () => {
    // 짧은 텍스트: 텍스트 폭 40 → 40 + margin. 200 으로 늘어나면 안 된다.
    expect(layoutWidthForTextBounds(40)).toBe(40 + MARGIN);
  });

  it("grows past originalWidth for long text", () => {
    expect(layoutWidthForTextBounds(300)).toBe(300 + MARGIN);
  });
});
