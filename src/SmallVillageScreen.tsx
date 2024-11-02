import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "./supabaseClient";
import ExitButton from "./ExitButton";
import ChatInput from "./ChatInput";
import WebRTCCall from "./WebRTCCall";
import {
  CHANNEL_MESSAGE,
  Message,
  useMessage,
  MessageType,
  RECEIVER_ALL,
} from "./MessageContext";
import useOnlineUsers from "./hooks/useOnlineUsers";
import CallRequestModal from "./CallRequestModal";
import CallReceiveModal from "./CallReceiveModal";

interface User {
  user_id: string;
  character_index: number;
  user_name: string;
  x: number;
  y: number;
  last_active: string;
}

enum CallState {
  CALLING = "request",
  RINGING = "calling",
  INCALL = "incall",
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
const TABLE_USES = "users";
const NUM_CHARACTERS = 40;

const GAME_CONFIG = {
  SPRITE: {
    SCALE: 2,
    FRAME_WIDTH: 20,
    FRAME_HEIGHT: 32,
  },
  MOVEMENT: {
    SPEED: 2,
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
  private sprite: Phaser.GameObjects.Sprite | null = null;
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
  }

  async create() {
    this.cursors = this.input.keyboard?.createCursorKeys() || null;

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

    try {
      // 강제로 사용자 데이터를 업데이트
      await supabase.from(TABLE_USES).delete().match({ user_id: this.userId });
      await supabase.from(TABLE_USES).insert({
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
      .text(user.x, user.y + GAME_CONFIG.NAME.OFFSET_Y, user.user_name, {
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

    this.userSprites[user.user_id] = {
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
        await supabase.from(TABLE_USES).upsert({
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [callPartner, setCallPartner] = useState<User | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callState, setCallState] = useState<CallState | null>(null);
  const { sendMessage, addMessageHandler, removeMessageHandler } = useMessage();
  const [showCallRequestModal, setShowCallRequestModal] = useState(false);
  const [showCallReceiveModal, setShowCallReceiveModal] = useState(false);

  const getScene = (): SmallVillageScene | null => {
    return gameInstance.current?.scene.getScene(
      "SmallVillageScene"
    ) as SmallVillageScene | null;
  };

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from(TABLE_USES).delete().match({ user_id: userId });
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
    console.log("Sending heartbeat");
    // update last_active
    await supabase
      .from(TABLE_USES)
      .update({ last_active: new Date().toISOString() })
      .match({ user_id: userId });
  };

  useEffect(() => {
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from(TABLE_USES)
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
            .from(TABLE_USES)
            .delete()
            .match({ user_id: user.user_id });
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

    const usersChannelName = `realtime:public:${TABLE_USES}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE_USES },
        (payload) => {
          if (payload.new.user_id === userId) return;
          const scene = getScene();
          if (scene) {
            scene.updateUsers([...(scene.users || []), payload.new as User]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE_USES },
        (payload) => {
          if (payload.new.user_id === userId) return;
          const scene = getScene();
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
        { event: "DELETE", schema: "public", table: TABLE_USES },
        (payload) => {
          if (userId === payload.old.user_id) {
            // exit the game
            handleExit();
            return;
          }

          getScene()?.removeUser((payload.old as User).user_id);
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
      gameInstance.current?.destroy(true);
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
      if (callPartner?.user_id === userId) {
        setCallPartner(null);
        setCallState(null);
      }
    },
    [callPartner]
  );

  useOnlineUsers({ userId, onJoin: handleJoinUser, onLeave: handleLeaveUser });

  // 메시지 핸들러
  const handleMessage = useCallback((message: Message) => {
    const { sender_id, body, type } = message;
    if (type === MessageType.CHAT) {
      getScene()?.showChatMessage(sender_id, body as string);
    } else if (type === MessageType.REQUEST_CALL) {
      const user = JSON.parse(body as string);
      setCallState(CallState.RINGING);
      setCallPartner(user);
      setShowCallReceiveModal(true);
    } else if (type === MessageType.ACCEPT_CALL) {
      setCallState(CallState.INCALL);
      setShowCallRequestModal(false);
      setSelectedUser(null);
    } else if (type === MessageType.CLOSE_CALL) {
      console.log("Call closed.");
      setCallState(null);
      setShowCallRequestModal(false);
      setShowCallReceiveModal(false);
      setCallPartner(null);
      setSelectedUser(null);
    }
  }, []);

  useEffect(() => {
    addMessageHandler(CHANNEL_MESSAGE, handleMessage);
    return () => {
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
    };
  }, [addMessageHandler, removeMessageHandler, handleMessage]);

  const handleUserClick = useCallback((user: User) => {
    setSelectedUser(user);
    setShowCallRequestModal(true);
  }, []);

  useEffect(() => {
    const { innerWidth: width, innerHeight: height } = window;
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameContainer.current as HTMLDivElement,
      scene: new SmallVillageScene(handleUserClick),
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
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
  }, [characterIndex, characterName, userId, handleUserClick]);

  const handleExit = async () => {
    console.log("Exiting game");

    // delete user data from database
    await deleteUserDataFromDatebase();

    // call onExit function
    onExit();
  };

  // chat handling
  const sendChatMessage = (message: string) => {
    const payload: Message = {
      type: MessageType.CHAT,
      sender_id: userId,
      receiver_id: RECEIVER_ALL,
      body: message,
    };

    sendMessage(CHANNEL_MESSAGE, payload);
  };

  // call handling
  const handleCallRequest = () => {
    setCallState(CallState.CALLING);
    setCallPartner(selectedUser);
    setIsInitiator(true);

    const user = {
      user_id: userId,
      user_name: characterName,
    };

    const payload: Message = {
      type: MessageType.REQUEST_CALL,
      sender_id: userId,
      receiver_id: selectedUser!.user_id,
      body: JSON.stringify(user),
    };

    sendMessage(CHANNEL_MESSAGE, payload);
  };

  const handleCallClose = useCallback(() => {
    setCallPartner(null);
    setSelectedUser(null);
    setCallState(null);
    setShowCallRequestModal(false);
    setShowCallReceiveModal(false);
    setIsInitiator(false);

    if (callState) {
      const payload: Message = {
        type: MessageType.CLOSE_CALL,
        sender_id: userId,
        receiver_id: callPartner!.user_id,
        body: "",
      };
      sendMessage(CHANNEL_MESSAGE, payload);
    }
  }, [callPartner, callState, userId, sendMessage]);

  const handleCallAccept = () => {
    setCallState(CallState.INCALL);
    setShowCallReceiveModal(false);
    setSelectedUser(null);

    const payload: Message = {
      type: MessageType.ACCEPT_CALL,
      sender_id: userId,
      receiver_id: callPartner!.user_id,
      body: "",
    };
    sendMessage(CHANNEL_MESSAGE, payload);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 게임 화면 */}
      <div
        ref={gameContainer}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />

      {showCallRequestModal && (
        <CallRequestModal
          userName={selectedUser!.user_name}
          onRequestCall={handleCallRequest}
          onClose={handleCallClose}
        />
      )}

      {showCallReceiveModal && (
        <CallReceiveModal
          userName={callPartner?.user_name || ""}
          onAccept={handleCallAccept}
          onReject={handleCallClose}
        />
      )}

      {callState === CallState.INCALL && (
        <WebRTCCall
          userId={userId}
          partnerId={callPartner!.user_id}
          isInitiator={isInitiator}
          onEndCall={handleCallClose}
        />
      )}

      {/* 채팅 입력창 */}
      <ChatInput onMessage={sendChatMessage} />

      {/* 나가기 버튼 */}
      <ExitButton onClick={handleExit} />
    </div>
  );
};

export default memo(SmallVillageScreen);
