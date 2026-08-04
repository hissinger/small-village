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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NUM_CHARACTERS } from "../constants";

interface CharacterPreviewProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
  currentIndex: number;
  loading: boolean;
}

const arrowClass =
  "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 ring-1 ring-stone-900/10 transition hover:bg-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1";

const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  previewContainerRef,
  onPrevious,
  onNext,
  currentIndex,
  loading,
}) => (
  <div className="flex w-full flex-col items-center">
    <div
      data-testid="character-preview"
      className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-xl bg-orange-50/70 ring-1 ring-amber-900/10"
    >
      <div ref={previewContainerRef} className="[image-rendering:pixelated]" />
      {loading && (
        <div
          role="status"
          aria-label="Loading character"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-orange-50/80 text-stone-700 backdrop-blur-[1px]"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-900/20 border-b-orange-700" />
          <span className="mt-3 text-xs font-medium">Loading character...</span>
        </div>
      )}
      <button
        type="button"
        aria-label="Previous character"
        className={`left-2 ${arrowClass}`}
        onClick={onPrevious}
        disabled={loading}
      >
        <ChevronLeft size={20} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Next character"
        className={`right-2 ${arrowClass}`}
        onClick={onNext}
        disabled={loading}
      >
        <ChevronRight size={20} strokeWidth={2.5} />
      </button>
    </div>
    <p className="mt-3 text-xs tabular-nums text-white/70">
      {currentIndex + 1}/{NUM_CHARACTERS}
    </p>
  </div>
);

export default CharacterPreview;
