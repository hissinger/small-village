import ChatInput from "./ChatInput";
import ExitButton from "./ExitButton";
import AudioMuteButton from "./AudioMuteButton";
import AudioInputSelect from "./AudioInputSelect";

interface BottomBarProps {
  userId: string;
  onMessage: (senderId: string, message: string) => void;
  onExit: () => void;
}

export default function BottomBar(props: BottomBarProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "50px",
        display: "flex",
        justifyContent: "right",
        backgroundColor: "white",
        padding: "10px",
      }}
    >
      <AudioInputSelect />
      <ChatInput userId={props.userId} onMessage={props.onMessage} />
      <AudioMuteButton />
      <ExitButton onClick={props.onExit} />
    </div>
  );
}
