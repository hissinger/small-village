import {
  useRealtimeKitMeeting,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import { useCallback, useEffect, useState } from "react";

export const useDevices = () => {
  const { meeting } = useRealtimeKitMeeting();
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const fetchAudioDevices = async () => {
      // Fetch the initial list of audio devices
      const devices = await meeting.self.getAudioDevices();
      setAudioInputs(devices);
    };

    fetchAudioDevices();
  }, [meeting]);

  useEffect(() => {
    const fetchAudioDevices = async () => {
      // Fetch the initial list of audio devices
      const devices = await meeting.self.getAudioDevices();
      setAudioInputs(devices);
    };

    meeting.self.on("deviceListUpdate", fetchAudioDevices);

    return () => {
      // Clean up the event listener when the component unmounts
      meeting.self.off("deviceListUpdate", fetchAudioDevices);
    };
  }, [meeting]);

  const microphoneId =
    useRealtimeKitSelector(
      (meeting) => meeting.self.getCurrentDevices().audio?.deviceId || ""
    ) || "";

  const speakerId =
    useRealtimeKitSelector(
      (meeting) => meeting.self.getCurrentDevices().speaker?.deviceId || ""
    ) || "";

  const setMicrophoneId = useCallback(
    async (id: string) => {
      // Set the microphone device by its ID
      const device = await meeting.self.getDeviceById(id, "audio");
      await meeting.self.setDevice(device);
    },
    [meeting]
  );

  return {
    audioInputs,
    microphoneId,
    speakerId,
    setMicrophoneId,
  };
};
