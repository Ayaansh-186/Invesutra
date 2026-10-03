"use client";
import {useEffect,useState} from "react";
export default function NavMonitorStatus() {
  const [run,setRun]=useState<{checked_at:string;status:string}|null>(null);
  useEffect(()=>{const controller=new AbortController();fetch('/api/funds/nav-monitor',{signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>{if(!controller.signal.aborted)setRun(data?.run||null);}).catch(()=>{});return()=>controller.abort();},[]);
  if(!run)return null;
  return <p className="mt-2 text-xs text-[var(--shell-text-muted)]">Scheduled NAV source check: {new Date(run.checked_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST{run.status==='unavailable'?' · Source unavailable; saved holdings retained.':'.'} Published NAV dates may be earlier than the check.</p>;
}
