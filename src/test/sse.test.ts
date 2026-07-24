import { describe, expect, it, vi } from "vitest";
import {
  consumeSseResponse,
  responseErrorMessage,
  SseProtocolError,
} from "@/lib/sse";

describe("typed SSE consumer", () => {
  it("preserves events split across network chunks and CRLF boundaries", async () => {
    const onEvent = vi.fn();
    const response = streamResponse([
      "data: {\"type\":\"pro",
      "gress\",\"message\":\"读取材料\"}\r\n\r",
      "\ndata: {\"type\":\"done\",\"taskId\":\"task-1\"}\n\n",
    ]);

    await consumeSseResponse<{ type: string; message?: string; taskId?: string }>(response, {
      fallbackErrorMessage: "请求失败。",
      onEvent,
    });

    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "progress", message: "读取材料" },
      { type: "done", taskId: "task-1" },
    ]);
  });

  it("dispatches a final event even when the stream omits the trailing separator", async () => {
    const onEvent = vi.fn();
    const response = streamResponse([
      "data: {\"type\":\"token\",\"token\":\"完成\"}",
    ]);

    await consumeSseResponse(response, {
      fallbackErrorMessage: "请求失败。",
      onEvent,
    });

    expect(onEvent).toHaveBeenCalledWith({ type: "token", token: "完成" });
  });

  it("turns malformed event data into a stable protocol error", async () => {
    const response = streamResponse(["data: not-json\n\n"]);

    await expect(consumeSseResponse(response, {
      fallbackErrorMessage: "请求失败。",
      onEvent: vi.fn(),
    })).rejects.toBeInstanceOf(SseProtocolError);
  });

  it("extracts API messages from flat and nested error payloads", async () => {
    await expect(responseErrorMessage(
      new Response(JSON.stringify({ message: "Skill 尚未发布。" }), { status: 503 }),
      "请求失败。",
    )).resolves.toBe("Skill 尚未发布。");

    await expect(responseErrorMessage(
      new Response(JSON.stringify({ error: { message: "服务不可用。" } }), { status: 500 }),
      "请求失败。",
    )).resolves.toBe("服务不可用。");
  });
});

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}
