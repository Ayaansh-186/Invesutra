import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function GET() {
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Not signed in"},{status:401});
  const {data,error}=await supabase.from("nav_monitor_runs").select("checked_at,status").order("checked_at",{ascending:false}).limit(1).maybeSingle();
  if(error)return NextResponse.json({error:"Scheduled NAV status unavailable."},{status:503});
  return NextResponse.json({run:data},{headers:{"Cache-Control":"private, no-store"}});
}
