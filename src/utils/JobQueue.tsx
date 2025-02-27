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

type Job<T = void> = () => Promise<T>;

interface JobItem<T> {
  job: Job<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export default class JobQueue {
  private queue: JobItem<any>[] = [];
  private running: boolean = false;

  addJob<T>(job: Job<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.runQueue();
    });
  }

  private async runQueue(): Promise<void> {
    if (this.running || this.queue.length === 0) return;
    this.running = true;

    while (this.queue.length > 0) {
      const { job, resolve, reject } = this.queue.shift()!;

      try {
        const result = await job();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.running = false;
  }
}
