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

import React, { memo, useEffect, useRef, useState } from "react";
import SmallVillage from "../components/SmallVillage";
import { RoomProvider } from "../context/RoomContext";
import { RemoteParticipantsProvider } from "../context/RemoteParticipantsContext";
import SmallVillageScene from "../scenes/SmallVillageScene";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import { createRTKToken } from "../lib/supabaseFunctions";
import { roomExists } from "../lib/roomState";
import { useToast } from "../hooks/useToast";
import { pushEvent } from "../lib/analytics";
import { fetchRoomSize } from "../lib/roomSize";

import { Room } from "../types";
import BottomBar from "../components/BottomBar";
import { ANALYTICS_EVENTS, BOTTOM_BAR_HEIGHT } from "../constants";

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  room: Room;
  onExit: () => void;
}

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  room,
  onExit,
}: SmallVillageScreenProps) => {
  const [readyScene, setReadyScene] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<SmallVillageScene>();
  const [isJoined, setIsJoined] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient();
  // 게임 생성 effect 의 cleanup 은 최초 1회(roomValid 확정 시)만 실행되며 meeting
  // 이 아직 undefined 인 시점에 클로저가 고정된다. leave() 를 언마운트 시 부르려면
  // 항상 최신 meeting 을 가리키는 ref 가 필요하다.
  const meetingRef = useRef(meeting);
  // leave() 는 Exit 버튼(handleExit)과 언마운트 cleanup 양쪽에서 호출될 수 있다.
  // 한 세션당 한 번만 실제로 leave 하도록 가드한다(두 번째부터는 no-op).
  const leftRef = useRef(false);
  // 체류 시간(exit_room duration_sec) 계측용. READY 시점에 기록한다.
  const enteredAtRef = useRef<number | null>(null);
  // null = 확인 중, true = 존재, false = 없음(입장 불가 → 로비로)
  const [roomValid, setRoomValid] = useState<boolean | null>(null);
  const toast = useToast();

  useEffect(() => {
    meetingRef.current = meeting;
  }, [meeting]);

  // 미팅 leave 를 1회만 수행하는 헬퍼. 어느 경로로 불려도 중복 leave 를 막는다.
  const leaveOnce = () => {
    if (leftRef.current) return undefined;
    leftRef.current = true;
    // 퇴장의 모든 경로(handleExit·언마운트 cleanup)가 이 함수를 지나므로
    // 체류시간 계측은 여기 한 곳이면 충분하다(DRY).
    if (enteredAtRef.current !== null) {
      pushEvent(ANALYTICS_EVENTS.EXIT_ROOM, {
        room_id: room.id,
        duration_sec: Math.round((Date.now() - enteredAtRef.current) / 1000),
      });
    }
    return meetingRef.current?.leave();
  };

  // rooms 는 진실의 원천이다. 방이 없으면(이미 종료됐거나 목록이 오래됨) 입장하지
  // 않는다 — 그대로 게임을 켜면 users write 가 FK 위반(409)으로 쏟아진다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const exists = await roomExists(room.id);
      if (cancelled) return;
      if (!exists) {
        pushEvent(ANALYTICS_EVENTS.ROOM_NOT_FOUND, { room_id: room.id });
        toast.error("이미 종료된 방입니다.");
        onExit();
        return;
      }
      setRoomValid(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (roomValid !== true) return;
    const parent = gameContainerRef.current;
    if (!parent) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent,
      scene: SmallVillageScene,
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      backgroundColor: "#3a5a40",
      // 캔버스 크기는 뷰포트 전체가 아니라 게임 컨테이너(헤더 아래 영역) 기준으로 잡는다.
      // RESIZE 모드가 이후 부모 크기에 맞춰 자동 보정한다.
      width: parent.clientWidth,
      height: parent.clientHeight,
      scale: {
        // RESIZE keeps the canvas exactly the size of its parent container,
        // filling the viewport without letterboxing or bottom-crop.
        mode: Phaser.Scale.RESIZE,
      },
      render: {
        // 개발/테스트 환경에서만 WebGL 캔버스 스크린샷 캡처를 위해 보존.
        // 프로덕션에선 GPU/메모리 비용을 줄이기 위해 끈다.
        preserveDrawingBuffer:
          process.env.NODE_ENV !== "production",
      },
    };

    const game = new Phaser.Game(config);
    game.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      roomId: room.id,
      userId,
    });

    // READY 이후 3초 대기(씬 준비)와 무관하게 체류시간 측정 기준점은 READY
    // 직후 즉시 잡는다. 그래야 3초 미만 세션도 exit_room duration_sec 가
    // 정확히 잡히고 enter/exit 순서 역전이 생기지 않는다(B-3).
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    game.events.once(Phaser.Core.Events.READY, () => {
      enteredAtRef.current = Date.now();
      readyTimer = setTimeout(() => {
        setReadyScene(true);
        setScene(game.scene.getScene("SmallVillageScene") as SmallVillageScene);
        // room_size 는 presence 가 비동기라 0 일 수 있어 users 테이블에서 직접 센다(D4).
        fetchRoomSize(room.id).then((room_size) => {
          pushEvent(ANALYTICS_EVENTS.ENTER_ROOM, {
            room_id: room.id,
            character_index: characterIndex,
            room_size,
          });
        });
      }, 3_000);
    });

    return () => {
      // 언마운트가 READY 대기(3초) 중에 일어나도 타이머가 살아남지 않게 정리한다(B-2).
      if (readyTimer !== undefined) clearTimeout(readyTimer);
      game.destroy(true);
      // Exit 버튼(handleExit) 외의 경로로 언마운트돼도 미팅 세션을 정리한다.
      // await 는 하지 않고 실패는 로그만 남긴다. handleExit 이 이미 leave 했다면
      // leaveOnce 가 no-op 를 돌려주므로 중복 leave 는 발생하지 않는다.
      try {
        const leaving = leaveOnce();
        if (leaving) {
          leaving.catch((error) =>
            console.error("Error leaving meeting on unmount:", error)
          );
        }
      } catch (error) {
        console.error("Error leaving meeting on unmount:", error);
      }
    };
    // 게임 생성은 roomValid 확정 시 1회만 수행한다. leaveOnce 는 매 렌더 새로
    // 정의되지만 여기 넣으면 게임이 재생성되므로 의도적으로 의존성에서 제외한다.
  }, [characterIndex, characterName, userId, room.id, roomValid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (roomValid !== true) return;
    const joinRoom = async () => {
      try {
        // best-effort: 지원 브라우저에서만 마이크 권한 거부를 명시 계측한다(D8).
        // Permissions API 미지원('microphone' 미지원 포함)이면 조용히 skip —
        // 그 경우 거부는 아래 join 실패(voice_join_error)로만 잡힌다.
        if (navigator.permissions?.query) {
          try {
            const status = await navigator.permissions.query({
              name: "microphone" as PermissionName,
            });
            if (status.state === "denied") {
              pushEvent(ANALYTICS_EVENTS.MIC_PERMISSION_DENIED, {
                room_id: room.id,
              });
            }
          } catch {
            /* 'microphone' 미지원 브라우저 — 무시 */
          }
        }
        const token = await createRTKToken(room.id, userId, characterName);
        const initedMeeting = await initMeeting({
          authToken: token,
          defaults: {
            video: false,
            audio: true,
            mediaConfiguration: {
              audio: {
                echoCancellation: true,
                noiseSupression: true,
                autoGainControl: true,
              },
            },
          },
        });

        // initMeeting 이 재진입 등으로 undefined 를 리턴하면 join 을 건너뛴 채
        // joined 로 표시되는 상태 불일치가 생긴다. 명시적으로 실패 처리한다.
        if (!initedMeeting) throw new Error("initMeeting returned undefined");
        // initMeeting 성공 ≠ join 성공. join 이 resolve 된 뒤에만 isJoined 로 본다.
        await initedMeeting.join();
        pushEvent(ANALYTICS_EVENTS.VOICE_JOIN_SUCCESS, { room_id: room.id });
        setIsJoined(true);
      } catch (error) {
        console.error("Error joining room:", error);
        // error_msg 원문에는 내부 URL·토큰 조각·스택이 섞일 수 있어 GA4 로
        // 유출된다. dataLayer 에는 error_code 만 올리고, 원문은 개발모드
        // 콘솔로만 남긴다(운영 dataLayer 에는 절대 싣지 않는다).
        pushEvent(ANALYTICS_EVENTS.VOICE_JOIN_ERROR, {
          room_id: room.id,
          error_code: (error as { code?: string })?.code ?? "unknown",
        });
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "[voice_join_error]",
            error instanceof Error ? error.message : String(error)
          );
        }
        toast.error("음성 연결에 실패했습니다.");
      }
    };

    joinRoom();
    // toast 는 매 렌더 새 객체라 의존성에서 제외한다(join 은 1회성).
  }, [initMeeting, userId, characterName, room.id, roomValid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = async () => {
    console.log("Exiting game");

    try {
      await leaveOnce();
    } catch (error) {
      console.error("Error leaving meeting:", error);
    }

    // call onExit function
    onExit();
  };

  const isReady = readyScene && scene && isJoined;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
      {/* 게임 캔버스는 헤더 아래 ~ 하단 바(BottomBar) 위 영역만 채운다.
          하단 바가 캔버스를 덮으면 맵의 상/하 여백이 비대칭으로 보이므로 바 높이만큼 예약. */}
      <div
        ref={gameContainerRef}
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ bottom: BOTTOM_BAR_HEIGHT }}
      />
      <div className="absolute inset-0">
        {!isReady ? (
          <LoadingSpinner message="Strolling into the Small Village..." />
        ) : (
          <RealtimeKitProvider value={meeting}>
            <RoomProvider
              userId={userId}
              userName={characterName}
              roomId={room.id}
              roomTitle={room.title}
              characterIndex={characterIndex}
            >
              <RemoteParticipantsProvider>
                <SmallVillage
                  room={room}
                  userId={userId!}
                  characterIndex={characterIndex}
                  characterName={characterName}
                  scene={scene}
                  onExit={onExit}
                />
                <BottomBar onExit={handleExit} userId={userId} />
              </RemoteParticipantsProvider>
            </RoomProvider>
          </RealtimeKitProvider>
        )}
      </div>
    </div>
  );
};

export default memo(SmallVillageScreen);
