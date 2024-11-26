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

import { NUM_CHARACTERS } from "../constants";

export default class CharacterPreviewScene extends Phaser.Scene {
  private currentIndex = 0;
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super({ key: "CharacterPreviewScene" });
  }

  preload() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const index = i.toString().padStart(3, "0");
      this.load.spritesheet(
        `character_${i}`,
        `/assets/characters/${index}.png`,
        {
          frameWidth: 20,
          frameHeight: 32,
        }
      );
    }
  }

  create() {
    this.createAnimations();
    this.showCharacter(this.currentIndex);
  }
  private createAnimations() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      // 각 캐릭터에 대한 애니메이션 정의 (위쪽 방향 걷기)
      this.anims.create({
        key: `walk_${i}`,
        frames: this.anims.generateFrameNumbers(`character_${i}`, {
          start: 0, // 각 캐릭터의 첫 번째 프레임 인덱스
          end: 2, // 세 번째 프레임까지 사용 (0, 1, 2)
        }),
        frameRate: 3, // 초당 프레임 수
        repeat: -1, // 무한 반복
      });
    }
  }

  updateCharacter(index: number) {
    this.currentIndex = index;
    this.showCharacter(this.currentIndex);
  }

  private showCharacter(index: number) {
    if (this.sprite) {
      this.sprite.destroy();
    }

    this.sprite = this.add.sprite(60, 50, `character_${index}`, 0);
    this.sprite.setScale(2);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite.play(`walk_${index}`); // 애니메이션 실행
  }
}
