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

import GameBackdrop from "./GameBackdrop";

interface EnteringRoomScreenProps {
  map: string | null | undefined;
  characterIndex: number;
  message?: string;
}

const EnteringRoomScreen: React.FC<EnteringRoomScreenProps> = ({
  map,
  characterIndex,
  message,
}) => {
  const characterFile = characterIndex.toString().padStart(3, "0");

  return (
    <div
      role="status"
      aria-label="Entering room"
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      <GameBackdrop map={map} />
      <div className="absolute inset-0 bg-stone-950/35" />

      <div className="relative flex -translate-y-4 flex-col items-center px-6 text-center text-orange-50">
        <h1 className="mb-8 text-xl leading-relaxed sv-font-pixel sv-pixel-shadow sm:text-2xl">
          Small Village
        </h1>

        <div
          aria-hidden="true"
          className="h-32 w-20 overflow-hidden [filter:drop-shadow(0_8px_8px_rgba(0,0,0,0.4))]"
        >
          <span
            data-testid="entering-character"
            className="block h-8 w-5 origin-top-left scale-[4] sv-character-walk-right"
            style={{
              backgroundImage: `url("/assets/characters/${characterFile}.png")`,
            }}
          />
        </div>

        {message && (
          <p className="mt-7 text-xs leading-6 text-orange-50/90 sv-font-pixel sv-pixel-shadow sm:text-sm">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default EnteringRoomScreen;
