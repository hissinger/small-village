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

import React, { memo, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import Conference from "./Conference";
import SpeakerIndicators from "./SpeakerIndicators";
import {
  DATABASE_TABLES,
  HEARTBEAT_INTERVAL_MS,
  JOIN_TOAST_WARMUP_MS,
} from "../constants";
import SmallVillageScene from "../scenes/SmallVillageScene";
import { Room } from "../types";
import { useRemoteParticipants } from "../context/RoomParticipantsContext";
import { useChatMessage } from "../hooks/useChatMessage";
import { useReactionMessage, ReactionMessage } from "../hooks/useReactionMessage";
import { useToast } from "../hooks/useToast";

interface SmallVillageProps {
  room: Room;
  userId: string;
  characterIndex: number;
  characterName: string;
  scene: SmallVillageScene;
  onExit: () => void;
}

const SmallVillage: React.FC<SmallVillageProps> = ({ userId, scene }) => {
  const toast = useToast();

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from(DATABASE_TABLES.USERS).delete().match({ id: userId });
  }, [userId]);

  const handleBeforeUnload = useCallback(async () => {
    await deleteUserDataFromDatebase();
  }, [deleteUserDataFromDatebase]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
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

  // 방 로스터의 단일 소스(RoomParticipantsProvider)를 구독해 씬에 반영한다.
  // 씬 자체 fetch/GC/postgres 구독은 제거됐다 — 등장/이동/퇴장 모두 이 스냅샷으로 수렴한다.
  const remoteParticipants = useRemoteParticipants();

  // 입장 토스트: 워밍업 창이 지난 뒤 새로 등장한 원격 유저만 "입장"으로 본다.
  // (입장 직후엔 기존 접속자가 로스터에 한꺼번에 채워지므로 그때는 토스트하지 않는다.)
  const joinToastReadyRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const timer = setTimeout(() => {
      joinToastReadyRef.current = true;
    }, JOIN_TOAST_WARMUP_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scene.updateUsers(Array.from(remoteParticipants.values()));

    if (joinToastReadyRef.current) {
      remoteParticipants.forEach((user, id) => {
        if (!knownIdsRef.current.has(id)) {
          toast.show(`${user.name} has joined`);
        }
      });
    }
    knownIdsRef.current = new Set(remoteParticipants.keys());
  }, [remoteParticipants, scene, toast]);

  // chat handling
  const sendChatMessage = useCallback(
    (senderId: string, message: string) => {
      scene.showChatMessage(senderId, message);
    },
    [scene]
  );

  const chatMessage = useChatMessage();
  useEffect(() => {
    if (chatMessage) {
      const { sender_id: senderId, body: message } = chatMessage;
      sendChatMessage(senderId, message as string);
    }
  }, [chatMessage, sendChatMessage]);

  // reaction handling — 리액션은 동시다발이라 콜백으로 각 이벤트를 즉시 씬에 전달한다.
  const handleReaction = useCallback(
    (r: ReactionMessage) => {
      scene.showReaction(r.sender_id, r.emoji);
    },
    [scene]
  );
  useReactionMessage(handleReaction);

  return (
    <div className="relative w-full h-full">
      <div>
        <Conference userId={userId} />
      </div>
      <SpeakerIndicators scene={scene} />
    </div>
  );
};

export default memo(SmallVillage);
