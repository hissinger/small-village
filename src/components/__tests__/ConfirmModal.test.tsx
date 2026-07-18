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

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmModal from "../ConfirmModal";

describe("ConfirmModal", () => {
  it("isOpen=false 이면 아무것도 렌더링하지 않는다 (null)", () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("isOpen=true 이면 접근성 속성을 갖춘 dialog 를 렌더링한다", () => {
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    const dialog = screen.getByTestId("confirm-modal");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
    // 기본 제목/메시지 노출
    expect(screen.getByText("Are you sure you want to leave?")).toBeInTheDocument();
    expect(screen.getByText("지금 방에서 나갑니다.")).toBeInTheDocument();
  });

  it("확인 버튼 클릭 시 onConfirm 을 호출한다", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByTestId("confirm-exit-btn"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("취소 버튼 클릭 시 onCancel 만 호출하고 onConfirm 은 호출하지 않는다", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await user.click(screen.getByTestId("confirm-cancel-btn"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("backdrop 클릭 시 onCancel 을 호출한다", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.mouseDown(screen.getByTestId("confirm-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("패널 내부(제목) 클릭 시에는 onCancel 을 호출하지 않는다", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.mouseDown(screen.getByText("Are you sure you want to leave?"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("ESC 키를 누르면 onCancel 을 호출한다", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("열리면 확인(나가기) 버튼으로 포커스가 이동한다", () => {
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(document.activeElement).toBe(screen.getByTestId("confirm-exit-btn"));
  });

  it("닫히면 열기 전 포커스를 가졌던 트리거로 포커스를 복원한다", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    function Wrapper({ open }: { open: boolean }) {
      return (
        <>
          <button data-testid="trigger">Trigger</button>
          <ConfirmModal
            isOpen={open}
            message="지금 방에서 나갑니다."
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </>
      );
    }

    const { rerender } = render(<Wrapper open={false} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // 열림 → 확인 버튼으로 포커스 이동
    rerender(<Wrapper open={true} />);
    expect(document.activeElement).toBe(screen.getByTestId("confirm-exit-btn"));

    // 닫힘 → 트리거로 포커스 복원
    rerender(<Wrapper open={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab 포커스 트랩: 마지막 버튼에서 Tab 시 첫 버튼으로 순환한다", () => {
    render(
      <ConfirmModal
        isOpen={true}
        message="지금 방에서 나갑니다."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    const cancelBtn = screen.getByTestId("confirm-cancel-btn");
    const confirmBtn = screen.getByTestId("confirm-exit-btn");
    const dialog = screen.getByTestId("confirm-modal");

    // 첫 버튼(cancel) = focusable[0], 마지막 버튼(confirm) = focusable[last]
    // 마지막에서 정방향 Tab → 첫 번째로 순환
    confirmBtn.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(cancelBtn);

    // 첫 번째에서 Shift+Tab → 마지막으로 순환
    cancelBtn.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });
});
