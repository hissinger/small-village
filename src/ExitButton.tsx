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
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "50px",
        marginLeft: "10px",
      }}
    >
      <LogOut size={23} strokeWidth={2} color={"#888888"} />
    </button>
  );
}
