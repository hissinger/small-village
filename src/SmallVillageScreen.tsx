import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "./supabaseClient";

interface User {
  user_id: string;
  character_index: number;
  user_name: string;
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

const GAME_CONFIG = {
  SPRITE: {
    SCALE: 4,
    FRAME_WIDTH: 16,
    FRAME_HEIGHT: 16,
  },
  MOVEMENT: {
    SPEED: 2,
  },
  TEXT: {
    NAME_OFFSET_Y: -50,
    FONT_SIZE: "16px",
    COLOR: "#fff",
  },
  ANIMATION: {
    FRAME_RATE: 5,
  },
} as const;

class SmallVillageScene extends Phaser.Scene {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private userSprites: Record<
    string,
    { sprite: Phaser.GameObjects.Sprite; nameText: Phaser.GameObjects.Text }
  > = {};

  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";

  users: User[] = [];

  constructor() {
    super({ key: "SmallVillageScene" });
  }

  init(data: GameSceneConfig) {
    this.characterIndex = data.characterIndex;
    this.characterName = data.characterName;
    this.userId = data.userId;
    this.users = data.users || [];
  }

  preload() {
    this.load.spritesheet("characters", "/assets/characters.png", {
      frameWidth: GAME_CONFIG.SPRITE.FRAME_WIDTH,
      frameHeight: GAME_CONFIG.SPRITE.FRAME_HEIGHT,
    });
  }

  async create() {
    this.cursors = this.input.keyboard?.createCursorKeys() || null;

    const { innerWidth: width, innerHeight: height } = window;
    this.cameras.main.setBounds(0, 0, width, height);
    this.physics.world.setBounds(0, 0, width, height);

    const frameIndex = this.characterIndex * 3;
    this.sprite = this.physics.add
      .sprite(width / 2, height / 2, "characters", frameIndex)
      .setScale(GAME_CONFIG.SPRITE.SCALE)
      .setCollideWorldBounds(true)
      .setOrigin(0.5, 0.5);

    this.nameText = this.add
      .text(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.TEXT.NAME_OFFSET_Y,
        this.characterName,
        {
          fontSize: GAME_CONFIG.TEXT.FONT_SIZE,
          color: GAME_CONFIG.TEXT.COLOR,
          align: "center",
        }
      )
      .setOrigin(0.5, 0.5);

    this.userSprites[this.userId] = {
      sprite: this.sprite,
      nameText: this.nameText,
    };

    try {
      await supabase.from("users").insert({
        user_id: this.userId,
        user_name: this.characterName,
        character_index: this.characterIndex,
        x: Math.floor(this.sprite.x),
        y: Math.floor(this.sprite.y),
      });
    } catch (error) {
      console.error(error);
    }

    this.createAnimations();
  }

  addUserSprite(user: User) {
    const userSprite = this.physics.add.sprite(
      user.x,
      user.y,
      "characters",
      user.character_index * 3
    );
    userSprite.setScale(GAME_CONFIG.SPRITE.SCALE);
    userSprite.setOrigin(0.5, 0.5);

    const nameText = this.add
      .text(user.x, user.y + GAME_CONFIG.TEXT.NAME_OFFSET_Y, user.user_name, {
        fontSize: GAME_CONFIG.TEXT.FONT_SIZE,
        color: GAME_CONFIG.TEXT.COLOR,
        align: "center",
      })
      .setOrigin(0.5, 0.5);

    this.userSprites[user.user_id] = { sprite: userSprite, nameText };
  }

  removeUserSprite(userId: string) {
    const userSprite = this.userSprites[userId];
    if (userSprite) {
      userSprite.nameText.destroy();
      userSprite.sprite.destroy();

      delete this.userSprites[userId];
    }
  }

  createAnimations() {
    for (let i = 0; i < 3; i++) {
      const baseFrame = 3 * i;

      this.createWalkAnimation(`walk_down_${i}`, baseFrame, 3);
      this.createWalkAnimation(`walk_left_${i}`, baseFrame + 12, 3);
      this.createWalkAnimation(`walk_right_${i}`, baseFrame + 24, 3);
      this.createWalkAnimation(`walk_up_${i}`, baseFrame + 36, 3);
    }
  }

  createWalkAnimation(
    key: string,
    startFrame: number,
    frameCount: number
  ): void {
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers("characters", {
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

    if (this.cursors.left?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_left_${this.characterIndex}`, true);
      this.sprite.x -= GAME_CONFIG.MOVEMENT.SPEED;
    } else if (this.cursors.right?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_right_${this.characterIndex}`, true);
      this.sprite.x += GAME_CONFIG.MOVEMENT.SPEED;
    } else if (this.cursors.up?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_up_${this.characterIndex}`, true);
      this.sprite.y -= GAME_CONFIG.MOVEMENT.SPEED;
    } else if (this.cursors.down?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_down_${this.characterIndex}`, true);
      this.sprite.y += GAME_CONFIG.MOVEMENT.SPEED;
    } else {
      this.sprite.anims.stop();
    }

    return isMoving;
  }

  private updateOtherUsers() {
    const MIN_DISTANCE = 2;

    Object.entries(this.userSprites).forEach(([userId, userSprite]) => {
      let isMoving = false;
      const userData = this.users.find((u) => u.user_id === userId);
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

        const nameText = this.children.list.find(
          (child) =>
            child instanceof Phaser.GameObjects.Text &&
            child.text === userData.user_name
        ) as Phaser.GameObjects.Text;

        this.tweens.add({
          targets: sprite,
          x: userData.x,
          y: userData.y,
          duration: 100,
          ease: "Linear",
          onUpdate: () => {
            if (nameText) {
              nameText.setPosition(
                sprite.x,
                sprite.y + GAME_CONFIG.TEXT.NAME_OFFSET_Y
              );
            }
          },
        });
      }
    });
  }

  async update() {
    if (!this.sprite || !this.cursors) return;

    if (this.nameText) {
      this.nameText.setPosition(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.TEXT.NAME_OFFSET_Y
      );
    }

    const isMoving = this.handleMovement();

    try {
      if (isMoving) {
        await supabase.from("users").upsert({
          user_id: this.userId,
          user_name: this.characterName,
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
      if (user.user_id === this.userId) {
        return;
      }
      if (!this.userSprites[user.user_id]) {
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
  const gameContainer = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const [chatMessage, setChatMessage] = useState("");

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from("users").delete().match({ user_id: userId });
  }, [userId]);

  const handleResize = useCallback(() => {
    const { innerWidth, innerHeight } = window;

    if (gameInstance.current) {
      gameInstance.current.scale.resize(innerWidth, innerHeight);
      const scene = gameInstance.current.scene.getScene("SmallVillageScene");
      scene?.cameras.main.setBounds(0, 0, innerWidth, innerHeight);
    }
  }, []);

  const handleBeforeUnload = useCallback(async () => {
    await deleteUserDataFromDatebase();
  }, []);

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
      .from("users")
      .update({ last_active: new Date().toISOString() })
      .match({ user_id: userId });
  };

  useEffect(() => {
    const interval = setInterval(sendHeartbeat, 10_1000);
    return () => {
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from("users")
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
            new Date(user.last_active) < new Date(now.getTime() - 10_000)
        );
        // db에서 삭제
        usersToDelete.forEach(async (user: User) => {
          await supabase
            .from("users")
            .delete()
            .match({ user_id: user.user_id });
        });

        // 10초 이내 활동한 유저들만 추출
        const onlineUsers = users.filter(
          (user: User) =>
            new Date(user.last_active) > new Date(now.getTime() - 10_000)
        );
        // scene에 유저 추가
        const scene = gameInstance.current?.scene.getScene(
          "SmallVillageScene"
        ) as SmallVillageScene;
        if (scene) {
          scene.updateUsers(onlineUsers);
        }
      });

    supabase
      .channel("realtime:public:users")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "users" },
        (payload) => {
          if (payload.new.user_id === userId) return;
          const scene = gameInstance.current?.scene.getScene(
            "SmallVillageScene"
          ) as SmallVillageScene;
          if (scene) {
            scene.updateUsers([...(scene.users || []), payload.new as User]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        (payload) => {
          if (payload.new.user_id === userId) return;
          const scene = gameInstance.current?.scene.getScene(
            "SmallVillageScene"
          ) as SmallVillageScene;
          if (scene) {
            const prevUsers = scene.users;
            const updatedUsers = prevUsers.map((user) =>
              user.user_id === payload.new.user_id
                ? (payload.new as User)
                : user
            );
            scene.updateUsers(updatedUsers);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "users" },
        (payload) => {
          const scene = gameInstance.current?.scene.getScene(
            "SmallVillageScene"
          ) as SmallVillageScene;
          if (scene) {
            scene.removeUser(
              (payload.old as User).user_id || payload.old.user_id
            );
          }
        }
      )
      .subscribe();

    // 현재 온라인 유저를 추적하는 presence 채널 구독
    const channel = supabase
      .channel("online-users")
      .on("presence", { event: "sync" }, () => {
        // 현재 온라인인 모든 유저
        const presenceState = channel.presenceState();
        console.log("Sync:", presenceState);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        // 새로운 유저가 참여
        console.log("Join:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        // 유저가 나감
        console.log("Leave:", leftPresences);
      });

    // presence 상태 추적 시작
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // 현재 유저의 상태를 online으로 설정
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      console.log("Unsubscribing from the channel.");
      supabase.removeAllChannels();
      gameInstance.current?.destroy(true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { innerWidth: width, innerHeight: height } = window;
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameContainer.current as HTMLDivElement,
      scene: SmallVillageScene,
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
        },
      },
    };

    gameInstance.current = new Phaser.Game(config);
    gameInstance.current.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      userId,
    });

    return () => {
      gameInstance.current?.destroy(true);
    };
  }, [characterIndex, characterName, userId]);

  const handleSendChat = () => {
    // if (chatMessage.trim()) {
    //   console.log(`Sent message: ${chatMessage}`); // 채팅 메시지 처리
    //   setChatMessage(""); // 입력 초기화
    // }
  };

  const handleExit = async () => {
    console.log("User exited the game.");

    // delete user data from database
    await deleteUserDataFromDatebase();

    // call onExit function
    onExit();
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={gameContainer}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />

      {/* 채팅 입력창 */}
      <div
        style={{
          position: "absolute",
          bottom: 80, // 하단과의 간격 조정
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          width: "80%",
          maxWidth: 600,
        }}
      >
        <input
          type="text"
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder="Enter your message..."
          style={{
            flex: 1,
            padding: "10px",
            fontSize: "16px",
            borderRadius: "5px 0 0 5px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={handleSendChat}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            borderRadius: "0 5px 5px 0",
            border: "none",
            backgroundColor: "#4CAF50",
            color: "white",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>

      {/* 나가기 버튼 */}
      <button
        onClick={handleExit}
        style={{
          position: "absolute",
          bottom: 80, // 하단과의 간격 조정
          right: 20, // 오른쪽과의 간격 조정
          padding: "10px 20px",
          fontSize: "16px",
          borderRadius: "5px",
          border: "none",
          backgroundColor: "#f44336",
          color: "white",
          cursor: "pointer",
        }}
      >
        Exit
      </button>
    </div>
  );
};

export default memo(SmallVillageScreen);
