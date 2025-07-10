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

import React from "react";
import { useDevices } from "./hooks/useDevices";

const AudioInputSelect: React.FC = () => {
  const { audioInputs, setMicrophoneId, microphoneId } = useDevices();

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Selected microphone ID:", event.target.value);
    await setMicrophoneId(event.target.value);
  };

  return (
    <div>
      <select
        id="audio-input-select"
        value={microphoneId || ""}
        onChange={handleChange}
        style={{
          width: "250px",
          height: "100%",
          borderRadius: "6px",
          fontSize: "14px",
          border: "1px solid #ccc",
          margin: "0px 10px 0px 10px",
          padding: "4px 10px",
        }}
      >
        {audioInputs.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Device ${device.deviceId}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AudioInputSelect;
