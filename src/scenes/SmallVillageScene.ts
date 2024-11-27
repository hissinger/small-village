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

import { User } from "../types";
import { supabase } from "../supabaseClient";
import { DATABASE_TABLES, NUM_CHARACTERS } from "../constants";

const GAME_CONFIG = {
  SPRITE: {
    SCALE: 2.5,
    FRAME_WIDTH: 20,
    FRAME_HEIGHT: 32,
  },
  LAYER: {
    TILE_WIDTH: 32,
    TILE_HEIGHT: 32,
    SCALE: 2,
  },
  MOVEMENT: {
    SPEED: 160,
  },
  NAME: {
    OFFSET_Y: -50,
    FONT_SIZE: "16px",
    COLOR: "#fff",
    ALIGN: "center",
    STROKE: "#000000",
    STROKE_THICKNESS: 3,
  },
  MESSAGE: {
    OFFSET_Y: -50,
    FONT_SIZE: "14px",
    COLOR: "#fff",
    ALIGN: "center",
    STROKE: "#000000",
    STROKE_THICKNESS: 3,
  },
  ANIMATION: {
    FRAME_RATE: 3,
  },
} as const;

interface GameSceneConfig {
  characterIndex: number;
  characterName: string;
  userId: string;
  users: User[];
}

class SpeechBubble extends Phaser.GameObjects.Container {
  private textObject: Phaser.GameObjects.Text;
  private borders: (Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image)[];
  private tail: Phaser.GameObjects.Image;
  private originalWidth: number;
  private offsetY: number;
  private margin: number;

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

export default class SmallVillageScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private speechBubble: SpeechBubble | null = null;
  private userSprites: Record<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      nameText: Phaser.GameObjects.Text;
      speechBubble: SpeechBubble;
    }
  > = {};

  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";
  private onUserClick: (user: User) => void;
  private speechBubbleHideTimer: Phaser.Time.TimerEvent | null = null;

  users: User[] = [];

  constructor(onUserClick: (user: User) => void) {
    super({ key: "SmallVillageScene" });
    this.onUserClick = onUserClick;
  }

  init(data: GameSceneConfig) {
    this.characterIndex = data.characterIndex;
    this.characterName = data.characterName;
    this.userId = data.userId;
    this.users = data.users || [];
  }

  preload() {
    // character sprites
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const index = i.toString().padStart(3, "0");
      this.load.spritesheet(
        `character_${i}`,
        `/assets/characters/${index}.png`,
        {
          frameWidth: GAME_CONFIG.SPRITE.FRAME_WIDTH,
          frameHeight: GAME_CONFIG.SPRITE.FRAME_HEIGHT,
        }
      );
    }

    // speech bubble
    this.load.spritesheet("bubble-border", "/assets/bubble/bubble-border.png", {
      frameWidth: 9,
      frameHeight: 9,
    });
    this.load.image("bubble-tail", "/assets/bubble/bubble-tail.png");

    // map
    this.load.image("map", "/assets/tilesets/Serene_Village_32x32.png");
    this.load.tilemapTiledJSON("map", "/assets/tilemaps/default.json");
  }

  async create() {
    this.cursors = this.input.keyboard?.createCursorKeys() || null;

    // map
    const map = this.make.tilemap({
      key: "map",
      tileWidth: GAME_CONFIG.LAYER.TILE_WIDTH,
      tileHeight: GAME_CONFIG.LAYER.TILE_HEIGHT,
    });
    const tileset = map.addTilesetImage("Serene_Village_32x32", "map");
    if (!tileset) {
      console.error("Tileset is null");
      return;
    }

    const groundLayer = map.createLayer("ground", tileset, 0, 0);
    if (!groundLayer) {
      console.error("Ground layer is null");
      return;
    }
    groundLayer.setScale(GAME_CONFIG.LAYER.SCALE);

    const decoration0Layer = map.createLayer("decoration_0", tileset, 0, 0);
    if (!decoration0Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration0Layer.setScale(GAME_CONFIG.LAYER.SCALE);

    const decoration1Layer = map.createLayer("decoration_1", tileset, 0, 0);
    if (!decoration1Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration1Layer.setScale(GAME_CONFIG.LAYER.SCALE);

    const decoration2Layer = map.createLayer("decoration_2", tileset, 0, 0);
    if (!decoration2Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration2Layer.setScale(GAME_CONFIG.LAYER.SCALE);

    const above0Layer = map.createLayer("above_0", tileset, 0, 0);
    if (!above0Layer) {
      console.error("Above layer is null");
      return;
    }
    above0Layer.setScale(GAME_CONFIG.LAYER.SCALE);
    above0Layer.setDepth(10);

    const above1Layer = map.createLayer("above_1", tileset, 0, 0);
    if (!above1Layer) {
      console.error("Above layer is null");
      return;
    }
    above1Layer.setScale(GAME_CONFIG.LAYER.SCALE);
    above1Layer.setDepth(11);

    const { innerWidth: width, innerHeight: height } = window;
    this.cameras.main.setBounds(0, 0, width, height);
    this.physics.world.setBounds(0, 0, width, height);

    this.sprite = this.physics.add
      .sprite(width / 2, height / 2, `character_${this.characterIndex}`, 0)
      .setScale(GAME_CONFIG.SPRITE.SCALE)
      .setCollideWorldBounds(true)
      .setOrigin(0.5, 0.5);

    this.nameText = this.add
      .text(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.NAME.OFFSET_Y,
        this.characterName,
        {
          fontSize: GAME_CONFIG.NAME.FONT_SIZE,
          color: GAME_CONFIG.NAME.COLOR,
          align: GAME_CONFIG.NAME.ALIGN,
          stroke: GAME_CONFIG.NAME.STROKE,
          strokeThickness: GAME_CONFIG.NAME.STROKE_THICKNESS,
        }
      )
      .setOrigin(0.5, 0.5);

    decoration0Layer.setCollisionByProperty({ collides: true });
    decoration1Layer.setCollisionByProperty({ collides: true });
    decoration2Layer.setCollisionByProperty({ collides: true });

    this.physics.add.collider(this.sprite, decoration0Layer);
    this.physics.add.collider(this.sprite, decoration1Layer);
    this.physics.add.collider(this.sprite, decoration2Layer);

    this.speechBubble = new SpeechBubble(
      this,
      this.sprite.x,
      this.sprite.y,
      200,
      GAME_CONFIG.MESSAGE.OFFSET_Y,
      ""
    )
      .setAlpha(0)
      .setDepth(12);

    try {
      // 강제로 사용자 데이터를 업데이트
      await supabase
        .from(DATABASE_TABLES.USERS)
        .delete()
        .match({ id: this.userId });
      await supabase.from(DATABASE_TABLES.USERS).insert({
        id: this.userId,
        name: this.characterName,
        character_index: this.characterIndex,
        x: Math.floor(this.sprite.x),
        y: Math.floor(this.sprite.y),
      });
    } catch (error) {
      console.error(error);
    }

    this.createAnimations();
  }

  showChatMessage(userId: string, message: string) {
    if (userId === this.userId) {
      if (this.sprite && this.speechBubble) {
        this.setMessage(this.sprite, this.speechBubble, message);
      }
    } else {
      const userSprite = this.userSprites[userId];
      if (userSprite) {
        const { sprite, speechBubble } = userSprite;
        this.setMessage(sprite, speechBubble, message);
      }
    }
  }

  setMessage(
    sprite: Phaser.GameObjects.Sprite,
    speechBubble: SpeechBubble,
    message: string
  ) {
    if (this.speechBubbleHideTimer) {
      this.speechBubbleHideTimer.remove();
    }

    speechBubble.setText(message).setAlpha(1);
    speechBubble.setPosition(sprite.x, sprite.y);

    this.speechBubbleHideTimer = this.time.delayedCall(10000, () => {
      speechBubble.setAlpha(0);
    });
  }

  addUserSprite(user: User) {
    const userSprite = this.physics.add.sprite(
      user.x,
      user.y,
      `character_${user.character_index}`,
      0
    );
    userSprite.setScale(GAME_CONFIG.SPRITE.SCALE);
    userSprite.setOrigin(0.5, 0.5);

    // 클릭 이벤트 추가
    userSprite.setInteractive().on("pointerdown", () => {
      this.onUserClick(user);
    });

    const nameText = this.add
      .text(user.x, user.y + GAME_CONFIG.NAME.OFFSET_Y, user.name, {
        fontSize: GAME_CONFIG.NAME.FONT_SIZE,
        color: GAME_CONFIG.NAME.COLOR,
        align: GAME_CONFIG.NAME.ALIGN,
        stroke: GAME_CONFIG.NAME.STROKE,
        strokeThickness: GAME_CONFIG.NAME.STROKE_THICKNESS,
      })
      .setOrigin(0.5, 0.5);

    this.userSprites[user.id] = {
      sprite: userSprite,
      nameText,
      speechBubble: new SpeechBubble(
        this,
        user.x,
        user.y,
        200,
        GAME_CONFIG.MESSAGE.OFFSET_Y,
        ""
      )
        .setAlpha(0)
        .setDepth(12),
    };
  }

  removeUserSprite(userId: string) {
    const userSprite = this.userSprites[userId];
    if (userSprite) {
      userSprite.nameText.destroy();
      userSprite.sprite.destroy();
      userSprite.speechBubble.destroy();

      delete this.userSprites[userId];
    }
  }

  createAnimations() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      this.createWalkAnimation(i, `walk_down_${i}`, 0, 3);
      this.createWalkAnimation(i, `walk_left_${i}`, 3, 3);
      this.createWalkAnimation(i, `walk_right_${i}`, 6, 3);
      this.createWalkAnimation(i, `walk_up_${i}`, 9, 3);
    }
  }

  createWalkAnimation(
    characterIndex: number,
    key: string,
    startFrame: number,
    frameCount: number
  ): void {
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(`character_${characterIndex}`, {
        start: startFrame,
        end: startFrame + frameCount - 1,
      }),
      frameRate: GAME_CONFIG.ANIMATION.FRAME_RATE,
      repeat: -1,
    });
  }

  private handleMovement(): boolean {
    if (!this.sprite || !this.cursors) return false;

    let isMoving = false;

    this.sprite.setVelocity(0);

    if (this.cursors.left?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_left_${this.characterIndex}`, true);
      this.sprite.setVelocityX(-GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.right?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_right_${this.characterIndex}`, true);
      this.sprite.setVelocityX(GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.up?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_up_${this.characterIndex}`, true);
      this.sprite.setVelocityY(-GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.down?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_down_${this.characterIndex}`, true);
      this.sprite.setVelocityY(GAME_CONFIG.MOVEMENT.SPEED);
    } else {
      this.sprite.anims.stop();
    }

    return isMoving;
  }

  private updateOtherUsers() {
    const MIN_DISTANCE = 2;

    Object.entries(this.userSprites).forEach(([userId, userSprite]) => {
      let isMoving = false;
      const userData = this.users.find((u) => u.id === userId);
      if (userData) {
        const sprite = userSprite.sprite;
        const distanceX = Math.abs(userData.x - sprite.x);
        const distanceY = Math.abs(userData.y - sprite.y);
        const characterIndex = userData.character_index;
        const currentAnimKey = sprite.anims.currentAnim?.key;

        if (distanceX > MIN_DISTANCE) {
          if (userData.x < sprite.x) {
            isMoving = true;
            sprite.play(`walk_left_${characterIndex}`, true);
          } else {
            isMoving = true;
            if (currentAnimKey !== `walk_right_${characterIndex}`) {
              sprite.play(`walk_right_${characterIndex}`, true);
            }
          }
        }

        if (distanceY > MIN_DISTANCE) {
          if (userData.y < sprite.y) {
            isMoving = true;
            sprite.play(`walk_up_${characterIndex}`, true);
          } else {
            isMoving = true;
            sprite.play(`walk_down_${characterIndex}`, true);
          }
        }

        if (!isMoving) {
          sprite.anims.stop();
        }

        this.tweens.add({
          targets: sprite,
          x: userData.x,
          y: userData.y,
          duration: 100,
          ease: "Linear",
          onUpdate: () => {
            const nameText = userSprite.nameText;
            if (nameText) {
              nameText.setPosition(
                sprite.x,
                sprite.y + GAME_CONFIG.NAME.OFFSET_Y
              );
            }

            const speechBubble = userSprite.speechBubble;
            if (speechBubble) {
              speechBubble.setPosition(sprite.x, sprite.y);
            }
          },
        });
      }
    });
  }

  async update() {
    if (!this.sprite || !this.cursors) return;

    const isMoving = this.handleMovement();

    if (this.nameText) {
      this.nameText.setPosition(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.NAME.OFFSET_Y
      );
    }

    if (this.speechBubble) {
      this.speechBubble.setPosition(this.sprite.x, this.sprite.y);
    }

    try {
      if (isMoving) {
        await supabase.from(DATABASE_TABLES.USERS).upsert({
          id: this.userId,
          name: this.characterName,
          character_index: this.characterIndex,
          x: Math.floor(this.sprite.x),
          y: Math.floor(this.sprite.y),
        });
      }
    } catch (error) {
      console.error(error);
    }

    this.updateOtherUsers();
  }

  updateUsers(users: User[]) {
    this.users = users;
    users.forEach((user) => {
      if (user.id === this.userId) {
        return;
      }
      if (!this.userSprites[user.id]) {
        this.addUserSprite(user);
      }
    });
  }

  removeUser(userId: string) {
    this.removeUserSprite(userId);
  }

  remoeAllUsers() {
    Object.values(this.userSprites).forEach((userSprite) => {
      userSprite.sprite.destroy();
      userSprite.nameText.destroy();
    });
    this.userSprites = {};
  }
}
