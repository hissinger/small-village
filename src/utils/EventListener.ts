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

export default class EventListener {
  private _listeners: Map<string, ((data?: any) => void)[]> = new Map();

  constructor() {
    this._listeners = new Map();
  }

  on(event: string, listener: (data?: any) => void) {
    const listeners = this._listeners.get(event) || [];
    listeners.push(listener);
    this._listeners.set(event, listeners);
  }

  off(event: string, listener?: (data?: any) => void) {
    const listeners = this._listeners.get(event) || [];
    if (listener) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }

      this._listeners.set(event, listeners);
    } else {
      this._listeners.delete(event);
    }
  }

  fireEvent = (event: string, data?: any) => {
    const listeners = this._listeners.get(event) || [];
    listeners.forEach((listener) => {
      listener(data);
    });
  };

  clearEventListeners = () => {
    this._listeners.clear();
  };
}
