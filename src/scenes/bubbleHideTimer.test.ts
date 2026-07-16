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

// require 만 쓰고 top-level import/export 가 없으면 --isolatedModules 에서 global
// script 로 취급돼 빌드가 깨진다. 빈 export 로 모듈로 만든다.
export {};

// issue #24 재발 방지 테스트.
//
// 버그: 예전 씬은 말풍선 숨김 타이머를 씬 전역 단일 필드(speechBubbleHideTimer)로
// 공유했다. A가 말한 뒤 B가 말하면 A의 타이머를 remove() 하고 B용 타이머만 새로
// 걸어서 → A의 말풍선이 영영 사라지지 않았다.
//
// 수정: 타이머 소유권을 SpeechBubble 인스턴스별 hideTimer 로 옮겼다. 이 테스트는
// "한 버블의 display() 가 다른 버블의 타이머를 건드리지 않는다"는 소유권 규약을
// 검증한다.
//
// Phaser 실체(Container/Scene/Canvas)를 jest(jsdom)에서 온전히 띄우긴 어려우므로,
// (1) SpeechBubble.ts 의 `extends Phaser.GameObjects.Container` 가 모듈 로드 시점에
//     평가되도록 전역 Phaser 를 최소 mock 으로 먼저 심고,
// (2) 무거운 생성자를 우회해 Object.create 로 인스턴스를 만든 뒤 display()/destroy()
//     "실제 메서드"를 호출한다. (setText/setAlpha 는 인스턴스에 stub)

// extends 절이 모듈 로드 즉시 평가되므로, import(require) 전에 전역 Phaser 를 심는다.
// destroy 는 프로토타입 메서드여야 SpeechBubble.destroy() 의 super.destroy() 가 탄다.
class MockContainer {
  destroy(_fromScene?: boolean): void {
    // no-op; 테스트에서 jest.spyOn 으로 호출 여부만 관찰한다.
  }
}
(global as unknown as { Phaser: unknown }).Phaser = {
  GameObjects: { Container: MockContainer },
};

// require 는 hoist 되지 않아 위 전역 세팅 이후에 로드된다.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SpeechBubble } = require("./SpeechBubble");

// display()/destroy() 가 만지는 부분만 최소로 갖춘 가짜 버블을 만든다.
// (무거운 생성자·레이아웃을 우회하고 실제 메서드만 실행)
function makeBubble(scene: {
  time: { delayedCall: jest.Mock };
}): {
  bubble: any;
  setText: jest.Mock;
  setAlpha: jest.Mock;
} {
  const bubble = Object.create(SpeechBubble.prototype);
  bubble.scene = scene;
  bubble.active = true; // 살아있는 컨테이너 상태를 모사 (display() 의 early-return 가드 통과용)
  const setText = jest.fn();
  const setAlpha = jest.fn();
  bubble.setText = setText;
  bubble.setAlpha = setAlpha;
  return { bubble, setText, setAlpha };
}

// remove() 호출을 기록하는 가짜 TimerEvent, 그리고 예약된 콜백/지연을 노출하는
// delayedCall mock.
function makeScene() {
  const timers: Array<{
    remove: jest.Mock;
    callback: () => void;
    delay: number;
  }> = [];
  const delayedCall = jest.fn((delay: number, callback: () => void) => {
    const timer = { remove: jest.fn(), callback, delay };
    timers.push(timer);
    return timer;
  });
  return { scene: { time: { delayedCall } }, timers, delayedCall };
}

describe("SpeechBubble hide timer ownership (issue #24)", () => {
  it("does not remove another bubble's timer when a second bubble speaks", () => {
    const { scene, timers } = makeScene();

    const { bubble: bubbleA } = makeBubble(scene);
    const { bubble: bubbleB } = makeBubble(scene);

    bubbleA.display("A");
    const timerA = timers[0];

    bubbleB.display("B");
    const timerB = timers[1];

    // 핵심 단언: B가 말해도 A의 타이머는 살아있다(remove 되지 않음).
    // 예전 전역 공유 타이머였다면 여기서 timerA.remove 가 호출됐다.
    expect(timerA.remove).not.toHaveBeenCalled();
    expect(timerB.remove).not.toHaveBeenCalled();

    // 각 버블이 자기 타이머를 소유한다.
    expect(bubbleA.hideTimer).toBe(timerA);
    expect(bubbleB.hideTimer).toBe(timerB);
    expect(timerA).not.toBe(timerB);
  });

  it("schedules setAlpha(0) after 10s (default) for each bubble independently", () => {
    const { scene, timers, delayedCall } = makeScene();

    const { bubble: bubbleA, setAlpha: setAlphaA } = makeBubble(scene);
    const { bubble: bubbleB, setAlpha: setAlphaB } = makeBubble(scene);

    bubbleA.display("A");
    bubbleB.display("B");

    // 두 버블 각각 10초 지연으로 예약됐다.
    expect(delayedCall).toHaveBeenCalledTimes(2);
    expect(timers[0].delay).toBe(10000);
    expect(timers[1].delay).toBe(10000);

    // 표시 시 alpha=1.
    expect(setAlphaA).toHaveBeenCalledWith(1);
    expect(setAlphaB).toHaveBeenCalledWith(1);

    // 예약된 콜백이 발화하면 각 버블만 숨는다(setAlpha(0)).
    timers[0].callback();
    expect(setAlphaA).toHaveBeenLastCalledWith(0);
    expect(setAlphaB).not.toHaveBeenCalledWith(0);

    timers[1].callback();
    expect(setAlphaB).toHaveBeenLastCalledWith(0);
  });

  it("removes only its own previous timer when the same bubble speaks again", () => {
    const { scene, timers } = makeScene();

    const { bubble } = makeBubble(scene);

    bubble.display("first");
    const first = timers[0];

    bubble.display("second");
    const second = timers[1];

    // 같은 버블이 다시 말하면 자기 이전 타이머만 정리한다.
    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(second.remove).not.toHaveBeenCalled();
    expect(bubble.hideTimer).toBe(second);
  });

  it("clears the pending hide timer on destroy (no leak)", () => {
    const { scene, timers } = makeScene();

    const destroySpy = jest.spyOn(MockContainer.prototype, "destroy");

    const { bubble } = makeBubble(scene);
    bubble.display("bye");
    const timer = timers[0];

    bubble.destroy();

    // 타이머 정리 + Phaser Container.destroy 로 위임.
    expect(timer.remove).toHaveBeenCalledTimes(1);
    expect(bubble.hideTimer).toBeNull();
    expect(destroySpy).toHaveBeenCalled();

    destroySpy.mockRestore();
  });
});
