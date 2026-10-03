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
  if (!/\b(should|whether|worth|why)\b/.test(q) && /\b(edit|change|update|pause|stop|resume|record|log)\b/.test(q) && /\b(sip|payment|instalment|installment)\b/.test(q)) return "manage_holdings";
  if (!/\b(should|whether|worth|why)\b/.test(q) && /\badd\b/.test(q) &&
      (/\b(fund|holding|portfolio)\b/.test(q) || /\badd\s+(it|this|these|them)\b/.test(q))) return "add_fund";
  if (/\b(edit|update|remove|delete)\b/.test(q) && /\b(fund|holding)\b/.test(q)) return "manage_holdings";
  if (/show holdings?|my holdings|list funds?|holdings breakdown/.test(q)) return "show_holdings";
  return null;
}

// Shared by server-local responses and the browser's offline fallback. No provider calls.
export function answerHoldingQuestion(portfolio: Portfolio, question: string, history: Message[] = []): string | null {
  if (/\b(qrp|quantrebalance|quant\s+rebalance|alpha|dry\s+powder)\b/i.test(question)) return null;
  const named = matchHolding(portfolio.funds, question);
  if (!named.named && /^(what (is|does)|explain|define)\s+(a |an |the )?(sip|nav|expense ratio)\b/i.test(question.trim()) && !/\b(my|saved|holding|portfolio)\b/i.test(question)) {
    if (/\bsip\b/i.test(question)) return "A SIP is a plan to invest regularly, often monthly. Each completed investment buys units at its applicable allotment NAV. A saved monthly SIP amount in Invesutra records your intention only; it does not schedule a payment or prove that units were purchased. Returns are not guaranteed.";
    if (/\bnav\b/i.test(question)) return "NAV is the published net asset value per unit of a mutual fund. Your holding's NAV value is units held multiplied by the latest verified published NAV. It is not a live intraday price; check the publication date. Your personal gain also depends on your actual purchase cost.";
    return "An expense ratio is the scheme's annual operating cost expressed as a percentage of assets. It is reflected in NAV, not a separate bill from this tracker. Compare the exact plan's verified published ratio; Invesutra cannot infer missing fees from NAV data.";
  }
  const decision = /\b(sell|selling|exit|redeem|hold|keep|buy more|add more|average)\b/i.test(question);
  const facts = /\b(loss|lost|losing|down|falling|gain|profit|return|nav|units|quantity|purchase|bought|invested)\b|current value/i.test(question);
  const risk = /\b(risk|risky|safe|concentration|diversification|diversified)\b/i.test(question);
  const explain = /\b(explain|review|understand)\b|what should i review/i.test(question);
  const sip = /\b(sip|monthly|contribution)\b/i.test(question);
  if (!decision && !facts && !risk && !explain && !sip) return null;
  let target = named;
  if (!target.named && /\bportfolio\b/i.test(question) && !sip) return null;
  const referencesHolding = /\b(it|its|this|that|my fund|this holding)\b/i.test(question);
  if (!target.named && (referencesHolding || decision) && !/\bportfolio\b/i.test(question)) {
    const previous = history.filter(message => message.role === "user" && message.content.trim() !== question.trim()).slice(-6).reverse();
    for (const message of previous) {
      const match = matchHolding(portfolio.funds, message.content);
      if (match.named) { target = match; break; }
    }
  }
  if (!target.named && !decision && !referencesHolding) {
    if (sip) {
      const plans = portfolio.funds.filter(fund => Number.isFinite(fund.monthlySipAmount) && fund.monthlySipAmount! > 0);
      const total = plans.reduce((sum, fund) => sum + fund.monthlySipAmount!, 0);
      return plans.length
        ? `Your saved monthly SIP plans total ${formatCurrencyExact(total)} across ${plans.length} holding${plans.length === 1 ? "" : "s"}.\n\n${plans.map(fund => `- ${fund.name}: ${formatCurrencyExact(fund.monthlySipAmount!)}/month`).join("\n")}\n\nThese are planned contributions, not confirmed payments. They do not increase your invested amount, units or current value. Review or change a plan in Portfolio.`
        : "No monthly SIP amount is saved for your holdings. A planned SIP is a reminder of intended contributions, not evidence of purchased units. Set a plan in Portfolio; actual investments need their allotment details.";
    }
    if (!facts) return null;
  }
  if (target.conflict) return "The fund name in your message does not match one exact saved holding. Please confirm the full scheme name and plan from Portfolio; I will not substitute a similarly named fund or a different AMC.";
  if (!target.matches.length && !target.named && portfolio.funds.length === 1) target.matches = portfolio.funds;
  if (!target.matches.length) return decision || facts || referencesHolding
    ? "Which saved fund do you mean? Give its full scheme name so I can check the holding's verified NAV value and purchase cost, rather than guessing."
    : null;
  if (target.matches.length > 1) return `More than one holding matches: ${target.matches.map(fund => fund.name).join("; ")}. Which exact scheme and plan should I review?`;
  const fund = target.matches[0];
  if (sip) return fund.monthlySipAmount !== undefined
    ? `${fund.name}: your planned SIP is ${formatCurrencyExact(fund.monthlySipAmount)}/month. This is not a confirmed payment and is excluded from invested amounts, units and returns. Open Portfolio to edit or pause the plan.`
    : `${fund.name} has no saved monthly SIP plan. You can set one in Portfolio. A plan does not create purchases or change your units.`;
  if (risk) {
    const total = portfolio.funds.reduce((sum, item) => sum + item.currentValue, 0);
    const weightReady = portfolio.valuationComplete !== false && portfolio.funds.every(item => hasVerifiedValue(item) && Number.isFinite(item.currentValue) && item.currentValue > 0);
    const weight = weightReady && total > 0 ? ` It represents ${(fund.currentValue / total * 100).toFixed(1)}% of your verified portfolio value.` : " Its portfolio weight cannot be confirmed until all holding values are verified.";
    return `${fund.name} is categorized as ${categoryLabel(fund.category)}, with a ${fund.riskLevel.replace(/_/g, " ")} category-based risk assessment.${weight}\n\nThis is a local category model, not the scheme's official Riskometer or a prediction of loss. Verified volatility, holdings overlap and benchmark comparisons are unavailable here. ${fund.category === "sectoral" ? "A sector-focused holding can concentrate exposure; owning several schemes does not necessarily remove that overlap." : "The category alone cannot establish whether this fund fits your goal."}\n\nWhat is your goal and investment horizon for this holding?`;
  }
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
  if (!decision && /\bnav\b/i.test(question) && !/\b(loss|gain|return|profit)\b/i.test(question)) return `${fund.name}: latest verified published NAV is ${formatCurrencyExact(fund.nav, 4)}${fund.navAsOf ? `, dated ${fund.navAsOf}` : ""}.\n\n${fund.units.toLocaleString("en-IN", { maximumFractionDigits: 4 })} units x NAV gives ${formatCurrencyExact(fund.currentValue)}. This is a daily published valuation, not an intraday price. Refresh NAV from Portfolio to check for a newer publication.`;
  if (!decision && /\b(units|quantity)\b/i.test(question)) return `${fund.name}: ${fund.units.toLocaleString("en-IN", { maximumFractionDigits: 4 })} saved units, with verified purchase cost ${formatCurrencyExact(fund.investedAmount)}.\n\nUnits come from your purchase record, not your planned SIP. Check them against your allotment statement; use Correct purchase details in Portfolio if they are wrong.`;
  if (explain && !decision && !facts) return `${snapshot}\n\nCategory: ${categoryLabel(fund.category)}. First check that the exact plan, units and allotment date match your statement. Then review its category exposure against your goal; a positive return or a model score alone does not establish suitability. Would you like to review this holding's risk or its purchase details?`;
  if (decision) return `${snapshot}${discrepancy}\n\nA loss alone does not establish whether selling is appropriate. ${categoryLabel(fund.category)} is the saved category; any concentration warning is a local model flag, not a sell signal. The app has no verified benchmark comparison or redemption-cost figures for this decision. What is your investment horizon and goal, and do you need this money soon? No sale or portfolio change has been made.`;
  return `${snapshot}${discrepancy}\n\n${fund.units.toLocaleString("en-IN", {maximumFractionDigits:4})} units${fund.purchases && fund.purchases.length > 1 ? ` across ${fund.purchases.length} completed purchases` : fund.purchaseDate ? `, allotted ${fund.purchaseDate}` : ""}. I cannot infer the reason for a fall or predict recovery from NAV and purchase records alone. Ask about this holding's risk or tell me your goal and time horizon to narrow the review.`;
}
