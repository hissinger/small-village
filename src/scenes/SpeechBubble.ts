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

export class SpeechBubble extends Phaser.GameObjects.Container {
  private textObject: Phaser.GameObjects.Text;
  private borders: (Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image)[];
  private tail: Phaser.GameObjects.Image;
  private originalWidth: number;
  private offsetY: number;
  private margin: number;
  // 이 말풍선 전용 숨김 타이머. 씬 전역 공유 필드가 아니라 버블마다 따로 소유해서,
  // 동시에 여러 명이 발화해도 서로의 타이머를 덮어쓰지 않는다(그러면 먼저 뜬
  // 말풍선이 영영 안 사라지는 버그가 났다).
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    offsetY: number,
    text: string,
    textStyle: Phaser.Types.GameObjects.Text.TextStyle = {}
  ) {
    super(scene, x, y);

    this.originalWidth = width;
    this.offsetY = offsetY;
    this.margin = 18;

    // Add this container to the scene
    scene.add.existing(this);

    // Default text style
    const defaultTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: "16px",
      color: "#111111",
      wordWrap: {
        width: width - this.margin,
        useAdvancedWrap: true,
      },
      align: "left",
    };

    // Merge user-defined style with default style
    const finalTextStyle = { ...defaultTextStyle, ...textStyle };

    // Create plain text
    this.textObject = scene.add.text(12, 4, text, finalTextStyle);

    // Initialize borders and tail
    this.borders = [];
    this.tail = scene.add
      .image(this.margin, 14 + this.offsetY, "bubble-tail")
      .setOrigin(0.5, 1);

    // Calculate and update the layout
    this.updateLayout();

    // Add text and tail to the container
    this.add(this.tail);
    this.add(this.textObject);

    this.setInteractive();
  }

  /**
   * Updates the text of the speech bubble.
   * @param newText The new text to display.
   */
  setText(newText: string): SpeechBubble {
    // Update the text
    this.textObject.setText(newText);

    // Recalculate layout and reposition the speech bubble
    this.updateLayout();

    this.add(this.tail);
    this.add(this.textObject);

    return this;
  }

  /**
   * 말풍선에 텍스트를 띄우고, durationMs 뒤 자동으로 숨긴다.
   * 타이머는 이 버블만의 hideTimer 라서, 다른 버블이 발화해도 서로 간섭하지 않는다.
   * @param text 표시할 텍스트
   * @param durationMs 표시 유지 시간(ms). 기본 10초.
   */
  display(text: string, durationMs = 10000): void {
    // 이 버블의 이전 타이머만 정리한다(전역 공유 아님).
    if (this.hideTimer) {
      this.hideTimer.remove();
    }

    this.setText(text);
    this.setAlpha(1);

    this.hideTimer = this.scene.time.delayedCall(durationMs, () => {
      this.setAlpha(0);
    });
  }

  /**
   * 컨테이너 정리 시 예약된 숨김 타이머도 같이 제거해 leak 을 막는다.
   */
  destroy(fromScene?: boolean): void {
    if (this.hideTimer) {
      this.hideTimer.remove();
      this.hideTimer = null;
    }
    super.destroy(fromScene);
  }

  /**
   * Updates the layout, recalculates bounds, and adjusts borders and size.
   */
  private updateLayout(): void {
    // Remove previous tail
    this.remove(this.tail);

    // Remove previous text object
    this.remove(this.textObject);

    // Remove previous borders
    this.borders.forEach((border) => border.destroy());
    this.borders = [];

    // Calculate bounds
    const bounds = this.textObject.getBounds();
    let width = this.originalWidth;
    let height = this.margin;

    if (bounds.width + this.margin > width) {
      width = bounds.width + this.margin;
    }

    if (bounds.width + this.margin < width) {
      width = bounds.width + this.margin;
    }

    if (bounds.height + 14 > height) {
      height = bounds.height + 14;
    }

    const adjustedY = this.offsetY - height;

    // Adjust the container's y position to expand upwards
    this.textObject.setY(adjustedY + 4);

    // Create new borders
    this.borders = [
      // Center tile
      this.scene.add.tileSprite(
        width / 2,
        adjustedY + height / 2,
        width - this.margin,
        height - this.margin,
        "bubble-border",
        4
      ),

      // Top-left corner
      this.scene.add.image(0, adjustedY, "bubble-border", 0).setOrigin(0, 0),
      // Top-right corner
      this.scene.add
        .image(width, adjustedY, "bubble-border", 2)
        .setOrigin(1, 0),
      // Bottom-right corner
      this.scene.add
        .image(width, adjustedY + height, "bubble-border", 8)
        .setOrigin(1, 1),
      // Bottom-left corner
      this.scene.add
        .image(0, adjustedY + height, "bubble-border", 6)
        .setOrigin(0, 1),
      // Top edge
      this.scene.add
        .tileSprite(9, adjustedY, width - this.margin, 9, "bubble-border", 1)
        .setOrigin(0, 0),
      // Bottom edge
      this.scene.add
        .tileSprite(
          9,
          adjustedY + height,
          width - this.margin,
          9,
          "bubble-border",
          7
        )
        .setOrigin(0, 1),
      // Left edge
      this.scene.add
        .tileSprite(
          0,
          adjustedY + 9,
          9,
          height - this.margin,
          "bubble-border",
          3
        )
        .setOrigin(0, 0),
      // Right edge
      this.scene.add
        .tileSprite(
          width,
          adjustedY + 9,
          9,
          height - this.margin,
          "bubble-border",
          5
        )
        .setOrigin(1, 0),
    ];

    // Add new borders to the container
    this.borders.forEach((border) => this.add(border));

    // Update container size
    this.setSize(width, height);
  }
}
