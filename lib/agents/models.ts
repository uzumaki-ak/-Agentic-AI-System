// this file handles model provider fallback and api calls
import { ChatMessage, ModelCallTrace } from "@/lib/agents/types";

type ProviderName = "openrouter" | "google" | "groq" | "euron";

type ProviderConfig = {
  name: ProviderName;
  endpoint: string;
  apiKey: string;
  models: string[];
};

type RunOptions = {
  temperature?: number;
  maxTokens?: number;
};

// this class carries detailed model traces when calls fail
export class ModelExecutionError extends Error {
  trace: ModelCallTrace[];

  constructor(message: string, trace: ModelCallTrace[]) {
    super(message);
    this.name = "ModelExecutionError";
    this.trace = trace;
  }
}

// this function parses csv env values into a clean list
function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value || !value.trim()) {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// this function returns providers in user configured order
function resolveProviders(): ProviderConfig[] {
  const providerMap: Record<ProviderName, ProviderConfig | null> = {
    openrouter: process.env.OPENROUTER_API_KEY
      ? {
          name: "openrouter",
          apiKey: process.env.OPENROUTER_API_KEY,
          endpoint:
            process.env.OPENROUTER_BASE_URL ??
            "https://openrouter.ai/api/v1/chat/completions",
          models: parseCsv(process.env.OPENROUTER_MODELS, [
            "openrouter/free",
            "openai/gpt-oss-20b:free"
          ])
        }
      : null,
    google: process.env.GOOGLE_GEMINI_API_KEY
      ? {
          name: "google",
          apiKey: process.env.GOOGLE_GEMINI_API_KEY,
          endpoint:
            process.env.GOOGLE_GEMINI_BASE_URL ??
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          models: parseCsv(process.env.GOOGLE_GEMINI_MODELS, [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite"
          ])
        }
      : null,
    groq: process.env.GROQ_API_KEY
      ? {
          name: "groq",
          apiKey: process.env.GROQ_API_KEY,
          endpoint:
            process.env.GROQ_BASE_URL ??
            "https://api.groq.com/openai/v1/chat/completions",
          models: parseCsv(process.env.GROQ_MODELS, ["llama-3.1-8b-instant"])
        }
      : null,
    euron: process.env.EURON_API_KEY
      ? {
          name: "euron",
          apiKey: process.env.EURON_API_KEY,
          endpoint:
            process.env.EURON_BASE_URL ??
            "https://api.euron.one/api/v1/euri/chat/completions",
          models: parseCsv(process.env.EURON_MODELS, [
            "gpt-4.1-nano",
            "gpt-4.1-mini",
            "openai/gpt-oss-20b"
          ])
        }
      : null
  };

  const order = parseCsv(process.env.MODEL_PROVIDER_ORDER, [
    "google",
    "openrouter",
    "groq",
    "euron"
  ]) as ProviderName[];

  const output: ProviderConfig[] = [];
  const used = new Set<ProviderName>();

  for (const name of order) {
    const provider = providerMap[name];
    if (provider) {
      output.push(provider);
      used.add(name);
    }
  }

  for (const [name, provider] of Object.entries(providerMap) as [
    ProviderName,
    ProviderConfig | null
  ][]) {
    if (provider && !used.has(name)) {
      output.push(provider);
    }
  }

  return output;
}

// this function normalizes content from open ai compatible responses
function readContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (
          typeof item === "object" &&
          item !== null &&
          "text" in item &&
          typeof (item as { text: unknown }).text === "string"
        ) {
          return (item as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean);
    return parts.join("\n");
  }
  return "";
}

// this function reads the best message content from a provider payload
function extractAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0] as {
    message?: { content?: unknown };
    text?: string;
  };
  const fromMessage = readContentText(first?.message?.content);
  if (fromMessage.trim()) {
    return fromMessage.trim();
  }
  if (typeof first.text === "string" && first.text.trim()) {
    return first.text.trim();
  }
  return "";
}

// this function performs one model call for a specific provider and model
async function callModel(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  options: RunOptions
): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${provider.apiKey}`
  };

  if (provider.name === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000";
    headers["X-Title"] = "mini-agentic-ai-system";
  }

  if (provider.name === "google") {
    headers["x-goog-api-key"] = provider.apiKey;
  }

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 700
    }),
    cache: "no-store"
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`status ${response.status}: ${raw.slice(0, 220)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid json response: ${raw.slice(0, 220)}`);
  }

  const text = extractAssistantText(parsed);
  if (!text) {
    throw new Error("empty model response");
  }

  return text;
}

// this function returns a readable error string for traces
function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 220);
  }
  return "unknown error";
}

// this function runs model calls with provider and model fallback
export async function runWithFallback(
  messages: ChatMessage[],
  options: RunOptions = {}
): Promise<{ text: string; trace: ModelCallTrace[] }> {
  const providers = resolveProviders();
  const trace: ModelCallTrace[] = [];

  if (providers.length === 0) {
    throw new ModelExecutionError("no provider api key found", trace);
  }

  for (const provider of providers) {
    for (const model of provider.models) {
      try {
        const text = await callModel(provider, model, messages, options);
        trace.push({
          provider: provider.name,
          model,
          success: true
        });
        return { text, trace };
      } catch (error) {
        trace.push({
          provider: provider.name,
          model,
          success: false,
          error: normalizeError(error)
        });
      }
    }
  }

  throw new ModelExecutionError("all provider models failed", trace);
}

// this function safely reads trace history from errors
export function readTraceFromError(error: unknown): ModelCallTrace[] {
  if (error instanceof ModelExecutionError) {
    return error.trace;
  }
  return [];
}
