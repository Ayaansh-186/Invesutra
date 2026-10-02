import assert from "node:assert/strict";
import test from "node:test";
import { createAccountRequestCache } from "../lib/utils/accountRequestCache";
import { mapConcurrent } from "../lib/utils/mapConcurrent";
import { valuationSummary } from "../lib/marketData/valuationSummary";
import { SAMPLE_PORTFOLIO } from "../lib/utils/mockData";

test("account requests share in-flight work and reuse only a short-lived memory cache", async () => {
  let time = 100;
  let calls = 0;
  let release!: (value: string) => void;
  const cache = createAccountRequestCache(() => { calls++; return new Promise<string>(resolve => { release = resolve; }); }, 30, () => time);
  cache.setOwner("owner-a");
  const first = cache.read("portfolio");
  const second = cache.read("portfolio");
  assert.equal(calls, 1);
  release("verified");
  assert.deepEqual(await Promise.all([first, second]), ["verified", "verified"]);
  assert.equal(await cache.read("portfolio"), "verified");
  assert.equal(calls, 1);
  time += 31;
  const expired = cache.read("portfolio");
  assert.equal(calls, 2);
  release("newer");
  assert.equal(await expired, "newer");
});

test("component cancellation does not abort another consumer's request", async () => {
  let release!: (value: string) => void;
  const cache = createAccountRequestCache(() => new Promise<string>(resolve => { release = resolve; }));
  cache.setOwner("owner");
  const controller = new AbortController();
  const cancelled = cache.read("portfolio", controller.signal);
  const active = cache.read("portfolio");
  const rejected = assert.rejects(cancelled, { name: "AbortError" });
  controller.abort();
  release("data");
  await rejected;
  assert.equal(await active, "data");
});

test("account switching and mutation invalidation cannot reuse old financial responses", async () => {
  const releases: ((value: string) => void)[] = [];
  const cache = createAccountRequestCache(() => new Promise<string>(resolve => { releases.push(resolve); }));
  cache.setOwner("owner-a");
  const old = cache.read("portfolio");
  cache.setOwner("owner-b");
  const next = cache.read("portfolio");
  releases[0]("old"); releases[1]("new");
  await old;
  assert.equal(await next, "new");
  assert.equal(await cache.read("portfolio"), "new");
  cache.invalidate();
  const changed = cache.read("portfolio");
  assert.equal(releases.length, 3);
  releases[2]("corrected");
  assert.equal(await changed, "corrected");
  cache.setOwner(null);
  await assert.rejects(cache.read("portfolio"), /signed-in account/);
});

test("failed account requests are not cached and can retry", async () => {
  let calls = 0;
  const cache = createAccountRequestCache(async () => {
    if (++calls === 1) throw new Error("offline");
    return "recovered";
  });
  cache.setOwner("owner");
  await assert.rejects(cache.read("portfolio"), /offline/);
  assert.equal(await cache.read("portfolio"), "recovered");
});

test("concurrent work is bounded, preserves order and does not wait for a whole wave", async () => {
  let running = 0;
  let maximum = 0;
  const started: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const output = mapConcurrent([0,1,2,3], 2, async value => {
    started.push(value); running++; maximum = Math.max(maximum, running);
    if (value === 0) await gate;
    running--; return value * 2;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0,1,2,3]);
  release();
  assert.deepEqual(await output, [0,2,4,6]);
  assert.equal(maximum, 2);
  assert.deepEqual(await mapConcurrent([], 2, async value => value), []);
  await assert.rejects(mapConcurrent([], 0, async value => value), /positive integer/);
});

test("partial valuation totals include only verified values and actual publication dates", () => {
  const portfolio = {...SAMPLE_PORTFOLIO, funds:[
    {...SAMPLE_PORTFOLIO.funds[0],currentValue:2500,valuationStatus:"verified" as const,navAsOf:"01-10-2026"},
    {...SAMPLE_PORTFOLIO.funds[0],currentValue:1500,valuationStatus:"verified" as const,navAsOf:"30-09-2026"},
    {...SAMPLE_PORTFOLIO.funds[0],currentValue:999999,valuationStatus:"stale" as const,navAsOf:"01-01-2020"},
  ]};
  assert.deepEqual(valuationSummary(portfolio), {verifiedCount:2,totalCount:3,verifiedValue:4000,oldestNavDate:"2026-09-30",latestNavDate:"2026-10-01"});
});
