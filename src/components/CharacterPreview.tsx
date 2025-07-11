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

interface CharacterPreviewProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
}

const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  previewContainerRef,
  onPrevious,
  onNext,
}) => (
  <div className="flex flex-col items-center justify-center w-full">
    <div className="flex items-center justify-center mb-3">
      <button
        type="button"
        className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 mr-3"
        onClick={onPrevious}
      >
        ◀
      </button>
      <div
        ref={previewContainerRef}
        className="w-[120px] h-[100px] border rounded"
      />
      <button
        type="button"
        className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 ml-3"
        onClick={onNext}
      >
        ▶
      </button>
    </div>
  </div>
);

export default CharacterPreview;
