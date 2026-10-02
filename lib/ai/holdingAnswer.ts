import type { Fund, Portfolio } from "@/lib/types";
import { categoryLabel, formatCurrencyExact, formatPercent } from "@/lib/utils/format";
import { hasVerifiedValue } from "@/lib/marketData/quality";

type Message = { role: "user" | "assistant"; content: string };
const genericWords = new Set("fund funds mutual plan direct regular growth option options cap large mid small flexi my the a an this that it is in of to and".split(" "));
const brands = new Set("sbi hdfc icici axis quant mirae nippon kotak uti tata dsp aditya franklin canara motilal edelweiss".split(" "));
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function matchHolding(funds: Fund[], question: string) {
  const words = new Set(normalize(question).split(" "));
  const namedBrands = [...words].filter(word => brands.has(word));
  const candidates = funds.map(fund => ({fund, score: [...new Set(normalize(fund.name).split(" "))]
    .filter(word => !genericWords.has(word) && words.has(word)).length}));
  const best = Math.max(0, ...candidates.map(item => item.score));
  const matches = candidates.filter(item => best > 0 && item.score === best).map(item => item.fund);
  const conflict = namedBrands.length > 0 && !matches.some(fund => namedBrands.every(brand => normalize(fund.name).split(" ").includes(brand)));
  return { matches, conflict, named: best > 0 || namedBrands.length > 0 };
}

export function detectPortfolioIntent(question: string): "add_fund" | "show_holdings" | "manage_holdings" | null {
  const q = question.toLowerCase();
  if (!/\b(should|whether|worth|why)\b/.test(q) && /\badd\b/.test(q) &&
      (/\b(fund|holding|portfolio)\b/.test(q) || /\badd\s+(it|this|these|them)\b/.test(q))) return "add_fund";
  if (/\b(edit|update|remove|delete)\b/.test(q) && /\b(fund|holding)\b/.test(q)) return "manage_holdings";
  if (/show holdings?|my holdings|list funds?|holdings breakdown/.test(q)) return "show_holdings";
  return null;
}

// Shared by server-local responses and the browser's offline fallback. No provider calls.
export function answerHoldingQuestion(portfolio: Portfolio, question: string, history: Message[] = []): string | null {
  if (/\b(qrp|quantrebalance|quant\s+rebalance|alpha|dry\s+powder)\b/i.test(question)) return null;
  const decision = /\b(sell|selling|exit|redeem|hold|keep|buy more|add more|average)\b/i.test(question);
  const facts = /\b(loss|lost|losing|down|falling|gain|profit|return|nav|units|quantity|purchase|bought|invested)\b|current value/i.test(question);
  if (!decision && !facts) return null;
  let target = matchHolding(portfolio.funds, question);
  if (!target.named && !decision && !facts) return null;
  if (!target.named) {
    const previous = history.filter(message => message.role === "user" && message.content.trim() !== question.trim()).slice(-6).reverse();
    for (const message of previous) {
      const match = matchHolding(portfolio.funds, message.content);
      if (match.named) { target = match; break; }
    }
  }
  if (target.conflict) return "The fund name in your message does not match one exact saved holding. Please confirm the full scheme name and plan from Portfolio; I will not substitute a similarly named fund or a different AMC.";
  if (!target.matches.length && !target.named && portfolio.funds.length === 1) target.matches = portfolio.funds;
  if (!target.matches.length) return decision || facts
    ? "Which saved fund do you mean? Give its full scheme name so I can check the holding's verified NAV value and purchase cost, rather than guessing."
    : null;
  if (target.matches.length > 1) return `More than one holding matches: ${target.matches.map(fund => fund.name).join("; ")}. Which exact scheme and plan should I review?`;
  const fund = target.matches[0];
  const valueReady = hasVerifiedValue(fund) && Number.isFinite(fund.currentValue) && fund.currentValue > 0 && fund.units > 0;
  const costReady = (fund.purchaseStatus === undefined || fund.purchaseStatus === "verified") && Number.isFinite(fund.investedAmount) && fund.investedAmount > 0;
  if (!valueReady || !costReady) return `${fund.name}: ${!valueReady ? "current NAV valuation" : "purchase cost"} is not verified. Correct the flagged purchase details or retry NAV verification on Portfolio first. I cannot confirm a loss or a sell decision from the saved, unverified value.`;
  const change = fund.currentValue - fund.investedAmount;
  const percent = change / fund.investedAmount * 100;
  const direction = change < 0 ? "unrealized loss" : change > 0 ? "unrealized gain" : "change";
  const snapshot = `${fund.name}: invested ${formatCurrencyExact(fund.investedAmount)}, value at published NAV ${formatCurrencyExact(fund.currentValue)}${fund.navAsOf ? ` (NAV dated ${fund.navAsOf})` : ""}. Your ${direction} is ${formatCurrencyExact(Math.abs(change))} (${formatPercent(percent)}). This is your holding's return, not the fund's 1-year return.`;
  const claimed = /\b(?:loss(?:\s+of)?|lost|down(?:\s+by)?)\s*(?:rs\.?\s*|inr\s*|\u20b9\s*)?([\d,]+(?:\.\d+)?)\s*(k|thousand)?\b/i.exec(question);
  const isPercentage = claimed && /^\s*(%|percent)/i.test(question.slice(claimed.index + claimed[0].length));
  const claimedAmount = claimed && !isPercentage ? Number(claimed[1].replace(/,/g,"")) * (claimed[2] ? 1000 : 1) : undefined;
  const discrepancy = claimedAmount !== undefined && (change >= 0 || Math.abs(claimedAmount - Math.abs(change)) > 1)
    ? ` You mentioned a loss of ${formatCurrencyExact(claimedAmount)}; that does not match these verified figures. Check the units, cost and NAV date against your statement.` : "";
  if (decision) return `${snapshot}${discrepancy}\n\nA loss alone does not establish whether selling is appropriate. ${categoryLabel(fund.category)} is the saved category; any concentration warning is a local model flag, not a sell signal. The app has no verified benchmark comparison or redemption-cost figures for this decision. What is your investment horizon and goal, and do you need this money soon? No sale or portfolio change has been made.`;
  return `${snapshot}${discrepancy}\n\n${fund.units.toLocaleString("en-IN", {maximumFractionDigits:4})} units${fund.purchaseDate ? `, allotted ${fund.purchaseDate}` : ""}. I cannot infer the reason for a fall or predict recovery from NAV and purchase records alone. Ask about this holding's risk or tell me your goal and time horizon to narrow the review.`;
}
