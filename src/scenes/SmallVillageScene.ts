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
import {
  NUM_CHARACTERS,
  POSITION_BROADCAST_INTERVAL_MS,
  REACTION_ANIMATION,
} from "../constants";
import { sendPosition, subscribePositions } from "../lib/positionChannel";
import { SpeechBubble } from "./SpeechBubble";

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

  // 떠오르는 리액션 이모지. 여러 개가 동시에 뜰 수 있어 배열로 관리한다.
  // 각 Text 는 소속 userId(`reactionUserId`)와 시작 시각(`reactionStart`)을 data 로 갖고,
  // update() 에서 해당 스프라이트를 매 프레임 따라가며 위로 떠오른다.
  private reactionEmojis: Phaser.GameObjects.Text[] = [];

  private roomId: string = "";
  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";
  private onUserClick: (user: User) => void;
  // rooms row 보장 + 최초 users 등록이 끝나기 전에는 이동 write 를 막는 플래그.
  // 초기화 중 움직이면 users write 가 rooms 보장보다 앞서 FK 위반(409)을 낼 수 있다.
  private ready: boolean = false;

  users: User[] = [];

  // 원격 유저의 최신 위치(broadcast 수신). updateOtherUsers 가 이 값으로 tween 하고,
  // 아직 broadcast 를 못 받은 유저는 roster(this.users)의 seed x/y 로 폴백한다.
  private remotePositions: Map<string, { x: number; y: number }> = new Map();
  // 위치 broadcast 스로틀용 마지막 송신 시각(ms).
  private lastPositionSentAt = 0;
  // 직전 프레임 이동 여부. 이동이 막 멈춘 프레임에 최종 위치를 1회 방송하기 위함.
  private wasMoving = false;
  // 위치 채널 구독 해제자. SHUTDOWN 에서 호출한다(React 밖이라 자동 정리가 안 됨).
  private unsubscribePositions?: () => void;

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

    // 위치 broadcast 구독 — 원격 유저 이동을 저지연으로 받아 remotePositions 에 반영.
    // 자기 위치는 자기 스프라이트(this.sprite)로 그리므로 무시한다.
    this.unsubscribePositions = subscribePositions(this.roomId, (p) => {
      if (p.id === this.userId) return;
      this.remotePositions.set(p.id, { x: p.x, y: p.y });
    });
    // 씬은 React 밖이라 game.destroy(true) 만으로는 채널이 안 닫힌다 → SHUTDOWN 에서 명시 해제.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribePositions?.();
      this.unsubscribePositions = undefined;
    });

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
   *
   * 위치(x,y)는 tween 이 아니라 update() 에서 매 프레임 스프라이트를 따라가며
   * 갱신한다(이름표/말풍선과 동일). 이동 중 리액션해도 머리에서 이탈하지 않는다.
   */
  showReaction(userId: string, emoji: string) {
    const sprite = this.getSprite(userId);
    if (!sprite) return;

    const emojiText = this.add
      .text(sprite.x, sprite.y + REACTION_ANIMATION.OFFSET_Y, emoji, {
        fontSize: REACTION_ANIMATION.FONT_SIZE,
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);

    emojiText.setData("reactionUserId", userId);
    emojiText.setData("reactionStart", this.time.now);

    this.reactionEmojis.push(emojiText);
  }

  /**
   * 떠오르는 리액션 이모지들을 매 프레임 갱신한다.
   *  - x,y 는 소속 스프라이트를 따라가며(이동 추적) OFFSET_Y 에서 위로 상승.
   *  - 경과에 따라 상승 offset + alpha 를 직접 계산해 tween 과 위치 추적이 충돌하지 않게 한다.
   *  - 애니메이션이 끝났거나 소속 유저가 사라지면 정리한다.
   */
  private updateReactionEmojis() {
    if (this.reactionEmojis.length === 0) return;

    const now = this.time.now;
    this.reactionEmojis = this.reactionEmojis.filter((emojiText) => {
      const userId = emojiText.getData("reactionUserId") as string;
      const startTime = emojiText.getData("reactionStart") as number;
      const sprite = this.getSprite(userId);

      const progress = Phaser.Math.Clamp(
        (now - startTime) / REACTION_ANIMATION.DURATION_MS,
        0,
        1
      );

      // 소속 스프라이트가 사라졌거나 애니메이션이 끝나면 제거한다.
      if (!sprite || progress >= 1) {
        emojiText.destroy();
        return false;
      }

      const eased = Phaser.Math.Easing.Sine.Out(progress);
      emojiText.setPosition(
        sprite.x,
        sprite.y + REACTION_ANIMATION.OFFSET_Y - REACTION_ANIMATION.RISE_DISTANCE * eased
      );
      emojiText.setAlpha(1 - progress);
      return true;
    });
  }

  private removeReactionEmojis(userId: string) {
    this.reactionEmojis = this.reactionEmojis.filter((emojiText) => {
      if (emojiText.getData("reactionUserId") === userId) {
        emojiText.destroy();
        return false;
      }
      return true;
    });
  }

  showChatMessage(userId: string, message: string) {
    // 버블 위치는 매 프레임 update()/updateOtherUsers() 에서 스프라이트 좌표로
    // 갱신되므로 여기서 setPosition 은 불필요하다. 각 버블이 자기 hideTimer 를
    // 소유하므로 동시 발화에도 서로의 타이머를 덮어쓰지 않는다.
    if (userId === this.userId) {
      this.speechBubble?.display(message);
    } else {
      this.userSprites[userId]?.speechBubble.display(message);
    }
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
      this.removeReactionEmojis(userId);

      delete this.userSprites[userId];
      // broadcast 로 쌓인 위치도 정리(누수 방지).
      this.remotePositions.delete(userId);
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
      // 캐릭터 정체성(character_index)은 roster 에서, 위치는 broadcast(remotePositions)에서.
      // 아직 broadcast 를 못 받은 유저는 roster 의 seed x/y 로 폴백한다 — tween target 과
      // walk 애니메이션 방향을 모두 이 단일 target 에서 파생해 seed/live 가 갈리지 않게 한다.
      const userData = this.users.find((u) => u.id === userId);
      if (userData) {
        const sprite = userSprite.sprite;
        const target = this.remotePositions.get(userId) ?? {
          x: userData.x,
          y: userData.y,
        };
        const distanceX = Math.abs(target.x - sprite.x);
        const distanceY = Math.abs(target.y - sprite.y);
        const characterIndex = userData.character_index;
        const currentAnimKey = sprite.anims.currentAnim?.key;

        if (distanceX > MIN_DISTANCE) {
          if (target.x < sprite.x) {
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
          if (target.y < sprite.y) {
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
          x: target.x,
          y: target.y,
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
      if (this.ready) {
        const now = Date.now();
        const x = Math.floor(this.sprite.x);
        const y = Math.floor(this.sprite.y);

        if (isMoving) {
          // 위치 broadcast(스로틀, fire-and-forget). 원격 클라이언트가 저지연으로 받는다.
          // DB 를 거치지 않으므로 upsert 실패와 무관하게 먼저 내보낸다.
          if (now - this.lastPositionSentAt >= POSITION_BROADCAST_INTERVAL_MS) {
            this.lastPositionSentAt = now;
            sendPosition(this.roomId, { id: this.userId, x, y });
          }

          // PR-1: DB upsert 경로는 아직 유지한다 — 공간오디오·늦은 입장자 seed 가
          // 아직 users 테이블에 의존하기 때문. PR-3 에서 매 프레임 upsert 를 제거한다.
          await upsertUserState({
            id: this.userId,
            name: this.characterName,
            character_index: this.characterIndex,
            room_id: this.roomId,
            x,
            y,
          });
        } else if (this.wasMoving) {
          // 이동이 막 멈춘 프레임: 정확한 최종 위치를 1회 방송한다(스로틀 무시).
          // updateOtherUsers 가 broadcast 위치를 tween 소스로 쓰므로, 마지막 위치를
          // 안 보내면 원격 스프라이트가 최대 한 스로틀 창만큼 어긋난 곳에 안착한다.
          this.lastPositionSentAt = now;
          sendPosition(this.roomId, { id: this.userId, x, y });
        }

        this.wasMoving = isMoving;
      }
    } catch (error) {
      console.error(error);
    }

    this.updateOtherUsers();

    // 발화 링을 각 스프라이트 발밑에 동기화(이름표 패턴과 동일).
    this.syncSpeakerRings();

    // 떠오르는 리액션 이모지를 스프라이트 머리 위에 동기화(이동 추적).
    this.updateReactionEmojis();
  }

  // 전체 로스터 스냅샷으로 원격 스프라이트를 동기화한다(단일 소스에서 매 변경마다 호출).
  // 목록에 새로 들어온 유저는 스프라이트 생성, 빠진 유저는 스프라이트 제거. self 는 제외.
  updateUsers(users: User[]) {
    this.users = users;
    const nextIds = new Set(users.map((u) => u.id));
    users.forEach((user) => {
      if (user.id === this.userId) {
        return;
      }
      if (!this.userSprites[user.id]) {
        this.addUserSprite(user);
      }
    });
    // 로스터에서 빠진 원격 유저의 스프라이트 정리.
    Object.keys(this.userSprites).forEach((id) => {
      if (!nextIds.has(id)) {
        this.removeUserSprite(id);
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
    this.remotePositions.clear();
  }
}
