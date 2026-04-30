import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { streamLearningAgent } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), { status: 401 });
  }

  const { messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages 不能为空" }), {
      status: 400,
    });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const agentStream = streamLearningAgent(messages, {
          userId: user.id,
          origin: request.nextUrl.origin,
          cookie: request.headers.get("cookie") || "",
        });

        for await (const event of agentStream) {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("Agent chat error:", error);
        const errorEvent = `data: ${JSON.stringify({
          type: "error",
          data: "Agent 处理请求时出现错误",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
