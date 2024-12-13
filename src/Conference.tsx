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

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { DATABASE_TABLES } from "./constants";
import { PeerStream, PeerTrack } from "./services/Peer";
import { useRoomContext } from "./context/RoomContext";
import { useSessions } from "./hooks/useSessions";
import { Session } from "./types";

interface Track {
  sessionId: string;
  audioStream: MediaStream;
}

interface ConferenceProps {
  userId: string;
}

interface AudioPlayerProps {
  audioStream: MediaStream;
  sessionId: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioStream,
  sessionId,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = audioStream;
    }
  }, [audioStream]);

  return <audio ref={audioRef} autoPlay playsInline key={sessionId} />;
};

export default function Conference({ userId }: ConferenceProps) {
  const { peer, isReady, getLocalAudioTrack } = useRoomContext();
  const [tracks, setTracks] = useState<Track[]>([]);

  const handleTrack = (stream: PeerStream) => {
    if (stream.kind === "audio") {
      setTracks((prev) => {
        return [
          ...prev,
          {
            sessionId: stream.sessionId || "",
            audioStream: stream.stream,
          },
        ];
      });
    } else if (stream.kind === "video") {
      // not implemented
    }
  };

  const handleRemoveTrack = (stream: PeerStream) => {
    if (stream.kind === "audio") {
      setTracks((prev) => {
        return prev.filter((track) => track.sessionId !== stream.sessionId);
      });
    }
  };

  const fetchSessions = async (userId: string): Promise<Session[]> => {
    const sessions: Session[] = [];

    // get remote tracks except for the current user
    const { data, error } = await supabase
      .from(DATABASE_TABLES.SESSIONS)
      .select("*")
      .neq("user_id", userId);

    if (error) {
      console.error("Error fetching sessions:", error);
      return sessions;
    }

    sessions.push(...(data as Session[]));
    return sessions;
  };

  const insertSession = async (userId: string, tracks: PeerTrack[]) => {
    const { error } = await supabase.from(DATABASE_TABLES.SESSIONS).insert({
      user_id: userId,
      tracks: tracks,
      id: peer?.sessionId,
    });

    if (error) {
      console.error("Insert Session Error:", error);
      throw error;
    }
  };

  // listen to changes in sessions table
  const handleJoinUser = useCallback(
    (session: Session) => {
      peer?.pullRemoteTracks(session.id, session.tracks);
    },
    [peer]
  );

  const handleLeaveUser = useCallback(
    (session: Session) => {
      peer?.closeTracks(session.id);
    },
    [peer]
  );

  useSessions({
    userId,
    onJoin: handleJoinUser,
    onLeave: handleLeaveUser,
  });

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const init = async () => {
      peer?.on("track", handleTrack);
      peer?.on("removeTrack", handleRemoveTrack);

      try {
        // add local tracks
        const track = getLocalAudioTrack();
        peer?.addLocalTracks(track);

        // push local tracks and insert session to db
        const localTracks = await peer!.pushLocalTracks();
        if (!localTracks || localTracks.length === 0) {
          return;
        }

        await insertSession(userId, localTracks);
      } catch (error) {
        console.error("Error adding local tracks:", error);
      }

      // fetch remote tracks from db and pull remote tracks
      const sessions = await fetchSessions(userId);
      for (const session of sessions) {
        await peer?.pullRemoteTracks(session.id, session.tracks);
      }
    };

    init();
  }, [userId, isReady, peer, getLocalAudioTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {tracks.map((track) => (
        <AudioPlayer
          key={track.sessionId}
          audioStream={track.audioStream}
          sessionId={track.sessionId}
        />
      ))}
    </>
  );
}
