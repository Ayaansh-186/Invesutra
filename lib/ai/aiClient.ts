// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionToolMessageParam } from "openai/resources/chat/completions";

export interface ChatTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // Present on assistant turns that requested tool calls, and echoed back
  // on the corresponding "tool" turn via toolCallId.
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string, matches OpenAI's function-calling shape
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatCompletionResult {
  text: string;
  provider: AIProvider;
  toolCalls?: ToolCall[];
}

export type AIProvider = "groq" | "gemini" | "openai";

/**
 * Tool/function calling is supported for all three providers. Groq and
 * OpenAI share an OpenAI-compatible /chat/completions shape; Gemini uses
 * its own functionDeclarations/functionCall format, handled separately
 * below (toGeminiContentsWithTools / callGeminiWithTools).
 */
export const TOOL_CALLING_PROVIDERS: AIProvider[] = ["groq", "gemini", "openai"];

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const providerRetryAfter: Partial<Record<AIProvider, number>> = {};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function isRateLimitError(error: unknown): boolean {
  const maybe = error as { status?: number; code?: string; error?: { code?: string; message?: string } };
  const text = errorText(error).toLowerCase();
  return (
    maybe?.status === 429 ||
    maybe?.code === "rate_limit_exceeded" ||
    maybe?.error?.code === "rate_limit_exceeded" ||
    text.includes("429") ||
    text.includes("rate limit") ||
    text.includes("quota exceeded")
  );
}

function markRateLimited(provider: AIProvider, error: unknown) {
  if (!isRateLimitError(error)) return;
  providerRetryAfter[provider] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

function isTemporarilyRateLimited(provider: AIProvider): boolean {
  const retryAt = providerRetryAfter[provider];
  return typeof retryAt === "number" && retryAt > Date.now();
}

/**
 * Groq exposes an OpenAI-compatible /chat/completions endpoint, so we reuse
 * the already-installed `openai` package and just point it at Groq's base
 * URL instead of adding a new dependency.
 */
let groqClient: OpenAI | null = null;
function getGroqClient(): OpenAI {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set.");
  }
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

// Deprecated on Groq as of June 2026 — openai/gpt-oss-120b is the
// recommended migration target and is free-tier friendly.
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** Converts our provider-agnostic ChatTurn[] into the OpenAI SDK's message shape. */
function toOpenAIMessages(messages: ChatTurn[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId || "",
        content: m.content,
      } satisfies ChatCompletionToolMessageParam;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content } as ChatCompletionMessageParam;
  });
}

function toOpenAITools(tools?: ToolDefinition[]): ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

interface ProviderCallResult {
  text: string;
  toolCalls?: ToolCall[];
}

async function callGroq(
  messages: ChatTurn[],
  jsonMode?: boolean,
  tools?: ToolDefinition[],
  toolChoice?: "auto" | "none"
): Promise<ProviderCallResult> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.35,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(tools ? { tools: toOpenAITools(tools), tool_choice: toolChoice ?? "auto" } : {}),
    messages: toOpenAIMessages(messages),
  });
  const message = completion.choices[0]?.message;
  const toolCalls = message?.tool_calls
    ?.filter((tc) => tc.type === "function")
    .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
  const text = message?.content?.trim() || "";
  if (!text && !toolCalls?.length) throw new Error("Empty Groq response");
  return { text, toolCalls };
}

// "gemini-flash-latest" is Google's auto-updated alias for the current GA
// Flash model, so this keeps working as Google ships new Gemini versions.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

async function callGemini(messages: ChatTurn[], jsonMode?: boolean): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  // Gemini's generateContent API doesn't have a "system" role — fold any
  // system message into the first user turn instead.
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conversation = messages.filter((m) => m.role !== "system");

  const contents = conversation.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          i === 0 && systemMessages.length
            ? `${systemMessages.join("\n\n")}\n\n${m.content}`
            : m.content,
      },
    ],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.35,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim();
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

/** Gemini accepts a JSON-Schema-like "functionDeclarations" shape that our
 * existing ToolDefinition.parameters (plain JSON Schema) maps onto directly
 * — no conversion needed beyond wrapping. */
function toGeminiTools(tools?: ToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
}

/** Converts our provider-agnostic ChatTurn[] into Gemini's `contents` shape,
 * including assistant tool-call turns and tool-response turns — Gemini's
 * function-calling conversation format, distinct from plain callGemini(). */
function toGeminiContentsWithTools(messages: ChatTurn[]) {
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conversation = messages.filter((m) => m.role !== "system");
  let systemFolded = false;

  return conversation.map((m) => {
    if (m.role === "tool") {
      return {
        role: "function",
        parts: [{ functionResponse: { name: m.name || "unknown_tool", response: safeJsonParse(m.content) } }],
      };
    }

    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "model",
        parts: m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: safeJsonParse(tc.arguments) },
        })),
      };
    }

    const prefix = !systemFolded && systemMessages.length && m.role === "user" ? `${systemMessages.join("\n\n")}\n\n` : "";
    if (prefix) systemFolded = true;

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: `${prefix}${m.content}` }],
    };
  });
}

async function callGeminiWithTools(
  messages: ChatTurn[],
  tools?: ToolDefinition[],
  jsonMode?: boolean,
  toolChoice?: "auto" | "none"
): Promise<ProviderCallResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const contents = toGeminiContentsWithTools(messages);
  const geminiTools = toGeminiTools(tools);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents,
        ...(geminiTools ? { tools: geminiTools } : {}),
        ...(geminiTools && toolChoice === "none"
          ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } }
          : {}),
        generationConfig: {
          temperature: 0.35,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> =
    data?.candidates?.[0]?.content?.parts || [];

  const text = parts.map((p) => p.text || "").join("").trim();
  const toolCalls: ToolCall[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: `gemini-${Date.now()}-${i}`,
      name: p.functionCall!.name,
      arguments: JSON.stringify(p.functionCall!.args ?? {}),
    }));

  if (!text && toolCalls.length === 0) throw new Error("Empty Gemini response");
  return { text, toolCalls: toolCalls.length ? toolCalls : undefined };
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function callOpenAI(
  messages: ChatTurn[],
  jsonMode?: boolean,
  tools?: ToolDefinition[],
  toolChoice?: "auto" | "none"
): Promise<ProviderCallResult> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.35,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(tools ? { tools: toOpenAITools(tools), tool_choice: toolChoice ?? "auto" } : {}),
    messages: toOpenAIMessages(messages),
  });
  const message = completion.choices[0]?.message;
  const toolCalls = message?.tool_calls
    ?.filter((tc) => tc.type === "function")
    .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
  const text = message?.content?.trim() || "";
  if (!text && !toolCalls?.length) throw new Error("Empty OpenAI response");
  return { text, toolCalls };
}

/**
 * Provider priority: Groq -> Gemini -> OpenAI. Groq and Gemini are tried
 * first because they currently have the most generous free tiers; OpenAI is
 * kept as a last resort in case a paid key is restored later. Only
 * providers with a configured API key are attempted. If every configured
 * provider fails (rate limit, quota, network), the error from the last
 * attempt is thrown so the caller can fall back to the deterministic
 * (non-AI) answer.
 */
export async function getAIChatCompletion(
  messages: ChatTurn[],
  options?: { jsonMode?: boolean }
): Promise<{ text: string; provider: AIProvider }> {
  const jsonMode = options?.jsonMode;
  const attempts: Array<{ provider: AIProvider; enabled: boolean; call: () => Promise<ProviderCallResult> }> = [
    { provider: "groq", enabled: Boolean(process.env.GROQ_API_KEY), call: () => callGroq(messages, jsonMode) },
    {
      provider: "gemini",
      enabled: Boolean(process.env.GEMINI_API_KEY),
      call: async () => ({ text: await callGemini(messages, jsonMode) }),
    },
    { provider: "openai", enabled: Boolean(process.env.OPENAI_API_KEY), call: () => callOpenAI(messages, jsonMode) },
  ];

  let lastError: unknown = new Error(
    "No AI provider is configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
  );

  for (const attempt of attempts) {
    if (!attempt.enabled || isTemporarilyRateLimited(attempt.provider)) continue;
    try {
      const { text } = await attempt.call();
      return { text, provider: attempt.provider };
    } catch (error) {
      markRateLimited(attempt.provider, error);
      console.error(`AI provider "${attempt.provider}" failed, trying next:`, error);
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Same provider fallback chain as getAIChatCompletion, but supports tool
 * (function) calling — Groq, Gemini, and OpenAI, in that order. If none
 * are configured, throws so the caller can fall back to the deterministic
 * answer.
 */
export async function getAIChatCompletionWithTools(
  messages: ChatTurn[],
  tools: ToolDefinition[],
  options?: { jsonMode?: boolean; toolChoice?: "auto" | "none" }
): Promise<ChatCompletionResult> {
  const jsonMode = options?.jsonMode;
  const toolChoice = options?.toolChoice;
  const attempts: Array<{ provider: AIProvider; enabled: boolean; call: () => Promise<ProviderCallResult> }> = [
    {
      provider: "groq",
      enabled: Boolean(process.env.GROQ_API_KEY),
      call: () => callGroq(messages, jsonMode, tools, toolChoice),
    },
    {
      provider: "gemini",
      enabled: Boolean(process.env.GEMINI_API_KEY),
      call: () => callGeminiWithTools(messages, tools, jsonMode, toolChoice),
    },
    {
      provider: "openai",
      enabled: Boolean(process.env.OPENAI_API_KEY),
      call: () => callOpenAI(messages, jsonMode, tools, toolChoice),
    },
  ];

  let lastError: unknown = new Error(
    "No tool-calling-capable AI provider is configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
  );

  for (const attempt of attempts) {
    if (!attempt.enabled || isTemporarilyRateLimited(attempt.provider)) continue;
    try {
      const { text, toolCalls } = await attempt.call();
      return { text, provider: attempt.provider, toolCalls };
    } catch (error) {
      markRateLimited(attempt.provider, error);
      console.error(`AI provider "${attempt.provider}" (tools) failed, trying next:`, error);
      lastError = error;
    }
  }

  throw lastError;
}
