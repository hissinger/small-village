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

interface NameInputProps {
  name: string;
  onChange: (value: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ name, onChange }) => (
  <div>
    <label
      htmlFor="player-name"
      className="mb-2 block text-sm font-bold text-stone-100"
    >
      Your Name <span className="text-orange-300">*</span>
    </label>
    <input
      id="player-name"
      type="text"
      placeholder="e.g. Mina"
      value={name}
      maxLength={20}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
    />
  </div>
);

export default NameInput;
