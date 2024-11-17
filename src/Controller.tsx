import ChatInput from "./ChatInput";
import ExitButton from "./ExitButton";
import AudioMuteButton from "./AudioMuteButton";

interface ControllerProps {
  userId: string;
  onMessage: (senderId: string, message: string) => void;
  onExit: () => void;
}

export default function Controller(props: ControllerProps) {
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
      <ChatInput userId={props.userId} onMessage={props.onMessage} />
      <AudioMuteButton />
      <ExitButton onClick={props.onExit} />
    </div>
  );
}
