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

import { useEffect, useId, useRef } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string; // 기본값 "정말 나가시겠어요?"
  message: string;
  confirmLabel?: string; // 기본값 "나가기"
  cancelLabel?: string; // 기본값 "취소"
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  const { isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel } = props;

  // 1) 훅은 전부 여기 — 조기 반환보다 위 (Rules of Hooks)
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // 열림/포커스/복원 effect
  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement as HTMLElement | null; // 트리거 저장
    confirmRef.current?.focus(); // [나가기](confirm) 로 포커스 이동
    return () => {
      trigger?.focus(); // 닫힐 때 트리거로 복원
    };
  }, [isOpen]);

  // ESC 닫기 = document keydown 리스너
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  // 2) 훅을 전부 호출한 뒤에야 조기 반환
  if (!isOpen) return null;

  // Tab 포커스 트랩 (dialog 루트 onKeyDown 핸들러)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    if (!dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
    event.stopPropagation();
  };

  // 3) JSX
  return (
    <div
      data-testid="confirm-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="confirm-modal"
        onKeyDown={handleKeyDown}
        className="bg-white shadow-lg rounded-lg w-[320px] max-w-[90vw] p-6 flex flex-col gap-4"
      >
        <h2 id={titleId} className="m-0 text-lg font-semibold">
          {title ?? "정말 나가시겠어요?"}
        </h2>
        <p className="m-0 text-sm text-gray-700">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="confirm-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            {cancelLabel ?? "취소"}
          </button>
          <button
            ref={confirmRef}
            data-testid="confirm-exit-btn"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            {confirmLabel ?? "나가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
