import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";
import { debounce } from "lodash";

export function useDeviceSelect() {
  const { microphoneId, setMicrophoneId, speakerId, setSpeakerId } =
    useRoomContext();
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[] | null>(
    []
  );

  // Get the list of devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioOutputSupported = devices.some(
        (device) => device.kind === "audiooutput"
      );
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput"
      );
      const outputDevices = audioOutputSupported
        ? devices.filter((device) => device.kind === "audiooutput")
        : null;

      setAudioInputs(audioDevices);
      setAudioOutputs(outputDevices);

      if (!microphoneId && audioDevices.length > 0) {
        setMicrophoneId(audioDevices[0].deviceId);
      }
      if (outputDevices && !speakerId && outputDevices.length > 0) {
        setSpeakerId(outputDevices[0].deviceId);
      }
    } catch (error) {
      console.error(error);
    }
  }, [microphoneId, speakerId, setMicrophoneId, setSpeakerId]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        await getDevices();

        // close the stream
        stream?.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (error) {
        console.error("Error getting user media:", error);
      }
    };

    fetchDevices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleDeviceChange = debounce(async () => {
      await getDevices();
    }, 300);

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [getDevices]);

  return {
    audioInputs,
    audioOutputs,
    microphoneId,
    speakerId,
    setMicrophoneId,
    setSpeakerId,
  };
}
