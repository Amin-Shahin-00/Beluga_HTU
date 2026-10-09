// POST /api/ai/chat/stream { message, history?, lang? } → the chatbot's answer as it is written.
// Response: newline-delimited JSON. {"t":"text piece"} lines, then a final
// {"done":true,"source":"llm|mock|fallback","model":"…","links":[…],"sources":[…],"offices":[…]}.
// The client's context (business, roadmap, documents) is read on the server from their own session.
import { prepareChat } from "@/lib/integrations/assistant/chatbot";
import { activeProvider, llmConfig, streamChat, type LlmMessage, type LlmSource } from "@/lib/integrations/llm";
import { readObject } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple per-visitor limit so one tab can't flood the local model: 20 questions a minute.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body = await readObject(req, 40_000);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "message is required" }, { status: 400 });
  if (message.length > 1000) return Response.json({ error: "message is too long (max 1000 characters)" }, { status: 400 });
  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cookie")?.match(/sb-[^=]+-auth-token=([^;]{0,24})/)?.[1] || "local";
  if (limited(key)) return Response.json({ error: "Too many questions in a minute. Please wait a moment." }, { status: 429 });

  const history: LlmMessage[] = Array.isArray(body?.history)
    ? (body.history as unknown[])
        .filter((m): m is LlmMessage => !!m && typeof m === "object" && ((m as LlmMessage).role === "user" || (m as LlmMessage).role === "assistant") && typeof (m as LlmMessage).content === "string")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];
  const lang = body?.lang === "ar" || body?.lang === "en" ? body.lang : undefined;
  const chat = await prepareChat(message, history, lang);
  const model = activeProvider("chat") === "mock" ? "" : llmConfig().model;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      const state: { source: LlmSource } = { source: "mock" };
      try {
        if (chat.offTopic) send({ t: chat.fallback });
        else for await (const piece of streamChat(
          { task: "chat", system: chat.system, messages: chat.messages, fallback: () => chat.fallback, maxTokens: 400 },
          (s) => (state.source = s),
          req.signal,
        ))
          send({ t: piece });
      } catch {
        send({ t: chat.fallback });
        state.source = "fallback";
      }
      send({ done: true, source: state.source, model: state.source === "llm" ? model : "", lang: chat.lang, ...(chat.offTopic ? { links: [], sources: [], offices: [] } : { links: chat.links, sources: chat.sources, offices: chat.offices }) });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
