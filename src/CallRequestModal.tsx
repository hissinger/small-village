import { useState } from "react";
import { Button, Modal } from "react-bootstrap";

interface CallRequestModalProps {
  userName: string;
  onRequestCall: () => void;
  onClose: () => void;
}

const CallRequestModal: React.FC<CallRequestModalProps> = ({
  userName,
  onRequestCall,
  onClose,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);

  // 통화 요청 핸들러
  const handleRequestCallClick = () => {
    setIsRequesting(true);
    onRequestCall();
  };

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>통화 요청</Modal.Title>
      </Modal.Header>
      <Modal.Body>{userName}님과 통화하시겠습니까?</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button
          variant={isRequesting ? "danger" : "primary"}
          onClick={handleRequestCallClick}
          disabled={isRequesting}
        >
          {isRequesting ? "요청 중..." : "통화 요청"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CallRequestModal;
