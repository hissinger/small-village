import React, { createContext, useEffect, useState } from "react";
import { useDevice } from "./DeviceContext";

interface LocalStreamContextType {
  localStream: MediaStream | null;
}

const LocalStreamContext = createContext<LocalStreamContextType | null>(null);

interface LocalStreamProviderProps {
  children: React.ReactNode;
}

export const LocalStreamProvider: React.FC<LocalStreamProviderProps> = ({
  children,
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const { cameraId, microphoneId } = useDevice();

  useEffect(() => {
    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: cameraId },
          audio: { deviceId: microphoneId },
        });
        setLocalStream(stream);
      } catch (error) {
        console.error(error);
      }
    };

    getUserMedia();
  }, []);

  return (
    <LocalStreamContext.Provider value={{ localStream }}>
      {children}
    </LocalStreamContext.Provider>
  );
};
