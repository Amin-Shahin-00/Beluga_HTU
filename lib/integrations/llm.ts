// The only place in Bedaya that calls an AI API. Every AI feature goes through generate().
//
// Order of answers:
//   1. mock mode (LLM_PROVIDER=mock, the default, or no key): the feature's deterministic fallback
//   2. demo cache (exact demo questions, so a real-model demo works if the API is slow or offline)
//   3. the real model, with a timeout; on timeout, error or refusal it falls back to (1)
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
  /** Deterministic answer used in mock mode and whenever the API is slow, failing or refuses. */
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

export function llmConfig() {
  return {
    provider: (process.env.LLM_PROVIDER ?? "mock") as "mock" | "anthropic",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL || "claude-opus-5",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 8000),
    // Low effort keeps chat answers fast enough for a live demo; raise it if answers need more reasoning.
    effort: (process.env.LLM_EFFORT ?? "low") as "low" | "medium" | "high",
  };
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

export async function generate(req: LlmRequest): Promise<LlmResult> {
  const started = Date.now();
  const done = (text: string, source: LlmSource, error?: string): LlmResult => {
    if (recorder && req.cacheKey && source !== "cache") recorder[cacheId(req.task, req.cacheKey)] = text;
    return { text, source, latencyMs: Date.now() - started, ...(error ? { error } : {}) };
  };

  const config = llmConfig();
  // Mock mode is already offline and instant, and always reflects the latest data, so it skips the cache.
  if (config.provider === "mock" || !config.apiKey) return done(await req.fallback(), "mock");

  if (req.cacheKey && process.env.DEMO_CACHE !== "off") {
    const hit = cache[cacheId(req.task, req.cacheKey)];
    if (hit) return done(hit, "cache");
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

/** Parses JSON the model was asked to return, tolerating a ```json fence. Returns null if it isn't valid. */
export function parseJson<T>(text: string): T | null {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
