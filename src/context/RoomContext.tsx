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

import React, { createContext, useState } from "react";

interface RoomContextType {
  roomId: string;
  roomTitle: string;
  userId: string;
  userName: string;
  characterIndex: number;
}

const RoomContext = createContext<RoomContextType | null>(null);

interface RoomProviderProps {
  userId: string;
  userName: string;
  roomId: string;
  roomTitle: string;
  characterIndex: number;
  children: React.ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({
  userId: initialUserId,
  userName: initialUserName,
  roomId: initialRoomId,
  roomTitle: initialRoomTitle,
  characterIndex: initialCharacterIndex,
  children,
}) => {
  const [roomId] = useState<string>(initialRoomId);
  const [roomTitle] = useState<string>(initialRoomTitle);
  const [userId] = useState<string>(initialUserId);
  const [userName] = useState<string>(initialUserName);
  const [characterIndex] = useState<number>(initialCharacterIndex);

  return (
    <RoomContext.Provider
      value={{
        roomId,
        roomTitle,
        userId,
        userName,
        characterIndex,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoomContext = () => {
  const context = React.useContext(RoomContext);
  if (!context) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
};
