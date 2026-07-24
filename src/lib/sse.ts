export type SseConsumerOptions<T> = {
  fallbackErrorMessage: string;
  onEvent: (event: T) => void;
};

export class SseProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SseProtocolError";
  }
}

export async function consumeSseResponse<T>(
  response: Response,
  options: SseConsumerOptions<T>,
): Promise<void> {
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, options.fallbackErrorMessage));
  }
  if (!response.body) {
    throw new Error(options.fallbackErrorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = dispatchCompleteEvents(buffer, options.onEvent);
  }

  buffer += decoder.decode();
  if (buffer.trim()) dispatchEventBlock(buffer, options.onEvent);
}

export async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const json = await response.clone().json().catch(() => null);
  const message = messageFromPayload(json);
  if (message) return message;

  const text = await response.text().catch(() => "");
  return text.trim() || fallback;
}

function dispatchCompleteEvents<T>(
  source: string,
  onEvent: (event: T) => void,
): string {
  let buffer = source;
  while (true) {
    const separator = /\r?\n\r?\n/.exec(buffer);
    if (!separator || separator.index === undefined) return buffer;
    const block = buffer.slice(0, separator.index);
    buffer = buffer.slice(separator.index + separator[0].length);
    dispatchEventBlock(block, onEvent);
  }
}

function dispatchEventBlock<T>(block: string, onEvent: (event: T) => void) {
  const payload = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n")
    .trim();
  if (!payload || payload === "[DONE]") return;

  try {
    onEvent(JSON.parse(payload) as T);
  } catch {
    throw new SseProtocolError("HAI 返回了无法识别的流式数据。");
  }
}

function messageFromPayload(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }
  if (
    isRecord(value.error) &&
    typeof value.error.message === "string" &&
    value.error.message.trim()
  ) {
    return value.error.message.trim();
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
