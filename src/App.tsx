import React, { useCallback, useEffect, useState } from "react";
import CharacterSelectModal from "./CharacterSelectModal";
import SmallVillageScreen from "./SmallVillageScreen";
import { v4 as uuidv4 } from "uuid";

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(
    null
  );
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const USER_ID_KEY = "smallvillage_user_id";
    let storedUserId = sessionStorage.getItem(USER_ID_KEY);
    if (!storedUserId) {
      const newUserId = uuidv4();
      newUserId && sessionStorage.setItem(USER_ID_KEY, newUserId);
      setUserId(newUserId);
    } else {
      setUserId(storedUserId);
    }
  }, []);

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
      {selectedCharacter !== null && username !== null && userId !== null ? (
        <SmallVillageScreen
          userId={userId}
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
