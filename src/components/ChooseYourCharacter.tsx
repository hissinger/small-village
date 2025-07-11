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

import CharacterPreview from "./CharacterPreview";

interface ChooseYourCharacterProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  handlePrevious: () => void;
  handleNext: () => void;
}

const ChooseYourCharacter: React.FC<ChooseYourCharacterProps> = ({
  previewContainerRef,
  handlePrevious,
  handleNext,
}) => (
  <div className="flex flex-1 flex-col items-center p-4 border-r w-5/12">
    <h5 className="text-center mb-4 text-lg font-medium">
      Choose Your Character
    </h5>
    <div className="flex flex-1 items-center">
      <CharacterPreview
        previewContainerRef={previewContainerRef}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </div>
  </div>
);

export default ChooseYourCharacter;
