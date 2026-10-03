import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getAmfiCatalogue, isExchangeTradedFund } from "@/lib/marketData/amfi";
import { isRecentNav, navDateToIso } from "@/lib/marketData/navFreshness";

export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(header)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(header),Buffer.from(expected))) return NextResponse.json({error:"Unauthorized"},{status:401});
  let supabase;
  try {supabase=createServiceSupabaseClient();} catch {return NextResponse.json({error:"NAV worker is not configured."},{status:503});}
  try {
    const schemes=await getAmfiCatalogue(true);
    const quotes=schemes.filter(scheme=>isRecentNav(scheme.navAsOf)&&!isExchangeTradedFund(scheme.name)).map(scheme=>({code:scheme.schemeCode,nav:scheme.nav,as_of:navDateToIso(scheme.navAsOf)}));
    if (!quotes.length) throw new Error("No recent published quotes");
    const {data,error}=await supabase.rpc("update_published_navs",{p_quotes:quotes});
    if(error)throw new Error("NAV update failed");
    return NextResponse.json({checkedAt:new Date().toISOString(),updated:data});
  } catch {
    await supabase.from("nav_monitor_runs").insert({status:"unavailable"});
    return NextResponse.json({error:"NAV check unavailable. Saved valuations were not replaced with guesses."},{status:503});
  }
}
