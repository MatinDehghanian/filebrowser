import { formatCode, type FormatterOptions } from "./formatter";
self.onmessage = async (event: MessageEvent<FormatterOptions>) => {
  try {
    self.postMessage({ result: await formatCode(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not format this file.",
    });
  }
};
