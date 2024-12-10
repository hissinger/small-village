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

import { toast, ToastOptions } from "react-toastify";

export const useToast = () => {
  const defaultOptions: ToastOptions = {
    position: "top-left",
    autoClose: 5000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "light",
    style: {
      height: "60px",
      background: "white",
      color: "#1a1a1a",
      borderRadius: "8px",
      border: "2px solid #1a1a1a",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      padding: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontWeight: "800",
    },
  };

  const showToast = (message: string, options?: Partial<ToastOptions>) => {
    toast(message, {
      ...defaultOptions,
      ...options,
    });
  };

  return {
    show: showToast,
    success: (message: string, options?: Partial<ToastOptions>) =>
      showToast(message, {
        ...options,
        style: { ...defaultOptions.style, background: "#4CAF50" },
      }),
    error: (message: string, options?: Partial<ToastOptions>) =>
      showToast(message, {
        ...options,
        style: { ...defaultOptions.style, background: "#f44336" },
      }),
  };
};
