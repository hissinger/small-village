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

import React, { useCallback, useEffect, useState } from "react";
import CharacterSelectScreen from "./pages/CharacterSelectScreen";
import SmallVillageScreen from "./pages/SmallVillageScreen";
import { getOrCreateUserId } from "./lib/storage";
import { MessageProvider } from "./context/MessageContext";
import TagManager from "react-gtm-module";
import ReactGA from "react-ga4";
import GithubIcon from "./components/GithubIcon";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { Room } from "./types";

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
  const [room, setRoom] = useState<Room | null>(null);
  const [currentStep, setCurrentStep] = useState<string>(
    Steps.CHARACTER_SELECT
  );

  useEffect(() => {
    // Initialize Google Tag Manager
    const gtmId = process.env.REACT_APP_GTM_ID;
    if (gtmId) {
      TagManager.initialize({
        gtmId,
      });
    }

    // Initialize Google Analytics
    const gaId = process.env.REACT_APP_GA_ID;
    if (gaId) {
      ReactGA.initialize(gaId);
    }
  }, []);

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
    // localStorage 에 신원(uuid)을 두어 재방문해도 같은 유저로 이어진다.
    setUserId(getOrCreateUserId());
  }, []);

  const handleEnterRoom = useCallback(
    (characterIndex: number, name: string, room: Room) => {
      setSelectedCharacter(characterIndex);
      setUsername(name);
      setRoom(room);
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
    <>
      <MessageProvider userId={userId!}>
        {/* 헤더(고정 높이) + 본문(나머지 영역)으로 세로 분할한다.
            게임 화면이 뷰포트 전체를 덮어 헤더를 가리지 않도록 본문을 flex-1 로 잡는다. */}
        <div className="flex h-screen flex-col overflow-hidden">
          <div className="relative flex shrink-0 justify-center px-5">
            <h1 className="text-center text-4xl font-bold py-2">Small Village</h1>
            <div className="absolute right-5 flex items-center h-full">
              <GithubIcon repoUrl="https://github.com/hissinger/small-village" />
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {currentStep === Steps.CHARACTER_SELECT && (
              <CharacterSelectScreen onEnterRoom={handleEnterRoom} />
            )}
            {currentStep === Steps.SMALL_VILLAGE && (
              <SmallVillageScreen
                userId={userId!}
                characterIndex={selectedCharacter!}
                characterName={username!}
                room={room!}
                onExit={onExit}
              />
            )}
          </div>
        </div>
      </MessageProvider>
      <ToastContainer />
    </>
  );
};

export default App;
