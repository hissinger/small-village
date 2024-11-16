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
