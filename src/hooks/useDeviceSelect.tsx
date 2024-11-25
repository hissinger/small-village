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
