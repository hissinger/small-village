import { useEffect, useRef, useState } from "react";
import { useLocalStream } from "./context/LocalStreamContext";
import { supabase } from "./supabaseClient";
import { DATABASE_TABLES } from "./constants";
import Peer, { PeerStream, PeerTrack } from "./services/Peer";

interface Session {
  id: string;
  tracks: PeerTrack[];
  user_id: string;
}

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
  const peerRef = useRef<Peer>(new Peer());
  const { localAudioStream } = useLocalStream();
  const [isInitialized, setIsInitialized] = useState(false);
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
      id: peerRef.current.sessionId,
    });

    if (error) {
      console.error("Insert Session Error:", error);
      throw error;
    }
  };

  // listen to changes in sessions table
  useEffect(() => {
    const usersChannelName = `realtime:public:${DATABASE_TABLES.SESSIONS}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: DATABASE_TABLES.SESSIONS,
          filter: `user_id=neq.${userId}`,
        },
        (payload) => {
          try {
            const session: Session = payload.new as Session;
            peerRef.current.pullRemoteTracks(session.id, session.tracks);
          } catch (error) {
            console.error("Error pulling remote tracks:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.SESSIONS },
        (payload) => {
          try {
            peerRef.current.closeTracks(payload.old.id);
          } catch (error) {
            console.error("Error removing remote tracks:", error);
          }
        }
      )
      .subscribe();

    return () => {
      usersChannel?.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      await peerRef.current.createSession();
      await peerRef.current.createPeerConnection();

      peerRef.current.on("track", handleTrack);
      peerRef.current.on("removeTrack", handleRemoveTrack);

      setIsInitialized(true);
    };

    const peer = peerRef.current;

    init();

    return () => {
      peer.close();
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isInitialized) {
        return;
      }

      if (localAudioStream) {
        try {
          // add local tracks
          peerRef.current.addLocalTracks(localAudioStream);

          // push local tracks and insert session to db
          const localTracks = await peerRef.current.pushLocalTracks();
          await insertSession(userId, localTracks);

          // fetch remote tracks from db and pull remote tracks
          const sessions = await fetchSessions(userId);
          for (const session of sessions) {
            if (session.user_id === userId) {
              continue;
            }

            await peerRef.current.pullRemoteTracks(
              session.user_id,
              session.tracks
            );
          }
        } catch (error) {
          console.error("Error fetching remote tracks:", error);
        }
      }
    };

    run();

    return () => {};
  }, [localAudioStream, isInitialized, userId]);

  // useEffect(() => {
  //   if (videoRef.current) {
  //     videoRef.current.srcObject = localVideoStream;
  //   }
  // }, [localVideoStream]);

  return (
    <>
      {tracks.map((track) => (
        <AudioPlayer
          key={track.sessionId}
          audioStream={track.audioStream}
          sessionId={track.sessionId}
        />
      ))}

      {/* <video
        autoPlay
        playsInline
        muted
        ref={videoRef}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          width: "200px",
          borderRadius: "8px",
          border: "2px solid #ccc",
          zIndex: 1000,
        }}
      /> */}
    </>
  );
}
