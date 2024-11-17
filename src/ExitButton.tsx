import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt } from "@fortawesome/free-solid-svg-icons";

interface ExitButtonProps {
  onClick: () => void;
}

export default function ExitButton(props: ExitButtonProps) {
  return (
    <button
      onClick={props.onClick}
      style={{
        bottom: 80,
        right: 20,
        padding: "0px 20px",
        fontSize: "16px",
        borderRadius: "5px",
        border: "none",
        backgroundColor: "#6c757d",
        color: "white",
        cursor: "pointer",
        height: "100%",
      }}
    >
      <FontAwesomeIcon icon={faSignOutAlt} />
    </button>
  );
}
