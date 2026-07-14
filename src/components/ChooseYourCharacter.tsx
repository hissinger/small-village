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
import CharacterPreview from "./CharacterPreview";
import NameInput from "./NameInput";

interface ChooseYourCharacterProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  handlePrevious: () => void;
  handleNext: () => void;
  currentIndex: number;
  name: string;
  onNameChange: (value: string) => void;
}

const ChooseYourCharacter: React.FC<ChooseYourCharacterProps> = ({
  previewContainerRef,
  handlePrevious,
  handleNext,
  currentIndex,
  name,
  onNameChange,
}) => (
  <div className="flex h-full flex-col">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-700 text-xs text-white sv-font-pixel">
        1
      </span>
      <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
        My Character
      </h2>
    </div>

    <CharacterPreview
      previewContainerRef={previewContainerRef}
      onPrevious={handlePrevious}
      onNext={handleNext}
      currentIndex={currentIndex}
    />

    <div className="mt-auto pt-6">
      <NameInput name={name} onChange={onNameChange} />
    </div>
  </div>
);

export default ChooseYourCharacter;
