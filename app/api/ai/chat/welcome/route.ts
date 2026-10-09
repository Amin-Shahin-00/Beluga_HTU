// GET /api/ai/chat/welcome?lang=ar|en → a personal greeting, suggested questions and which AI engine is answering.
// Also warms up the local model so the first answer is quick.
import { chatWelcome } from "@/lib/integrations/assistant/chatbot";
import { modelStatus } from "@/lib/integrations/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "ar";
  const [welcome, engine] = await Promise.all([chatWelcome(lang), modelStatus()]);
  return Response.json({ ...welcome, engine }, { headers: { "Cache-Control": "no-store" } });
}
