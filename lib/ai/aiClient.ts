import OpenAI from "openai";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AIProvider = "groq" | "gemini" | "openai";

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

async function callGroq(messages: ChatTurn[], jsonMode?: boolean): Promise<string> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.35,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
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

async function callOpenAI(messages: ChatTurn[], jsonMode?: boolean): Promise<string> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.35,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty OpenAI response");
  return text;
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
  const attempts: Array<{ provider: AIProvider; enabled: boolean; call: () => Promise<string> }> = [
    { provider: "groq", enabled: Boolean(process.env.GROQ_API_KEY), call: () => callGroq(messages, jsonMode) },
    { provider: "gemini", enabled: Boolean(process.env.GEMINI_API_KEY), call: () => callGemini(messages, jsonMode) },
    { provider: "openai", enabled: Boolean(process.env.OPENAI_API_KEY), call: () => callOpenAI(messages, jsonMode) },
  ];

  let lastError: unknown = new Error(
    "No AI provider is configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
  );

  for (const attempt of attempts) {
    if (!attempt.enabled) continue;
    try {
      const text = await attempt.call();
      return { text, provider: attempt.provider };
    } catch (error) {
      console.error(`AI provider "${attempt.provider}" failed, trying next:`, error);
      lastError = error;
    }
  }

  throw lastError;
}
