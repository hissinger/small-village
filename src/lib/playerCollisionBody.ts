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

export type PlayerCollisionBody = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export type PlayerCollisionFootprint = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Top-down 캐릭터는 몸 전체가 아니라 발밑만 월드와 충돌한다.
 * 그래야 책상·의자 등받이 뒤로 들어갈 때 스프라이트가 자연스럽게 겹친다.
 */
export function getPlayerCollisionBody(
  frameWidth: number,
  frameHeight: number
): PlayerCollisionBody {
  const width = Math.round(frameWidth * 0.5);
  const height = Math.round(frameHeight * 0.25);

  return {
    width,
    height,
    offsetX: Math.round((frameWidth - width) / 2),
    offsetY: frameHeight - height,
  };
}

/**
 * 스프라이트 중심을 원점으로 한 실제 충돌 바디를 맵 원본 px 좌표로 환산한다.
 * 정적 맵 감사가 Phaser 런타임과 같은 크기·오프셋을 사용하도록 하는 단일 계산식이다.
 */
export function getPlayerCollisionFootprint(
  frameWidth: number,
  frameHeight: number,
  spriteScale: number,
  mapScale: number
): PlayerCollisionFootprint {
  const body = getPlayerCollisionBody(frameWidth, frameHeight);
  const scale = spriteScale / mapScale;

  return {
    x: (body.offsetX - frameWidth / 2) * scale,
    y: (body.offsetY - frameHeight / 2) * scale,
    width: body.width * scale,
    height: body.height * scale,
  };
}

/** 캐릭터와 가구의 앞뒤 정렬은 스프라이트 중심이 아니라 발끝으로 판단한다. */
export function getPlayerSortY(
  spriteY: number,
  displayHeight: number
): number {
  return spriteY + displayHeight / 2;
}

/** 플레이어에 붙는 링 같은 오브젝트를 동적으로 변하는 스프라이트 depth에 맞춘다. */
export function syncPlayerCompanionDepth(
  companion: { setDepth: (depth: number) => unknown },
  sprite: { depth: number }
): void {
  companion.setDepth(sprite.depth);
}
