import test from "node:test";
import assert from "node:assert/strict";
import { GroqPool, groqCredentials, retryDelay } from "../lib/ai/groqPool";
import { getAIChatCompletion, getAIChatCompletionWithTools } from "../lib/ai/aiClient";

test("Groq credentials deduplicate keys and default to a shared quota group", () => {
  assert.deepEqual(groqCredentials({ GROQ_API_KEY: " first ", GROQ_API_KEY_2: "first", GROQ_API_KEY_3: "other", GROQ_QUOTA_GROUP_3: "org-b" }), [
    { apiKey: "first", quotaGroup: "shared" }, { apiKey: "other", quotaGroup: "org-b" },
  ]);
});

test("429 skips the same quota group, tries another and respects retry-after", async () => {
  let now = 0;
  const pool = new GroqPool(() => now);
  const credentials = [{ apiKey: "a", quotaGroup: "one" }, { apiKey: "b", quotaGroup: "one" }, { apiKey: "c", quotaGroup: "two" }];
  const calls: string[] = [];
  const call = async ({ apiKey }: { apiKey: string }) => {
    calls.push(apiKey);
    if (apiKey === "a") throw { status: 429, headers: new Headers({ "retry-after": "120" }) };
    return { data: "ok", headers: new Headers() };
  };
  assert.equal(await pool.run(credentials, call), "ok");
  assert.deepEqual(calls, ["a", "c"]);
  calls.length = 0;
  now = 119_000;
  await pool.run(credentials, call);
  assert.deepEqual(calls, ["c"]);
  calls.length = 0;
  now = 121_000;
  await pool.run(credentials, call);
  assert.deepEqual(calls, ["a", "c"]);
});

test("invalid keys cool down without disabling another key in the same organization", async () => {
  const pool = new GroqPool(() => 0);
  const calls: string[] = [];
  assert.equal(await pool.run([{ apiKey: "bad", quotaGroup: "one" }, { apiKey: "good", quotaGroup: "one" }], async ({ apiKey }) => {
    calls.push(apiKey);
    if (apiKey === "bad") throw { status: 401 };
    return { data: "ok", headers: new Headers() };
  }), "ok");
  assert.deepEqual(calls, ["bad", "good"]);
});

test("successful exhausted quota headers prevent the next unnecessary request", async () => {
  let now = 0;
  const pool = new GroqPool(() => now);
  const credentials = [{ apiKey: "one", quotaGroup: "one" }];
  let calls = 0;
  const call = async () => { calls++; return { data: "ok", headers: new Headers({ "x-ratelimit-remaining-requests": "0", "x-ratelimit-reset-requests": "1h2m3s" }) }; };
  await pool.run(credentials, call);
  await assert.rejects(pool.run(credentials, call));
  assert.equal(calls, 1);
  now = 3_724_000;
  await pool.run(credentials, call);
  assert.equal(calls, 2);
});

test("malformed requests do not fan out across all credentials", async () => {
  const pool = new GroqPool(() => 0);
  let calls = 0;
  await assert.rejects(pool.run([{ apiKey: "a", quotaGroup: "a" }, { apiKey: "b", quotaGroup: "b" }], async () => { calls++; throw { status: 400 }; }));
  assert.equal(calls, 1);
});

test("retry-after handles seconds, dates and missing headers", () => {
  assert.equal(retryDelay(new Headers({ "retry-after": "2" }), 0), 2000);
  assert.equal(retryDelay(new Headers({ "retry-after": "Thu, 01 Jan 1970 00:01:00 GMT" }), 0), 60_000);
  assert.equal(retryDelay(), 60_000);
});

test("the real SDK uses backup keys and shares cooldown between plain and tool requests", async () => {
  const names = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_QUOTA_GROUP", "GROQ_QUOTA_GROUP_2"];
  const previous = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  try {
    process.env.GROQ_API_KEY = "synthetic-primary";
    process.env.GROQ_API_KEY_2 = "synthetic-backup";
    process.env.GROQ_QUOTA_GROUP = "test-primary";
    process.env.GROQ_QUOTA_GROUP_2 = "test-backup";
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const authorization = request.headers.get("authorization") || "";
      calls.push(authorization);
      const body = await request.json();
      assert.equal(body.max_completion_tokens, 2048);
      assert.equal(body.messages[0].content, "Synthetic question");
      if (authorization.endsWith("synthetic-primary")) return new Response(JSON.stringify({ error: { message: "Rate limit", type: "rate_limit_exceeded" } }), { status: 429, headers: { "content-type": "application/json", "retry-after": "120" } });
      assert.equal(authorization, "Bearer synthetic-backup");
      return new Response(JSON.stringify({ id: "test", object: "chat.completion", created: 0, model: "test", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Synthetic answer" } }] }), { headers: { "content-type": "application/json" } });
    };
    assert.equal((await getAIChatCompletion([{ role: "user", content: "Synthetic question" }])).text, "Synthetic answer");
    assert.equal((await getAIChatCompletionWithTools([{ role: "user", content: "Synthetic question" }], [])).provider, "groq");
    assert.deepEqual(calls, ["Bearer synthetic-primary", "Bearer synthetic-backup", "Bearer synthetic-backup"]);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
