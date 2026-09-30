import "server-only";
import { randomInt } from "node:crypto";
import { articleFingerprint, assignSimulationNames, shuffle, type PreparedDataset, type SimulationArticle } from "./comment-simulation-generator";
export const engagementTypes = ["agreement","disagreement","question","observation","reflection","clarification","connection","alternative"] as const;
export function validatePreparedDataset(article: SimulationArticle, value: unknown): PreparedDataset {
 if (!value || typeof value !== "object") throw new Error("Provide an article-specific dataset object.");
 const data = value as PreparedDataset;
 if(data.fingerprint !== articleFingerprint(article)) throw new Error("Dataset fingerprint does not match this article. Review the current source before preparing it.");
 if(!Array.isArray(data.comments) || data.comments.length !== 25 || data.comments.some(c=>typeof c!=="string" || c.trim().length<20 || c.length>2000) || new Set(data.comments.map(c=>c.trim())).size!==25) throw new Error("Provide 25 distinct article-specific comments, 20–2000 characters each.");
 if(!data.engagementAnchors || engagementTypes.some(t=>!Number.isInteger(data.engagementAnchors[t]) || data.engagementAnchors[t]<0 || data.engagementAnchors[t]>=25) || new Set(engagementTypes.map(t=>data.engagementAnchors[t])).size!==8) throw new Error("Identify eight distinct engagement anchors using comment indexes 0–24.");
 return data;
}
export function simulationDays(count: number) {
 if(!Number.isInteger(count)||count<15||count>25) throw new Error("Expected 15–25 comments.");
 return count<=16?4:count===17?5:count<=24?6:7;
}
export function planTimestamps(count: number, publishedAt: string | null | undefined, now: number, int: (max:number)=>number = max=>randomInt(max)) {
 const parsed = Date.parse(publishedAt ?? "");
 const fractional = /[.](\d+)/.exec(publishedAt ?? "")?.[1] ?? "";
 // PostgreSQL keeps microseconds; never truncate publication below its true boundary.
 const published = parsed + (/[1-9]/.test(fractional.slice(3)) ? 1 : 0);
 if(!Number.isFinite(published)||!Number.isFinite(now)||published>now) throw new Error("A valid publication time at or before now is required.");
 const days=simulationDays(count), day=86400000, start=Math.floor(published/day)*day;
 if(start+(days-1)*day>now) throw new Error(`Not yet eligible: insufficient elapsed days for this complete planned batch (${count} comments over ${days} days).`);
 const extra=new Set(shuffle(Array.from({length:days},(_,i)=>i),int).slice(0,count-3*days));
 const times:string[]=[];
 for(let i=0;i<days;i++) {
  const n=3+(extra.has(i)?1:0), date=start+i*day;
  // Prefer 07:00–22:00 UTC; late publications use the remaining valid interval.
  let lower=Math.max(published,date+7*3600000), upper=Math.min(now,date+22*3600000);
  if(upper-lower+1<n){lower=Math.max(published,date);upper=Math.min(now,date+day-1);}
  if(upper-lower+1<n) throw new Error("Not yet eligible: too little elapsed time on a planned day.");
  // Disjoint equal-width windows ensure distinct times and varied parts of the day.
  for(let j=0;j<n;j++){
   const lo=Math.ceil(lower+(upper-lower+1)*j/n), hi=Math.ceil(lower+(upper-lower+1)*(j+1)/n)-1;
   times.push(new Date(lo+int(hi-lo+1)).toISOString());
  }
 }
 return times;
}
export function prepareSimulationPlan(article: SimulationArticle, input: unknown, now=Date.now(), int:(max:number)=>number=max=>randomInt(max)) {
 const data=validatePreparedDataset(article,input), count=15+int(11);
 const dates=planTimestamps(count,article.published_at,now,int);
 const anchors=new Set(engagementTypes.map(t=>data.engagementAnchors[t]));
 const chosen=shuffle([...data.comments.filter((_,i)=>anchors.has(i)),...shuffle(data.comments.filter((_,i)=>!anchors.has(i)),int).slice(0,count-8)],int);
 return assignSimulationNames(chosen,int).map((comment,i)=>({...comment,created_at:dates[i]}));
}
