import assert from "node:assert/strict";
import test from "node:test";
import { executeTool, getAvailableTools, type ToolExecutionContext } from "../lib/ai/tools";

const readOnlyContext = {
  supabase: {} as ToolExecutionContext["supabase"],
  portfolioId: "saved-portfolio",
  canMutate: false,
};

test("read-only AI sessions expose fund lookup but no holding changes", () => {
  const names = getAvailableTools(readOnlyContext).map((tool) => tool.name);
  assert.deepEqual(names, ["search_mutual_funds", "get_fund_details"]);
});

test("holding mutation cannot execute without explicit server permission", async () => {
  const result = await executeTool("remove_fund_from_portfolio", { fundId: "fund-1" }, readOnlyContext);
  assert.equal(result.portfolioChanged, false);
  assert.ok(result.result && typeof result.result === "object" && "error" in result.result);
});
