import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "./supabaseClient";
import useOnlineUsers from "./hooks/useOnlineUsers";
import LoadingSpinner from "./LoadingSpinner";
import Conference from "./Conference";
import { DATABASE_TABLES } from "./constants";
import BottomBar from "./BottomBar";

interface User {
  id: string;
  character_index: number;
  name: string;
  x: number;
  y: number;
  last_active: string;
}

interface GameSceneConfig {
  characterIndex: number;
  characterName: string;
  userId: string;
  users: User[];
}

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  onExit: () => void;
}

const INACTIVE_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const NUM_CHARACTERS = 40;

const GAME_CONFIG = {
  SPRITE: {
    SCALE: 2,
    FRAME_WIDTH: 20,
    FRAME_HEIGHT: 32,
  },
  MOVEMENT: {
    SPEED: 160,
  },
  NAME: {
    OFFSET_Y: -50,
    FONT_SIZE: "16px",
    COLOR: "#fff",
    ALIGN: "center",
  },
  MESSAGE: {
    OFFSET_Y: -70,
    FONT_SIZE: "14px",
    COLOR: "#fff",
    ALIGN: "center",
  },
  ANIMATION: {
    FRAME_RATE: 3,
  },
} as const;

class SmallVillageScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private messageText: Phaser.GameObjects.Text | null = null;
  private userSprites: Record<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      nameText: Phaser.GameObjects.Text;
      messageText: Phaser.GameObjects.Text;
    }
  > = {};

  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";
  private onUserClick: (user: User) => void;

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
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const index = i.toString().padStart(3, "0");
      this.load.spritesheet(`character_${i}`, `/assets/${index}.png`, {
        frameWidth: GAME_CONFIG.SPRITE.FRAME_WIDTH,
        frameHeight: GAME_CONFIG.SPRITE.FRAME_HEIGHT,
      });
    }

    // map
    this.load.image("map", "/assets/tilesets/Serene_Village_32x32.png");
    this.load.tilemapTiledJSON("map", "/assets/tilemaps/default.json");
  }

  async create() {
    this.cursors = this.input.keyboard?.createCursorKeys() || null;

    // map
    const map = this.make.tilemap({
      key: "map",
      tileWidth: 32,
      tileHeight: 32,
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
    groundLayer.setScale(2, 2);
    const decoration0Layer = map.createLayer("decoration_0", tileset, 0, 0);
    if (!decoration0Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration0Layer.setScale(2, 2);
    const decoration1Layer = map.createLayer("decoration_1", tileset, 0, 0);
    if (!decoration1Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration1Layer.setScale(2, 2);
    const decoration2Layer = map.createLayer("decoration_2", tileset, 0, 0);
    if (!decoration2Layer) {
      console.error("Decoration layer is null");
      return;
    }
    decoration2Layer.setScale(2, 2);

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
        }
      )
      .setOrigin(0.5, 0.5);

    this.messageText = this.add
      .text(this.sprite.x, this.sprite.y + GAME_CONFIG.MESSAGE.OFFSET_Y, "", {
        fontSize: GAME_CONFIG.MESSAGE.FONT_SIZE,
        color: GAME_CONFIG.MESSAGE.COLOR,
        align: GAME_CONFIG.MESSAGE.ALIGN,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    decoration0Layer.setCollisionByProperty({ collides: true });
    decoration1Layer.setCollisionByProperty({ collides: true });
    decoration2Layer.setCollisionByProperty({ collides: true });

    this.physics.add.collider(this.sprite, decoration0Layer);
    this.physics.add.collider(this.sprite, decoration1Layer);
    this.physics.add.collider(this.sprite, decoration2Layer);

    // const debugGraphics = this.add.graphics().setAlpha(0.75);
    // decoration0Layer.renderDebug(debugGraphics, {
    //   tileColor: null,
    //   collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
    //   faceColor: new Phaser.Display.Color(40, 39, 37, 255),
    // });
    // decoration1Layer.renderDebug(debugGraphics, {
    //   tileColor: null,
    //   collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
    //   faceColor: new Phaser.Display.Color(40, 39, 37, 255),
    // });
    // decoration2Layer.renderDebug(debugGraphics, {
    //   tileColor: null,
    //   collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
    //   faceColor: new Phaser.Display.Color(40, 39, 37, 255),
    // });

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

  // 채팅 메시지를 캐릭터 위에 표시
  showChatMessage(userId: string, message: string) {
    if (userId === this.userId) {
      if (this.sprite && this.messageText) {
        this.setMessage(this.sprite, this.messageText, message);
      }
    } else {
      const userSprite = this.userSprites[userId];
      if (userSprite) {
        const { messageText, sprite } = userSprite;
        this.setMessage(sprite, messageText, message);
      }
    }
  }

  setMessage(
    sprite: Phaser.GameObjects.Sprite,
    messageText: Phaser.GameObjects.Text,
    message: string
  ) {
    messageText.setText(message).setAlpha(1); // 메시지 설정 및 표시
    messageText.setPosition(sprite.x, sprite.y + GAME_CONFIG.MESSAGE.OFFSET_Y); // 캐릭터 위에 위치 설정

    // 10초 후 메시지 숨기기
    this.time.delayedCall(10000, () => {
      messageText.setAlpha(0); // 메시지 숨기기
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
      })
      .setOrigin(0.5, 0.5);

    const messageText = this.add
      .text(user.x, user.y + GAME_CONFIG.MESSAGE.OFFSET_Y, "", {
        fontSize: GAME_CONFIG.MESSAGE.FONT_SIZE,
        color: GAME_CONFIG.MESSAGE.COLOR,
        align: GAME_CONFIG.MESSAGE.ALIGN,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0); // 처음엔 투명하게 설정

    this.userSprites[user.id] = {
      sprite: userSprite,
      nameText,
      messageText,
    };
  }

  removeUserSprite(userId: string) {
    const userSprite = this.userSprites[userId];
    if (userSprite) {
      userSprite.nameText.destroy();
      userSprite.sprite.destroy();
      userSprite.messageText?.destroy();

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
            const messageText = userSprite.messageText;
            if (messageText) {
              messageText.setPosition(
                sprite.x,
                sprite.y + GAME_CONFIG.MESSAGE.OFFSET_Y
              );
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

    if (this.messageText) {
      this.messageText.setPosition(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.MESSAGE.OFFSET_Y
      );
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

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  onExit,
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [callPartner, setCallPartner] = useState<User | null>(null);
  const [readyScene, setReadyScene] = useState(false);

  const getScene = (): SmallVillageScene | null => {
    return gameInstanceRef.current?.scene.getScene(
      "SmallVillageScene"
    ) as SmallVillageScene | null;
  };

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from(DATABASE_TABLES.USERS).delete().match({ id: userId });
  }, [userId]);

  const handleResize = useCallback(() => {
    const { innerWidth, innerHeight } = window;

    if (gameInstanceRef.current) {
      gameInstanceRef.current.scale.resize(innerWidth, innerHeight);
      const scene = gameInstanceRef.current.scene.getScene("SmallVillageScene");
      scene?.cameras.main.setBounds(0, 0, innerWidth, innerHeight);
    }
  }, []);

  const handleBeforeUnload = useCallback(async () => {
    await deleteUserDataFromDatebase();
  }, [deleteUserDataFromDatebase]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("resize", handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendHeartbeat = async () => {
    // update last_active
    await supabase
      .from(DATABASE_TABLES.USERS)
      .update({ last_active: new Date().toISOString() })
      .match({ id: userId });
  };

  useEffect(() => {
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from(DATABASE_TABLES.USERS)
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        // 10초 이상 활동하지 않은 유저 삭제
        const users = data || [];
        const now = new Date();
        const usersToDelete = users.filter(
          (user: User) =>
            new Date(user.last_active) <
            new Date(now.getTime() - INACTIVE_TIMEOUT_MS)
        );
        // db에서 삭제
        usersToDelete.forEach(async (user: User) => {
          await supabase
            .from(DATABASE_TABLES.USERS)
            .delete()
            .match({ id: user.id });
        });

        // 10초 이내 활동한 유저들만 추출
        const onlineUsers = users.filter(
          (user: User) =>
            new Date(user.last_active) >
            new Date(now.getTime() - INACTIVE_TIMEOUT_MS)
        );
        // scene에 유저 추가
        getScene()?.updateUsers(onlineUsers);
      });

    const usersChannelName = `realtime:public:${DATABASE_TABLES.USERS}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id === userId) return;
          const scene = getScene();
          if (scene) {
            scene.updateUsers([...(scene.users || []), payload.new as User]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id === userId) return;
          const scene = getScene();
          if (scene) {
            const prevUsers = scene.users;
            const updatedUsers = prevUsers.map((user) =>
              user.id === payload.new.id ? (payload.new as User) : user
            );
            scene.updateUsers(updatedUsers);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (userId === payload.old.id) {
            // exit the game
            handleExit();
            return;
          }

          getScene()?.removeUser((payload.old as User).id);
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
      gameInstanceRef.current?.destroy(true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 온라인 유저가 들어왔을 때
  const handleJoinUser = useCallback((userId: string) => {
    console.log(`User ${userId} joined.`);
  }, []);

  // 온라인 유저가 나갔을 때
  const handleLeaveUser = useCallback(
    (userId: string) => {
      console.log(`User ${userId} left.`);
      getScene()?.removeUser(userId);

      // 통화 중인 유저가 나갔을 때
      if (callPartner?.id === userId) {
        setCallPartner(null);
      }
    },
    [callPartner]
  );

  useOnlineUsers({ userId, onJoin: handleJoinUser, onLeave: handleLeaveUser });

  useEffect(() => {
    const { innerWidth: width, innerHeight: height } = window;
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameContainerRef.current as HTMLDivElement,
      scene: SmallVillageScene,
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
    };

    gameInstanceRef.current = new Phaser.Game(config);
    gameInstanceRef.current.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      userId,
    });

    gameInstanceRef.current.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => {
        setReadyScene(true);
      }, 3_000);
    });

    return () => {
      gameInstanceRef.current?.destroy(true);
    };
  }, [characterIndex, characterName, userId]);

  const handleExit = async () => {
    console.log("Exiting game");

    // delete user data from database
    await deleteUserDataFromDatebase();

    // call onExit function
    onExit();
  };

  // chat handling
  const sendChatMessage = (senderId: string, message: string) => {
    getScene()?.showChatMessage(senderId, message);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={gameContainerRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          visibility: readyScene ? "visible" : "hidden",
        }}
      />
      {!readyScene ? (
        <LoadingSpinner message="Strolling into the Small Village..." />
      ) : (
        <div>
          <BottomBar
            onExit={handleExit}
            userId={userId}
            onMessage={sendChatMessage}
          />
          <Conference userId={userId} />
        </div>
      )}
    </div>
  );
};

export default memo(SmallVillageScreen);
