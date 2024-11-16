import { useEffect, useState } from "react";
import { useDevice } from "../context/DeviceContext";

export default function useLocalStream() {
  const { cameraId, microphoneId } = useDevice();
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(
    null
  );
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(
    null
  );

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: cameraId },
          audio: false,
        });
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

    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: microphoneId },
        });
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

  return { localVideoStream, localAudioStream };
}
