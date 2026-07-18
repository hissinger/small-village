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
import ExitButton from "../ExitButton";

describe("ExitButton", () => {
  it("Exit 버튼을 렌더링한다 (aria-label='Exit')", () => {
    render(<ExitButton onClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
    // 처음에는 모달이 닫혀 있다
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });

  it("Exit 버튼 클릭 시 onClick 은 호출하지 않고 ConfirmModal 을 연다", () => {
    const onClick = jest.fn();
    render(<ExitButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
  });

  it("모달의 확인(나가기) 클릭 시 onClick 을 1회 호출하고 모달을 닫는다", () => {
    const onClick = jest.fn();
    render(<ExitButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    fireEvent.click(screen.getByTestId("confirm-exit-btn"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });

  it("모달의 취소 클릭 시 onClick 은 호출하지 않고 모달만 닫는다", () => {
    const onClick = jest.fn();
    render(<ExitButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    fireEvent.click(screen.getByTestId("confirm-cancel-btn"));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });
});
