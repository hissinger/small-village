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

import ExitButton from "./ExitButton";
import AudioMuteButton from "./AudioMuteButton";
import AudioInputSelect from "./AudioInputSelect";
import { useState } from "react";
import ChatPanel from "./ChatPanel";
import { MessageCircle } from "lucide-react";
import IconButton from "./IconButton";

interface BottomBarProps {
  userId: string;
  onExit: () => void;
}

export default function BottomBar(props: BottomBarProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div>
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <div
        className="fixed bottom-0 left-0 w-full h-12 flex justify-end bg-white p-2.5"
      >
        <AudioInputSelect />

        <IconButton
          onClick={() => setIsChatOpen(!isChatOpen)}
          ActiveIcon={MessageCircle}
          activeColor="#4CAF50"
          size={25}
          strokeWidth={2}
        />

        <AudioMuteButton />
        <ExitButton onClick={props.onExit} />
      </div>
    </div>
  );
}
