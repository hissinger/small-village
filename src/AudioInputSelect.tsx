import React from "react";
import { useDeviceSelect } from "./hooks/useDeviceSelect";

const AudioInputSelect: React.FC = () => {
  const { audioInputs, microphoneId, setMicrophoneId } = useDeviceSelect();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Selected microphone", event.target.value);
    setMicrophoneId(event.target.value);
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
