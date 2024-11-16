import React, { useCallback, useEffect, useState } from "react";
import CharacterSelectModal from "./CharacterSelectModal";
import SmallVillageScreen from "./SmallVillageScreen";
import { v4 as uuidv4 } from "uuid";
import { MessageProvider } from "./context/MessageContext";

enum Steps {
  CHARACTER_SELECT = "CHARACTER_SELECT",
  SMALL_VILLAGE = "SMALL_VILLAGE",
}

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(
    null
  );
  const [username, setUsername] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>(
    Steps.CHARACTER_SELECT
  );

  const goToNextStep = useCallback(() => {
    switch (currentStep) {
      case Steps.CHARACTER_SELECT:
        setCurrentStep(Steps.SMALL_VILLAGE);
        break;
      default:
        break;
    }
  }, [currentStep]);

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
      goToNextStep();
    },
    [goToNextStep]
  );

  const onExit = useCallback(() => {
    setSelectedCharacter(null);
    setUsername(null);
    setCurrentStep(Steps.CHARACTER_SELECT);
  }, []);

  return (
    <MessageProvider userId={userId!}>
      <h1 className="text-center">Small Village</h1>
      {currentStep === Steps.CHARACTER_SELECT && (
        <CharacterSelectModal onSelect={handleCharacterSelect} />
      )}
      {currentStep === Steps.SMALL_VILLAGE && (
        <SmallVillageScreen
          userId={userId!}
          characterIndex={selectedCharacter!}
          characterName={username!}
          onExit={onExit}
        />
      )}
    </MessageProvider>
  );
};

export default App;
