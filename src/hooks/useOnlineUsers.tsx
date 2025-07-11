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

import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const CHANNEL_ONLINE_USERS = "online-users";

interface OnlineUser {
  user_id: string;
  online_at: string;
}

interface useOnlineUsersProps {
  roomId: string;
  userId: string;
  onJoin: (userId: string) => void;
  onLeave: (userId: string) => void;
}

export default function useOnlineUsers(props: useOnlineUsersProps) {
  const propsRef = useRef({
    onJoin: props.onJoin,
    onLeave: props.onLeave,
  });
  const channelName = `${CHANNEL_ONLINE_USERS}-${props.roomId}`;

  useEffect(() => {
    // props 업데이트
    propsRef.current = {
      onJoin: props.onJoin,
      onLeave: props.onLeave,
    };
  }, [props.userId, props.onJoin, props.onLeave]);

  useEffect(() => {
    // 현재 온라인 유저를 추적하는 presence 채널 구독
    const channelOnlineUsers = supabase
      .channel(channelName)
      .on("presence", { event: "sync" }, () => {
        // 현재 온라인인 모든 유저
        // const presenceState = channelOnlineUsers.presenceState();
      })
      .on(
        "presence",
        { event: "join" },
        ({
          key,
          newPresences,
        }: {
          key: string;
          newPresences: OnlineUser[];
        }) => {
          // 새로운 유저가 참여

          const newUsers = newPresences.map(({ user_id }) => user_id);
          newUsers.forEach((user_id) => {
            propsRef.current.onJoin(user_id);
          });
        }
      )
      .on(
        "presence",
        { event: "leave" },
        ({
          key,
          leftPresences,
        }: {
          key: string;
          leftPresences: OnlineUser[];
        }) => {
          // 유저가 나감
          leftPresences.forEach(({ user_id }) => {
            propsRef.current.onLeave(user_id);
          });
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // 현재 유저의 상태를 online으로 설정
          const data: OnlineUser = {
            user_id: props.userId,
            online_at: new Date().toISOString(),
          };
          await channelOnlineUsers.track(data);
        }
      });

    return () => {
      channelOnlineUsers.unsubscribe();
    };
  }, [props.userId, channelName]);

  return {};
}
