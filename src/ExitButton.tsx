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

import { LogOut } from "lucide-react";

interface ExitButtonProps {
  onClick: () => void;
}

export default function ExitButton(props: ExitButtonProps) {
  return (
    <button
      onClick={props.onClick}
      style={{
        bottom: 80,
        right: 20,
        padding: "0px 20px",
        fontSize: "16px",
        borderRadius: "5px",
        border: "none",
        backgroundColor: "#6c757d",
        color: "white",
        cursor: "pointer",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LogOut size={20} />
    </button>
  );
}
