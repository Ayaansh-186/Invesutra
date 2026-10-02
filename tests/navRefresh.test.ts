import assert from "node:assert/strict";
import test from "node:test";
import { getAmfiCatalogue } from "../lib/marketData/amfi";
import { getFundDetails, getFundNav } from "../lib/marketData/providers";
import { todayInIndia } from "../lib/utils/purchase";

test("NAV-only lookups skip history and manual refresh bypasses the public feed cache", async () => {
  const original = globalThis.fetch;
  const options: RequestInit[] = [];
  const [year,month,day] = todayInIndia().split("-");
  const feed = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\nOpen Ended Schemes (Equity Scheme - Large Cap Fund)\nTest AMC\n` +
    Array.from({length:100},(_,index) => `${880000+index};-;-;Test Fund ${index} Direct Growth;25;${day}-${month}-${year}`).join("\n");
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes("NAVAll.txt"), "NAV-only lookup must not fetch historical returns");
    options.push(init || {});
    return new Response(feed,{status:200});
  };
  try {
    const detail = await getFundNav("880001");
    assert.equal(detail.nav,25);
    assert.equal(detail.navSource,"amfi");
    assert.equal(options.length,1);
    await getFundNav("880002");
    assert.equal(options.length,1);
    await getAmfiCatalogue(true);
    assert.equal(options.length,2);
    assert.equal(options[1].cache,"no-store");
    assert.equal((options[1] as {next?:unknown}).next,undefined);
    let historyCalls = 0;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    globalThis.fetch = async url => {
      assert.ok(String(url).includes("api.mfapi.in/mf/880003"));
      historyCalls++;
      return Response.json({ meta:{scheme_code:880003,scheme_name:"Test Fund 3 Direct Growth",scheme_category:"Equity Scheme - Large Cap Fund",fund_house:"Test AMC"},
        data:[null,{date:"invalid",nav:"NaN"},{date:`${day}-${months[Number(month)-1]}-${year}`,nav:"25"},{date:`${day}-${month}-${Number(year)-1}`,nav:"20"}] });
    };
    const detailed = await getFundDetails("880003");
    assert.equal(detailed.navSource,"amfi");
    assert.equal(detailed.nav,25);
    assert.equal(detailed.returns1Y,25);
    assert.equal(historyCalls,1);
  } finally { globalThis.fetch = original; }
});
