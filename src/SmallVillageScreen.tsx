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
    <RoomProvider>
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
