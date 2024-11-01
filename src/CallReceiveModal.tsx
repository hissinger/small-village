import { Button, Modal } from "react-bootstrap";

interface CallReceiveModalProps {
  userName: string; // 통화 요청을 보낸 유저 이름
  onAccept: () => void; // 통화 수락 핸들러
  onReject: () => void; // 통화 거절 핸들러
}

const CallReceiveModal: React.FC<CallReceiveModalProps> = ({
  userName,
  onAccept,
  onReject,
}) => {
  return (
    <Modal show onHide={onReject}>
      <Modal.Header closeButton>
        <Modal.Title>통화 요청</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{userName}님이 통화를 요청했습니다. 수락하시겠습니까?</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onReject}>
          거절
        </Button>
        <Button variant="primary" onClick={onAccept}>
          수락
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CallReceiveModal;
