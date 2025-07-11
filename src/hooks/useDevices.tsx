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
