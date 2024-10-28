import React, { useCallback, useState } from "react";
import CharacterSelectModal from "./CharacterSelectModal";
import SmallVillageScreen from "./SmallVillageScreen";

const App: React.FC = () => {
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(
    null
  );
  const [username, setUsername] = useState<string | null>(null);

  const handleCharacterSelect = useCallback(
    (characterIndex: number, name: string) => {
      setSelectedCharacter(characterIndex);
      setUsername(name);
    },
    []
  );

  const onExit = useCallback(() => {
    setSelectedCharacter(null);
    setUsername(null);
  }, []);

  return (
    <div>
      <h1 className="text-center">Small Village</h1>
      {selectedCharacter !== null && username !== null ? (
        <SmallVillageScreen
          characterIndex={selectedCharacter}
          characterName={username}
          onExit={onExit}
        />
      ) : (
        <CharacterSelectModal onSelect={handleCharacterSelect} />
      )}
    </div>
  );
};

export default App;
