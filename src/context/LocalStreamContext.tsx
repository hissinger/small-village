import React, { createContext, useEffect, useState } from "react";
import { useDevice } from "./DeviceContext";

interface LocalStreamContextType {
  localAudioStream: MediaStream | null;
  localVideoStream: MediaStream | null;
}

const LocalStreamContext = createContext<LocalStreamContextType | null>(null);

interface LocalStreamProviderProps {
  children: React.ReactNode;
}

export const LocalStreamProvider: React.FC<LocalStreamProviderProps> = ({
  children,
}) => {
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(
    null
  );
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(
    null
  );
  const { cameraId, microphoneId } = useDevice();

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (!cameraId) {
      return;
    }

    const getUserMedia = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: { deviceId: cameraId },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        setLocalVideoStream(stream);
      } catch (error) {
        console.error(error);
      }
    };

    getUserMedia();

    return () => {
      currentStream?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, [cameraId]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (!microphoneId) {
      return;
    }

    const getUserMedia = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: false,
          audio: { deviceId: microphoneId },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        setLocalAudioStream(stream);
      } catch (error) {
        console.error(error);
      }
    };

    getUserMedia();

    return () => {
      currentStream?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, [microphoneId]);

  return (
    <LocalStreamContext.Provider value={{ localAudioStream, localVideoStream }}>
      {children}
    </LocalStreamContext.Provider>
  );
};

export const useLocalStream = () => {
  const context = React.useContext(LocalStreamContext);
  if (!context) {
    throw new Error("useLocalStream must be used within a LocalStreamProvider");
  }
  return context;
};
