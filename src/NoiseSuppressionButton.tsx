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

import { useState, useCallback } from "react";

export default function NoiseSuppressionButton() {
  const [isNoiseSuppressionOn, setIsNoiseSuppressionOn] = useState(false);

  const handleNoiseSuppressionClick = useCallback(() => {
    setIsNoiseSuppressionOn((prev) => !prev);
  }, []);

  const toggleContainerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    marginLeft: "10px",
  };

  const toggleButtonStyle = {
    position: "relative" as const,
    width: "36px",
    height: "17px",
    backgroundColor: isNoiseSuppressionOn ? "#4CAF50" : "#ccc",
    borderRadius: "9px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.3s",
  };

  const sliderStyle = {
    position: "absolute" as const,
    top: "2px",
    left: isNoiseSuppressionOn ? "21px" : "2px",
    width: "13px",
    height: "13px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "left 0.3s",
  };

  const labelStyle = {
    marginTop: "1px",
    fontSize: "8px",
    color: "#666",
  };

  return (
    <div style={toggleContainerStyle}>
      <button
        style={toggleButtonStyle}
        onClick={handleNoiseSuppressionClick}
        aria-pressed={isNoiseSuppressionOn}
      >
        <span style={sliderStyle}></span>
      </button>
      <span style={labelStyle}>Noise Cancel</span>
    </div>
  );
}
