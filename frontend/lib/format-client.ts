import type { FormatterOptions } from "./formatter";
export function formatInWorker(options: FormatterOptions) {
  const worker = new Worker(new URL("./format.worker.ts", import.meta.url), {
    type: "module",
  });
  let rejectRequest: (reason: Error) => void = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<{ formatted: string; cursorOffset: number }>(
    (resolve, reject) => {
      rejectRequest = reject;
      worker.onmessage = (event) =>
        event.data.error
          ? reject(new Error(event.data.error))
          : resolve(event.data.result);
      worker.onerror = () =>
        reject(new Error("The formatter could not start. Please try again."));
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "Formatting took too long. Your code has been preserved.",
            ),
          ),
        20000,
      );
      worker.postMessage(options);
    },
  ).finally(() => {
    clearTimeout(timer);
    worker.terminate();
  });
  return {
    promise,
    cancel: () => {
      worker.terminate();
      rejectRequest(new Error("Formatting cancelled."));
    },
  };
}
