import React, { createContext, useContext, useState } from "react";

interface DeviceContextType {
  cameraId: string;
  microphoneId: string;
  speakerId: string;
  setCameraId: (cameraId: string) => void;
  setMicrophoneId: (microphoneId: string) => void;
  setSpeakerId: (speakerId: string) => void;
}

const DeviceContext = createContext<DeviceContextType | null>(null);

interface DeviceProviderProps {
  children: React.ReactNode;
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({ children }) => {
  const [cameraId, setCameraId] = useState<string>("");
  const [microphoneId, setMicrophoneId] = useState<string>("");
  const [speakerId, setSpeakerId] = useState<string>("");

  return (
    <DeviceContext.Provider
      value={{
        cameraId,
        microphoneId,
        speakerId,
        setCameraId,
        setMicrophoneId,
        setSpeakerId,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return context;
};
