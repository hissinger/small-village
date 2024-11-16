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
