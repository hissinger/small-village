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

import React, { memo } from "react";
import SmallVillage from "./SmallVillage";
import { RoomProvider } from "./context/RoomContext";

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  onExit: () => void;
}

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  onExit,
}: SmallVillageScreenProps) => {
  return (
    <RoomProvider userId={userId} userName={characterName}>
      <SmallVillage
        userId={userId!}
        characterIndex={characterIndex}
        characterName={characterName}
        onExit={onExit}
      />
    </RoomProvider>
  );
};

export default memo(SmallVillageScreen);
