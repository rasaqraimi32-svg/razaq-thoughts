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
function publicationWindow(publishedAt: string | null | undefined, now: number) {
 const parsed = Date.parse(publishedAt ?? "");
 const fractional = /[.](\d+)/.exec(publishedAt ?? "")?.[1] ?? "";
 // PostgreSQL keeps microseconds. Round inward to representable UTC milliseconds.
 const published = parsed + (/[1-9]/.test(fractional.slice(3)) ? 1 : 0);
 if(!Number.isFinite(published)||!Number.isFinite(now)||published>now) throw new Error("A valid publication time at or before now is required.");
 const end=Math.floor(now), day=86400000, start=Math.floor(parsed/day)*day;
 return {published,end,day,start,availableUtcDates:Math.floor(end/day)-Math.floor(parsed/day)+1};
}
function timestampInterval(date:number, published:number, end:number, count:number) {
 // Prefer 07:00–22:00 UTC, falling back to the exact available part of the day.
 let lower=Math.max(published,date+7*3600000), upper=Math.min(end,date+22*3600000);
 if(upper-lower+1<count){lower=Math.max(published,date);upper=Math.min(end,date+86400000-1);}
 if(upper-lower+1<count) throw new Error("Not yet eligible: too little elapsed time on a planned day.");
 return {lower,upper};
}
type PublicationWindow = ReturnType<typeof publicationWindow>;
function dayCapacities(window:PublicationWindow, days:number) {
 const {published,end,day,start}=window;
 return Array.from({length:days},(_,i)=>Math.max(0,Math.min(4,Math.min(end,start+(i+1)*day-1)-Math.max(published,start+i*day)+1)));
}
export const simulationWaitingMessage = "Not enough elapsed time yet. No comments will be scheduled until a valid 3–4-per-day schedule is possible.";
export type SimulationEligibility = {counts:number[];minimum:number|null;maximum:number|null;availableUtcDates:number};
/** Keep the database's count/day mapping; shorter complete schedules remain eligible. */
export function simulationEligibility(publishedAt:string|null|undefined, now=Date.now()):SimulationEligibility {
 const window=publicationWindow(publishedAt,now);
 const counts=Array.from({length:11},(_,i)=>15+i).filter(count=>{
  const days=simulationDays(count);
  if(days>window.availableUtcDates)return false;
  const capacities=dayCapacities(window,days);
  return capacities.every(capacity=>capacity>=3)&&count<=capacities.reduce((sum,capacity)=>sum+capacity,0);
 });
 return {counts,minimum:counts[0]??null,maximum:counts[counts.length-1]??null,availableUtcDates:window.availableUtcDates};
}
export function planTimestamps(count: number, publishedAt: string | null | undefined, now: number, int: (max:number)=>number = max=>randomInt(max)) {
 const window=publicationWindow(publishedAt,now);
 const {published,end,day,start,availableUtcDates}=window;
 const days=simulationDays(count);
 if(days>availableUtcDates) throw new Error(`Not yet eligible: insufficient elapsed days for this complete planned batch (${count} comments over ${days} days).`);
 const capacities=dayCapacities(window,days);
 if(capacities.some(n=>n<3)) throw new Error("Not yet eligible: too little elapsed time on a planned day.");
 const extraDays=capacities.flatMap((capacity,i)=>capacity>=4?[i]:[]), extraCount=count-3*days;
 if(extraCount>extraDays.length) throw new Error("Not yet eligible: too little elapsed time on a planned day.");
 // A partial boundary day with only three milliseconds cannot receive a fourth comment.
 const extra=new Set(shuffle(extraDays,int).slice(0,extraCount));
 const times:string[]=[];
 for(let i=0;i<days;i++) {
  const n=3+(extra.has(i)?1:0), date=start+i*day;
  const {lower,upper}=timestampInterval(date,published,end,n);
  // Disjoint equal-width windows ensure unique timestamps in ascending order.
  for(let j=0;j<n;j++){
   const lo=Math.ceil(lower+(upper-lower+1)*j/n), hi=Math.ceil(lower+(upper-lower+1)*(j+1)/n)-1;
   times.push(new Date(lo+int(hi-lo+1)).toISOString());
  }
 }
 return times;
}
export function prepareSimulationPlan(article: SimulationArticle, input: unknown, now=Date.now(), int:(max:number)=>number=max=>randomInt(max)) {
 const data=validatePreparedDataset(article,input);
 const {counts}=simulationEligibility(article.published_at,now);
 if(!counts.length)throw new Error("Not yet eligible: "+simulationWaitingMessage);
 const count=counts[int(counts.length)];
 const dates=planTimestamps(count,article.published_at,now,int);
 const anchors=new Set(engagementTypes.map(t=>data.engagementAnchors[t]));
 const chosen=shuffle([...data.comments.filter((_,i)=>anchors.has(i)),...shuffle(data.comments.filter((_,i)=>!anchors.has(i)),int).slice(0,count-8)],int);
 return assignSimulationNames(chosen,int).map((comment,i)=>({...comment,created_at:dates[i]}));
}
