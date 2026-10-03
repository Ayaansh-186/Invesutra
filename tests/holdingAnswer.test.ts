import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_PORTFOLIO, SAMPLE_FUNDS } from "../lib/utils/mockData";
import { answerHoldingQuestion, detectPortfolioIntent } from "../lib/ai/holdingAnswer";
import { answerPortfolioQuestion, portfolioSystemPrompt } from "../lib/ai/portfolioAssistant";
import { DETAILED_AI_CONSENT_VERSION, hasDetailedAIConsent } from "../lib/ai/privacy";
import type { Portfolio } from "../lib/types";

const quant = { ...SAMPLE_FUNDS[0], id: "quant", name: "Quant Infrastructure Fund - Direct Plan - Growth",
  category: "sectoral" as const, investedAmount: 85000, currentValue: 81250, units: 100, nav: 812.5,
  purchaseStatus: "verified" as const, valuationStatus: "verified" as const, navAsOf: "01-10-2026" };
const portfolio: Portfolio = { ...SAMPLE_PORTFOLIO, funds: [quant], totalInvested: 85000,
  currentValue: 81250, returns: -3750, returnsPercent: -3750 / 85000 * 100,
  valuationComplete: true, purchaseComplete: true };

test("fund explanation, NAV and units questions answer the requested subject", () => {
  assert.match(answerHoldingQuestion(portfolio, "Explain Quant Infrastructure Fund in my saved portfolio. What should I review about this holding?")!, /First check/);
  const nav = answerHoldingQuestion(portfolio, "quant nav")!;
  assert.match(nav, /latest verified published NAV/);
  assert.doesNotMatch(nav, /unrealized loss/);
  assert.match(answerHoldingQuestion(portfolio, "quant units")!, /100 saved units/);
});

test("concept questions do not substitute a single holding or invent tax figures", async () => {
  assert.match(answerHoldingQuestion(portfolio, "what is NAV")!, /published net asset value/);
  assert.match(answerHoldingQuestion(portfolio, "explain SIP")!, /plan to invest regularly/);
  assert.doesNotMatch(answerHoldingQuestion(portfolio, "explain SIP")!, /No monthly SIP/);
  const tax = await answerPortfolioQuestion(portfolio, [{role: "user", content: "explain my tax"}]);
  assert.match(tax.answer, /cannot calculate a verified tax/);
  const unknown = await answerPortfolioQuestion(portfolio, [{role: "user", content: "hmm okay then"}]);
  assert.match(unknown.answer, /could not reliably identify/);
  assert.doesNotMatch(unknown.answer, /Quick snapshot/);
});

test("online voice is concise, respectful and retains exact holding context", () => {
  const prompt = portfolioSystemPrompt(false, true, true);
  assert.match(prompt, /Do not repeat the full snapshot/);
  assert.match(prompt, /Ask at most one focused question/);
  assert.match(prompt, /Do not shame a decision/);
  assert.match(prompt, /planned SIP from a completed purchase/);
});

test("fund risk follow-ups retain context without hijacking portfolio questions", () => {
  const history = [{ role: "user" as const, content: "quant loss" }];
  assert.match(answerHoldingQuestion(portfolio, "what about its risk?", history)!, /category-based risk assessment/);
  assert.equal(answerHoldingQuestion(portfolio, "explain my portfolio risk", history), null);
  const incomplete = { ...portfolio, valuationComplete: false };
  assert.match(answerHoldingQuestion(incomplete, "quant risk")!, /weight cannot be confirmed/);
  assert.doesNotMatch(answerHoldingQuestion(incomplete, "quant risk")!, /100.0%/);
});

test("SIP plans are explained locally without treating plans as completed purchases", async () => {
  const planned = { ...portfolio, funds: [{ ...quant, monthlySipAmount: 2500 }], valuationComplete: false };
  const reply = await answerPortfolioQuestion(planned, [{ role: "user", content: "what is my monthly SIP?" }]);
  assert.match(reply.answer, /2,500/);
  assert.match(reply.answer, /not confirmed payments/);
  assert.equal(reply.portfolioChanged, false);
  assert.match(answerHoldingQuestion(planned, "quant sip")!, /excluded from invested amounts/);
  assert.equal(detectPortfolioIntent("pause my monthly SIP"), "manage_holdings");
  assert.equal(detectPortfolioIntent("should I pause my SIP?"), null);
  assert.match(answerHoldingQuestion(portfolio, "my monthly SIP")!, /No monthly SIP amount/);
});

test("Quant loss questions use verified holding figures, not QuantRebalance boilerplate", async () => {
  const result = await answerPortfolioQuestion(portfolio, [{ role: "user", content: "quant fund its in loss of 5000" }]);
  assert.equal(result.source, "deterministic");
  assert.match(result.answer, /3,750/);
  assert.match(result.answer, /does not match/);
  assert.doesNotMatch(result.answer, /QuantRebalance|dry powder|Quick snapshot/);
});

test("contradictory AMC names require clarification instead of substituting a fund", () => {
  assert.match(answerHoldingQuestion(portfolio, "sbi quant fund its in loss of 5000")!, /confirm the full scheme/);
});

test("sell follow-ups retain the named holding and ask for decision context", () => {
  const multi = { ...portfolio, funds: [quant, SAMPLE_FUNDS[1]] };
  const reply = answerHoldingQuestion(multi, "should i sell my fund", [
    { role: "user", content: "quant fund its in loss of 5000" },
    { role: "user", content: "should i sell my fund" },
  ])!;
  assert.match(reply, /Quant Infrastructure/);
  assert.match(reply, /investment horizon and goal/);
  assert.match(reply, /No sale/);
  assert.doesNotMatch(reply, /Quick snapshot/);
  assert.match(answerHoldingQuestion(multi, "should i sell my fund")!, /Which saved fund/);
});

test("unverified values and ambiguous plans never become confirmed returns", () => {
  assert.match(answerHoldingQuestion({ ...portfolio, funds: [{ ...quant, valuationStatus: "stale" }] }, "quant loss")!, /not verified/);
  assert.match(answerHoldingQuestion({ ...portfolio, funds: [quant, { ...quant, id: "regular", name: quant.name.replace("Direct", "Regular") }] }, "quant loss")!, /More than one/);
  assert.doesNotMatch(answerHoldingQuestion(portfolio, "quant is down 5 percent")!, /You mentioned a loss/);
  assert.equal(answerHoldingQuestion(portfolio, "explain QRP alpha"), null);
  assert.match(answerHoldingQuestion(portfolio, "explain Quant risk")!, /category-based risk/);
});

test("signed-in read-only chat does not instruct the owner to sign in again", async () => {
  assert.match(portfolioSystemPrompt(false, true, true), /user is signed in/);
  assert.match(portfolioSystemPrompt(false, true, true), /does not imply the user is signed out/);
  const question = "add i to my portfolio also cannara robacco small cap";
  assert.equal(detectPortfolioIntent(question), "add_fund");
  assert.equal(detectPortfolioIntent("should I add more funds?"), null);
  const result = await answerPortfolioQuestion(portfolio, [{ role: "user", content: question }]);
  assert.match(result.answer, /Use Add Fund/);
  assert.doesNotMatch(result.answer, /Sign in/);
  assert.equal(result.portfolioChanged, false);
});

test("detailed online data requires a new, explicit versioned consent", () => {
  assert.equal(hasDetailedAIConsent({ allowPrivateAI: true }), false);
  assert.equal(hasDetailedAIConsent({ allowPrivateAI: true, privateAIConsentVersion: "old" }), false);
  assert.equal(hasDetailedAIConsent({ allowPrivateAI: false, privateAIConsentVersion: DETAILED_AI_CONSENT_VERSION }), false);
  assert.equal(hasDetailedAIConsent({ allowPrivateAI: true, privateAIConsentVersion: DETAILED_AI_CONSENT_VERSION }), true);
});

test("online grounding includes individual purchase data only after detailed consent", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.GROQ_API_KEY;
  const requests: Array<{ messages: Array<{ content: string }> }> = [];
  process.env.GROQ_API_KEY = "synthetic-test-key";
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: "test", object: "chat.completion", created: 1,
      model: "test", choices: [{ index: 0, message: { role: "assistant", content: "Grounded test response" }, finish_reason: "stop" }] }),
      { headers: { "Content-Type": "application/json" } });
  };
  try {
    const messages = [{ role: "user" as const, content: "Review my portfolio" }];
    await answerPortfolioQuestion(portfolio, messages, undefined, { allowPrivateAI: true });
    const summary = JSON.parse(requests[0].messages[1].content.replace("Portfolio data:\n", ""));
    assert.equal(summary.holdings, undefined);
    await answerPortfolioQuestion(portfolio, messages, undefined, { allowPrivateAI: true, allowDetailedPrivateAI: true });
    const details = JSON.parse(requests[1].messages[1].content.replace("Portfolio data:\n", ""));
    assert.equal(details.holdings[0].units, 100);
    assert.equal(details.holdings[0].investedAmount, 85000);
    assert.equal(details.holdings[0].unrealizedChange, -3750);
    await answerPortfolioQuestion(portfolio, messages, undefined, { allowDetailedPrivateAI: true });
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
  }
});
