// The only place in Bedaya that calls an AI model. Every AI feature goes through generate() (or
// streamChat() for the chatbot).
//
// Providers (LLM_PROVIDER):
//   mock      (default) each feature's deterministic fallback; no model, no key
//   ollama    an open-source model running locally through Ollama (e.g. qwen2.5:7b); free, offline,
//             nothing leaves the machine. LLM_TASKS limits which features use it (long outputs stay offline).
//   anthropic Claude through the Anthropic API (needs LLM_API_KEY and BEDAYA_ALLOW_EXTERNAL_AI=true)
//
// Order of answers: mock mode → demo cache → the model with a timeout; on timeout, error or refusal
// every feature falls back to its deterministic answer.
import Anthropic from "@anthropic-ai/sdk";
import demoCache from "./demo-cache.json";

export type LlmSource = "cache" | "llm" | "mock" | "fallback";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  /** Feature name, also the demo-cache namespace: "chat", "doc_warning", "match_reason", "business_plan". */
  task: string;
  system: string;
  messages: LlmMessage[];
  /** Deterministic answer used in mock mode and whenever the model is slow, failing or refuses. */
  fallback: () => string | Promise<string>;
  /** Exact key for the demo cache, e.g. the normalized question. */
  cacheKey?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  source: LlmSource;
  latencyMs: number;
  error?: string;
}

type Provider = "mock" | "anthropic" | "ollama";
// Features the local model handles by default: the chatbot and short Launch Studio drafts.
// "copilot" covers the copilot's brief, plan recommendations and document drafts.
const OLLAMA_DEFAULT_TASKS = ["chat", "copilot", "studio_names", "studio_tone"];

export function llmConfig() {
  const provider = (process.env.LLM_PROVIDER ?? "mock") as Provider;
  return {
    provider,
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL || (provider === "ollama" ? "qwen2.5:7b" : "claude-opus-5"),
    ollamaUrl: (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    tasks: (process.env.LLM_TASKS || (provider === "ollama" ? OLLAMA_DEFAULT_TASKS.join(",") : "*")).split(",").map((s) => s.trim()),
    // The local model gets its own, longer limit: the first answer includes loading it onto the GPU.
    timeoutMs: provider === "ollama" ? Number(process.env.OLLAMA_TIMEOUT_MS || 60000) : Number(process.env.LLM_TIMEOUT_MS || 8000),
    // Low effort keeps chat answers fast enough for a live demo; raise it if answers need more reasoning.
    effort: (process.env.LLM_EFFORT ?? "low") as "low" | "medium" | "high",
  };
}

// The same options everywhere (chat and warm-up): a different context size makes Ollama reload the
// model (~10 s). LLM_CONTEXT: tokens of context; 6144 suits a 6 GB GPU.
const ollamaOptions = (numPredict: number) => ({ temperature: 0.2, num_ctx: Number(process.env.LLM_CONTEXT || 6144), num_predict: numPredict });

const isLocal = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(url);

/** Which provider actually serves this task right now (after the safety switches). */
export function activeProvider(task: string): Provider {
  const c = llmConfig();
  if (c.provider === "mock") return "mock";
  if (!c.tasks.includes("*") && !c.tasks.includes(task)) return "mock";
  // M4 integration: external AI is opt-in; importing M5 must not transmit profiles. A local Ollama sends nothing out.
  if (c.provider === "ollama") return isLocal(c.ollamaUrl) || process.env.BEDAYA_ALLOW_EXTERNAL_AI === "true" ? "ollama" : "mock";
  if (process.env.BEDAYA_ALLOW_EXTERNAL_AI !== "true" || !c.apiKey) return "mock";
  return "anthropic";
}

const cache = demoCache as Record<string, string>;
export const cacheId = (task: string, key: string) => `${task}:${key}`;

let client: Anthropic | null = null;

// scripts/build-demo-cache.ts records every answer produced during a demo run.
let recorder: Record<string, string> | null = null;
export function startRecording(): Record<string, string> {
  recorder = {};
  return recorder;
}

async function ollamaChat(req: LlmRequest, stream: false): Promise<string>;
async function ollamaChat(req: LlmRequest, stream: true): Promise<Response>;
async function ollamaChat(req: LlmRequest, stream: boolean): Promise<string | Response> {
  const c = llmConfig();
  const res = await fetch(`${c.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(req.timeoutMs ?? c.timeoutMs),
    body: JSON.stringify({
      model: c.model,
      stream,
      keep_alive: "60m",
      messages: [{ role: "system", content: req.system }, ...req.messages],
      options: ollamaOptions(req.maxTokens ?? 1200),
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  if (stream) return res;
  const data = (await res.json()) as { message?: { content?: string } };
  return (data.message?.content ?? "").trim();
}

export async function generate(req: LlmRequest): Promise<LlmResult> {
  const started = Date.now();
  const done = (text: string, source: LlmSource, error?: string): LlmResult => {
    if (recorder && req.cacheKey && source !== "cache") recorder[cacheId(req.task, req.cacheKey)] = text;
    return { text, source, latencyMs: Date.now() - started, ...(error ? { error } : {}) };
  };

  const config = llmConfig();
  const provider = activeProvider(req.task);
  // Mock mode is already offline and instant, and always reflects the latest data, so it skips the cache.
  if (provider === "mock") return done(await req.fallback(), "mock");

  if (req.cacheKey && process.env.DEMO_CACHE !== "off" && provider === "anthropic") {
    const hit = cache[cacheId(req.task, req.cacheKey)];
    if (hit) return done(hit, "cache");
  }

  if (provider === "ollama") {
    try {
      const text = await ollamaChat(req, false);
      return text ? done(text, "llm") : done(await req.fallback(), "fallback", "empty response");
    } catch (error) {
      return done(await req.fallback(), "fallback", String(error));
    }
  }

  try {
    client ??= new Anthropic({ apiKey: config.apiKey, maxRetries: 0 });
    const response = await client.beta.messages.create(
      {
        model: config.model,
        max_tokens: req.maxTokens ?? 2000,
        system: req.system,
        messages: req.messages,
        output_config: { effort: config.effort },
        // If the model declines, the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { timeout: req.timeoutMs ?? config.timeoutMs },
    );
    if (response.stop_reason === "refusal") return done(await req.fallback(), "fallback", "refusal");
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) return done(await req.fallback(), "fallback", "empty response");
    return done(text, "llm");
  } catch (error) {
    const reason =
      error instanceof Anthropic.APIConnectionTimeoutError
        ? "timeout"
        : error instanceof Anthropic.APIError
          ? `api error ${error.status ?? ""}`.trim()
          : String(error);
    return done(await req.fallback(), "fallback", reason);
  }
}

/**
 * Streams the chatbot's answer as text chunks. With Ollama the words arrive as the model writes them;
 * other providers deliver the whole answer at once. `onSource` reports where the text came from.
 * If the model fails before writing anything, the deterministic fallback is streamed instead.
 */
export async function* streamChat(req: LlmRequest, onSource: (s: LlmSource) => void, signal?: AbortSignal): AsyncGenerator<string> {
  if (activeProvider(req.task) !== "ollama") {
    const r = await generate(req);
    onSource(r.source);
    yield r.text;
    return;
  }
  let wrote = false;
  try {
    const res = await ollamaChat(req, true);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    onSource("llm");
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const piece = (JSON.parse(line) as { message?: { content?: string } }).message?.content;
        if (piece) {
          wrote = true;
          yield piece;
        }
      }
    }
    if (!wrote) throw new Error("empty response");
  } catch (error) {
    if (wrote) return; // keep what was already shown
    onSource("fallback");
    yield await req.fallback();
    void error;
  }
}

/** Is the local model reachable and loaded? Also warms it up so the first answer is fast. */
export async function modelStatus(): Promise<{ provider: Provider; model: string; ready: boolean }> {
  const c = llmConfig();
  const provider = activeProvider("chat");
  if (provider !== "ollama") return { provider, model: provider === "anthropic" ? c.model : "", ready: provider === "anthropic" };
  try {
    const tags = (await (await fetch(`${c.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) })).json()) as { models?: { name: string }[] };
    const ready = Boolean(tags.models?.some((m) => m.name === c.model || m.name.startsWith(`${c.model}:`) || m.name === `${c.model}:latest`));
    // Load the model into memory in the background (an empty prompt only loads it).
    if (ready) void fetch(`${c.ollamaUrl}/api/chat`, { method: "POST", body: JSON.stringify({ model: c.model, messages: [], keep_alive: "60m", options: ollamaOptions(1) }) }).catch(() => {});
    return { provider, model: c.model, ready };
  } catch {
    return { provider, model: c.model, ready: false };
  }
}

/** Parses JSON the model was asked to return, tolerating a ```json fence. Returns null if it isn't valid. */
export function parseJson<T>(text: string): T | null {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(body) as T;
  } catch {
    // Small models sometimes add a sentence around the JSON: take the outermost object.
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
