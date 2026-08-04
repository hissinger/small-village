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
