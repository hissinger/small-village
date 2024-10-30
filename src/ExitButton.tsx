interface ExitButtonProps {
  onClick: () => void;
}

export default function ExitButton(props: ExitButtonProps) {
  return (
    <button
      onClick={props.onClick}
      style={{
        position: "absolute",
        bottom: 80, // 하단과의 간격 조정
        right: 20, // 오른쪽과의 간격 조정
        padding: "10px 20px",
        fontSize: "16px",
        borderRadius: "5px",
        border: "none",
        backgroundColor: "#f44336",
        color: "white",
        cursor: "pointer",
      }}
    >
      Exit
    </button>
  );
}
