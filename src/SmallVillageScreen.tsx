import React, { memo, useState } from "react";
import DeviceSelector from "./DeviceSelector";
import SmallVillage from "./SmallVillage";
import { DeviceProvider } from "./context/DeviceContext";
import { LocalStreamProvider } from "./context/LocalStreamContext";
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
  const [deviceSelected, setDeviceSelected] = useState(false);

  return (
    <DeviceProvider>
      <LocalStreamProvider>
        {!deviceSelected ? (
          <DeviceSelector onExit={() => setDeviceSelected(true)} />
        ) : (
          <SmallVillage
            userId={userId!}
            characterIndex={characterIndex}
            characterName={characterName}
            onExit={onExit}
          />
        )}
      </LocalStreamProvider>
    </DeviceProvider>
  );
};

export default memo(SmallVillageScreen);
