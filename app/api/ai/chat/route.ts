import { askAssistant } from "@/lib/integrations/assistant";
import { badRequest, isProfile, readJson } from "../_shared";

export async function POST(req: Request) {
  const body = await readJson(req);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return badRequest("message is required");
  if (message.length > 1000) return badRequest("message is too long (max 1000 characters)");

  const history = Array.isArray(body?.history)
    ? body.history
        .filter((m): m is { role: "user" | "assistant"; content: string } => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
        .slice(-10)
    : [];
  const lang = body?.lang === "ar" || body?.lang === "en" ? body.lang : undefined;

  return Response.json(await askAssistant({ message, history, lang, profile: isProfile(body?.profile) ? body.profile : undefined }));
}
