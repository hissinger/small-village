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

import Peer from "../services/Peer";
import React, { createContext, useCallback, useEffect, useState } from "react";

interface RoomContextType {
  microphoneId: string;
  setMicrophoneId: (microphoneId: string) => void;
  speakerId: string;
  setSpeakerId: (speakerId: string) => void;
  localAudioTrack: MediaStreamTrack | null;
  getLocalAudioTrack: () => MediaStreamTrack;
  peer: Peer | null;
  isReady: boolean;
}

const RoomContext = createContext<RoomContextType | null>(null);

interface RoomProviderProps {
  children: React.ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({ children }) => {
  const [microphoneId, setMicrophoneId] = useState<string>("");
  const [speakerId, setSpeakerId] = useState<string>("");
  const [localAudioTrack, setLocalAudioTrack] =
    useState<MediaStreamTrack | null>(null);
  const localAudioTrackRef = React.useRef<MediaStreamTrack | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const peerRef = React.useRef<Peer | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isEndedTrack, setIsEndedTrack] = useState<boolean>(false);

  // Get the local audio track
  const getUserMedia = useCallback(
    async (id: string): Promise<MediaStreamTrack> => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
        };
        if (id) {
          constraints.audio = { deviceId: { exact: id } };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getAudioTracks()[0];
        return track;
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const getLocalAudioTrack = (): MediaStreamTrack => {
    if (!localAudioTrackRef.current) {
      throw new Error("Local audio track not available");
    }
    return localAudioTrackRef.current;
  };

  useEffect(() => {
    const initPeer = async () => {
      const peerInstance = new Peer();
      await peerInstance.createSession();
      await peerInstance.createPeerConnection();
      setPeer(peerInstance);
      peerRef.current = peerInstance;
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  const getTrack = useCallback(
    async (id: string) => {
      try {
        const newTrack = await getUserMedia(id);
        setLocalAudioTrack(newTrack);

        if (localAudioTrackRef.current) {
          // replace the track when the microphoneId changes
          peerRef.current?.replaceTrack(newTrack);
        }

        localAudioTrackRef.current = newTrack;
      } catch (error) {
        console.error("Error getting local audio track", error);
      }
    },
    [getUserMedia, setLocalAudioTrack]
  );

  // get the local audio track when the audio track ends
  useEffect(() => {
    if (!isEndedTrack) {
      return;
    }

    getTrack(microphoneId);
  }, [isEndedTrack, microphoneId, getTrack]);

  // get the local audio track when the microphoneId changes
  useEffect(() => {
    if (!microphoneId) {
      return;
    }

    getTrack(microphoneId);
  }, [microphoneId, setLocalAudioTrack, getTrack]);

  useEffect(() => {
    if (!localAudioTrack) {
      return;
    }

    const handleTrackEnded = () => {
      setIsEndedTrack(true);
    };

    localAudioTrack.addEventListener("ended", handleTrackEnded);

    return () => {
      localAudioTrack.removeEventListener("ended", handleTrackEnded);
    };
  }, [localAudioTrack]);

  useEffect(() => {
    if (peer && localAudioTrack) {
      setIsReady(true);
    }
  }, [peer, localAudioTrack]);

  // umount hook
  useEffect(() => {
    return () => {
      localAudioTrackRef.current?.stop();
    };
  }, []);

  return (
    <RoomContext.Provider
      value={{
        microphoneId,
        setMicrophoneId,
        speakerId,
        setSpeakerId,
        localAudioTrack,
        getLocalAudioTrack,
        peer,
        isReady,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoomContext = () => {
  const context = React.useContext(RoomContext);
  if (!context) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
};
