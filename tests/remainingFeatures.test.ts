import assert from "node:assert/strict";
import test from "node:test";
import { readAIPrivacyPreference, saveAIPrivacyPreference } from "../lib/ai/privacy";
import { parsePurchaseCsv, PURCHASE_CSV_HEADER } from "../lib/utils/purchaseImport";
import { compareSavedReports } from "../lib/utils/reportComparison";
import { generateReport } from "../lib/algorithm/reportEngine";
import { SAMPLE_PORTFOLIO } from "../lib/utils/mockData";
import { dbFundToFund, fundToDbInsert } from "../lib/supabase/mappers";
import type { DbAIReport, DbFund } from "../lib/supabase/database.types";

test("remembered consent is versioned, account/portfolio scoped and revocable",()=>{
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
  assert.equal(readAIPrivacyPreference(storage,'a','one'),null);
  assert.equal(saveAIPrivacyPreference(storage,'a','one',true),true);
  assert.equal(readAIPrivacyPreference(storage,'a','one'),true);
  assert.equal(readAIPrivacyPreference(storage,'b','one'),null);
  assert.equal(readAIPrivacyPreference(storage,'a','two'),null);
  saveAIPrivacyPreference(storage,'a','one',false);assert.equal(readAIPrivacyPreference(storage,'a','one'),false);
  for(const key of data.keys())data.set(key,JSON.stringify({version:'old',online:true}));
  assert.equal(readAIPrivacyPreference(storage,'a','one'),null);
  saveAIPrivacyPreference(storage,'a','one',null);assert.equal(data.size,0);
  assert.equal(readAIPrivacyPreference({getItem:()=>{throw new Error('Blocked');},setItem:()=>{},removeItem:()=>{}},'a','one'),null);
});

test("CSV import handles real CSV quoting and rejects ambiguous or duplicate records",()=>{
  const row='123,"2020-09-01",10.1234,20.5';
  assert.equal(parsePurchaseCsv(`${PURCHASE_CSV_HEADER}\r\n${row}\r\n`,'123')[0].units,10.1234);
  assert.throws(()=>parsePurchaseCsv(`${PURCHASE_CSV_HEADER}\n${row}\n${row}`,'123'),/duplicate/);
  assert.throws(()=>parsePurchaseCsv(`${PURCHASE_CSV_HEADER}\n${row}`,'456'),/exact scheme/);
  assert.throws(()=>parsePurchaseCsv('name,amount\nTest,1000','123'),/exact CSV columns/);
  for(const units of ['0','-1','0x10','1e5','1.12345'])assert.throws(()=>parsePurchaseCsv(`${PURCHASE_CSV_HEADER}\n123,2020-09-01,${units},20`,'123'));
});

test("all purchase lots are preserved without representing one NAV as the whole cost basis",()=>{
  const row={...fundToDbInsert(SAMPLE_PORTFOLIO.funds[0],'portfolio'),id:'fund',created_at:'2020-01-01',updated_at:'2020-01-01'} as DbFund;
  const result=dbFundToFund(row,[{id:'later',fund_id:'fund',created_at:'2021-01-01T00:00:00Z',notes:'AMFI scheme 123',nav:30,amount:300,units:10},{id:'first',fund_id:'fund',created_at:'2020-01-01T00:00:00Z',notes:'AMFI scheme 123',nav:20,amount:200,units:10}]);
  assert.equal(result.purchases?.length,2);assert.equal(result.purchases?.[0].id,'first');assert.equal(result.purchaseNav,undefined);assert.equal(result.schemeCode,'123');
});

test("report comparison uses historical snapshots and does not label cash-flow changes returns",()=>{
  const make=(id:string,date:string,multiplier:number):DbAIReport=>({id,portfolio_id:'p',user_id:'u',generated_at:date,report_snapshot:{version:1,report:generateReport({...SAMPLE_PORTFOLIO,funds:SAMPLE_PORTFOLIO.funds.map(fund=>({...fund,currentValue:fund.currentValue*multiplier,investedAmount:fund.investedAmount*multiplier}))})}} as DbAIReport);
  const older=make('old','2026-01-01T00:00:00Z',1),newer=make('new','2026-02-01T00:00:00Z',2);
  const comparison=compareSavedReports(newer,older)!;
  assert.equal(comparison.earlier.id,'old');assert.equal(comparison.valueChange,comparison.before.value);assert.equal(comparison.investedChange,comparison.before.invested);
  assert.equal(compareSavedReports(older,older),null);assert.equal(compareSavedReports(older,{...newer,user_id:'other'}),null);
});
