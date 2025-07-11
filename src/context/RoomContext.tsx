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
  currentUserId: string;
  currentUserName: string;
}

const RoomContext = createContext<RoomContextType | null>(null);

interface RoomProviderProps {
  userId: string;
  userName: string;
  children: React.ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({
  userId,
  userName,
  children,
}) => {
  const [currentUserId] = useState<string>(userId);
  const [currentUserName] = useState<string>(userName);
  useState<MediaStreamTrack | null>(null);

  return (
    <RoomContext.Provider
      value={{
        currentUserId,
        currentUserName,
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
