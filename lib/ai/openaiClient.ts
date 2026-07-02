import OpenAI from "openai";

let client: OpenAI | null = null;

/**
 * Lazily instantiate the OpenAI client so the app can still build and run
 * in demo mode without an API key configured.
 */
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment to enable live AI analysis.");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
