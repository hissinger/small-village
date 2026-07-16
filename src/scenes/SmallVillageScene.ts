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
import { upsertUserState } from "../lib/userState";
import { NUM_CHARACTERS, REACTION_ANIMATION } from "../constants";

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
  // 발화 표시 링(스피커 링): 캐릭터 발밑의 반투명 초록 타원. 발화 중 pulsing.
  RING: {
    OFFSET_Y: 30, // 스프라이트 중심 기준 발밑으로 내리는 값
    WIDTH: 48,
    HEIGHT: 24,
    COLOR: 0x22c55e,
    ALPHA: 0.45,
    PULSE_SCALE: 1.15,
    PULSE_DURATION: 600,
  },
} as const;

interface GameSceneConfig {
  characterIndex: number;
  characterName: string;
  roomId: string;
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
  private mapWidth: number = 0;
  private mapHeight: number = 0;
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

  // 발화 링: userId(로컬 포함) → 타원 GameObject + pulsing tween. lazy 생성.
  // ring/tween 을 한 엔트리로 묶어 생성·정리·삭제가 한 곳에서만 일어나게 한다.
  private speakerRings: Record<
    string,
    { ring: Phaser.GameObjects.Ellipse; tween?: Phaser.Tweens.Tween }
  > = {};

  private roomId: string = "";
  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";
  private onUserClick: (user: User) => void;
  private speechBubbleHideTimer: Phaser.Time.TimerEvent | null = null;
  // rooms row 보장 + 최초 users 등록이 끝나기 전에는 이동 write 를 막는 플래그.
  // 초기화 중 움직이면 users write 가 rooms 보장보다 앞서 FK 위반(409)을 낼 수 있다.
  private ready: boolean = false;

  users: User[] = [];

  constructor(onUserClick: (user: User) => void) {
    super({ key: "SmallVillageScene" });
    this.onUserClick = onUserClick;
  }

  init(data: GameSceneConfig) {
    this.characterIndex = data.characterIndex;
    this.characterName = data.characterName;
    this.roomId = data.roomId;
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

    const width = GAME_CONFIG.LAYER.TILE_WIDTH * map.width * GAME_CONFIG.LAYER.SCALE;
    const height = GAME_CONFIG.LAYER.TILE_HEIGHT * map.height * GAME_CONFIG.LAYER.SCALE;
    // 물리/충돌은 맵 크기 기준으로 유지해 캐릭터가 맵 밖으로 나가지 못하게 한다.
    this.physics.world.setBounds(0, 0, width, height);
    const cam = this.cameras.main;
    cam.setBackgroundColor("#3a5a40");

    this.sprite = this.physics.add
      .sprite(width / 2, height / 2, `character_${this.characterIndex}`, 0)
      .setScale(GAME_CONFIG.SPRITE.SCALE)
      .setCollideWorldBounds(true)
      .setOrigin(0.5, 0.5);

    // 카메라는 startFollow/ setBounds 대신 update() 의 positionCamera() 에서
    // 축별로 수동 제어한다. (setBounds + follow 는 맵보다 뷰포트가 넓은 축에서
    // 스크롤이 0 으로 클램프돼 맵이 한쪽에 붙는 문제가 있다.)
    this.mapWidth = width;
    this.mapHeight = height;
    this.positionCamera();

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
      // 초기 사용자 데이터 등록. 같은 id(localStorage uuid) row 가 이미
      // 있을 수 있으므로(재접속·이전 세션·StrictMode 이중 마운트 등) insert 대신
      // upsert 로 멱등하게 쓴다. insert + 선행 delete 는 비원자적이라 레이스 시
      // PK 충돌(409)이 났다. 이동 동기화(update)도 동일하게 upsert 를 쓴다.
      await upsertUserState({
        id: this.userId,
        name: this.characterName,
        character_index: this.characterIndex,
        room_id: this.roomId,
        x: Math.floor(this.sprite.x),
        y: Math.floor(this.sprite.y),
      });
    } catch (error) {
      console.error(error);
    }

    // rooms 보장 + 최초 등록이 끝났으니 이제 이동 write 를 허용한다.
    this.ready = true;

    this.createAnimations();
  }

  // userId 로 스프라이트를 찾는다(로컬은 this.sprite, 원격은 userSprites). 없으면 undefined.
  private getSprite(userId: string): Phaser.GameObjects.Sprite | undefined {
    return userId === this.userId
      ? this.sprite ?? undefined
      : this.userSprites[userId]?.sprite;
  }

  /**
   * 발화 표시 링을 켜고 끈다. 대상 스프라이트가 아직 없으면 no-op.
   *  - 링은 userId 별 최초 1회 lazy 생성(발밑, 스프라이트보다 한 단계 뒤).
   *  - speaking=true → 보이기 + pulsing tween, false → 숨김 + tween 정지.
   */
  setSpeaking(userId: string, speaking: boolean) {
    const sprite = this.getSprite(userId);
    if (!sprite) return;

    // off 는 항상 on 이후에만 오므로, speaking=false 인데 링이 없으면 만들 필요가 없다.
    let ring = this.speakerRings[userId]?.ring;
    if (!speaking && !ring) return;

    if (!ring) {
      ring = this.add
        .ellipse(
          sprite.x,
          sprite.y + GAME_CONFIG.RING.OFFSET_Y,
          GAME_CONFIG.RING.WIDTH,
          GAME_CONFIG.RING.HEIGHT,
          GAME_CONFIG.RING.COLOR,
          GAME_CONFIG.RING.ALPHA
        )
        .setVisible(false);
      // 스프라이트와 같은 depth(0) 로 두되 표시목록에서 스프라이트 바로 뒤로 보낸다.
      // ground 레이어(depth 0, 먼저 삽입됨) 위·캐릭터 아래에 그려지게 한다.
      ring.setDepth(sprite.depth);
      this.children.moveBelow(ring, sprite);
      this.speakerRings[userId] = { ring };
    }

    const entry = this.speakerRings[userId];
    if (speaking) {
      ring.setVisible(true);
      if (!entry.tween) {
        entry.tween = this.tweens.add({
          targets: ring,
          scaleX: GAME_CONFIG.RING.PULSE_SCALE,
          scaleY: GAME_CONFIG.RING.PULSE_SCALE,
          duration: GAME_CONFIG.RING.PULSE_DURATION,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else {
      ring.setVisible(false);
      if (entry.tween) {
        entry.tween.stop();
        entry.tween = undefined;
      }
      ring.setScale(1);
    }
  }

  private syncSpeakerRings() {
    Object.entries(this.speakerRings).forEach(([userId, { ring }]) => {
      const sprite = this.getSprite(userId);
      if (sprite) {
        ring.setPosition(sprite.x, sprite.y + GAME_CONFIG.RING.OFFSET_Y);
      }
    });
  }

  private removeSpeakerRing(userId: string) {
    const entry = this.speakerRings[userId];
    if (entry) {
      entry.tween?.stop();
      entry.ring.destroy();
      delete this.speakerRings[userId];
    }
  }

  /**
   * 수신한 emoji 를 아바타 머리 위로 떠오르며 사라지게 표시한다.
   * self/remote 스프라이트 모두 getSprite 로 매칭한다. 대상이 없으면 no-op.
   * 여러 번 눌리면 emoji 가 누적 떠오르며, 소멸형이라 메모리 누수는 없다.
   */
  showReaction(userId: string, emoji: string) {
    const sprite = this.getSprite(userId);
    if (!sprite) return;

    const startY = sprite.y + REACTION_ANIMATION.OFFSET_Y;
    const emojiText = this.add
      .text(sprite.x, startY, emoji, {
        fontSize: REACTION_ANIMATION.FONT_SIZE,
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);

    this.tweens.add({
      targets: emojiText,
      y: startY - REACTION_ANIMATION.RISE_DISTANCE,
      alpha: 0,
      duration: REACTION_ANIMATION.DURATION_MS,
      ease: "Sine.easeOut",
      onComplete: () => emojiText.destroy(),
    });
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
      this.removeSpeakerRing(userId);

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

  /**
   * 카메라 스크롤을 X/Y 축별로 갱신한다(axisScroll 참고).
   * 매 프레임 재계산되므로 뷰포트 리사이즈에도 별도 핸들러가 필요 없다.
   */
  private positionCamera(): void {
    if (!this.sprite) return;

    const cam = this.cameras.main;
    cam.scrollX = this.axisScroll(this.mapWidth, cam.width, this.sprite.x);
    cam.scrollY = this.axisScroll(this.mapHeight, cam.height, this.sprite.y);
  }

  /**
   * 한 축의 카메라 스크롤 값을 계산한다.
   *  - 맵이 뷰포트보다 작거나 같으면: 중앙 정렬(음수 스크롤 → 양쪽 여백은 배경색).
   *  - 맵이 더 크면: 대상 위치를 따라가되 맵 경계로 클램프한다.
   */
  private axisScroll(mapSize: number, viewSize: number, target: number): number {
    return mapSize <= viewSize
      ? (mapSize - viewSize) / 2
      : Phaser.Math.Clamp(target - viewSize / 2, 0, mapSize - viewSize);
  }

  async update() {
    if (!this.sprite || !this.cursors) return;

    const isMoving = this.handleMovement();

    this.positionCamera();

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
      // 최초 등록(create)이 끝나기 전에는 이동 write 를 보내지 않는다. 초기화 중
      // 움직이면 write 가 create 보다 앞서 나가 레이스로 409 를 낼 수 있다.
      if (isMoving && this.ready) {
        await upsertUserState({
          id: this.userId,
          name: this.characterName,
          character_index: this.characterIndex,
          room_id: this.roomId,
          x: Math.floor(this.sprite.x),
          y: Math.floor(this.sprite.y),
        });
      }
    } catch (error) {
      console.error(error);
    }

    this.updateOtherUsers();

    // 발화 링을 각 스프라이트 발밑에 동기화(이름표 패턴과 동일).
    this.syncSpeakerRings();
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
