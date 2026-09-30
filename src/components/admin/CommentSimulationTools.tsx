"use client";
import { useState } from "react";
import { discoverSimulationAction, seedSimulationAction, previewSimulationCleanupAction, removeSimulationAction } from "@/app/admin/(protected)/simulation-actions";
import type { SimulationResult, SimulationSnapshot } from "@/lib/journal/comment-simulation";

export default function CommentSimulationTools() {
 const [busy,setBusy] = useState(false);
 const [results,setResults] = useState<SimulationResult[]>([]);
 const [found,setFound] = useState<number | null>(null);
 const [error,setError] = useState("");
 const [cleanup,setCleanup] = useState<SimulationSnapshot | null>(null);
 const [message,setMessage] = useState("");
 async function seed() {
  if(!window.confirm("This will generate 15–25 simulated comments for each published article. They will be approved and visible publicly. Already seeded articles will be skipped. Continue?")) return;
  setBusy(true);setError("");setMessage("");setResults([]);setFound(null);setCleanup(null);
  try {
   const articles = await discoverSimulationAction();setFound(articles.length);
   for(const article of articles) {
    let result: SimulationResult;
    try { result = await seedSimulationAction(article.id,true); }
    catch { result={...article,status:"failed",count:0,error:"Request failed. It may have committed; refresh and retry safely to check the ledger."}; }
    setResults(previous=>[...previous,result]);
   }
  } catch { setError("Unable to discover published articles. Check your administrator session, database connection and simulation migration."); }
  finally {setBusy(false);}
 }
 async function preview() {
  setBusy(true);setError("");setMessage("");setCleanup(null);
  try {setCleanup(await previewSimulationCleanupAction());}
  catch {setError("Unable to preview cleanup. Check your session, database connection and simulation migration.");}
  finally {setBusy(false);}
 }
 async function remove() {
  if(!cleanup || !window.confirm("Remove exactly the "+cleanup.count+" simulated comments shown in this preview? Genuine comments will be preserved.")) return;
  setBusy(true);setError("");
  try { const result=await removeSimulationAction(cleanup.token,true);setMessage("Removed: "+result.removed+". Remaining simulated comments: "+result.remaining+". Errors: "+result.errors+".");setCleanup(null); }
  catch {setError("Cleanup failed or its outcome is unknown. Preview again: the simulation may have changed, or the connection/session may have failed. No broad deletion is attempted.");setCleanup(null);}
  finally {setBusy(false);}
 }
 const failures=results.filter(r=>r.status==="failed").length;
 return <section className="admin-comment-card" aria-labelledby="simulation-title">
  <h2 id="simulation-title">Simulation Tools</h2>
  <p>Test comments from fictional readers, prepared separately from each published article. These appear publicly when seeded. New or edited articles need a refreshed dataset; they are reported as failures rather than receiving unrelated comments.</p>
  <div className="admin-comment-actions"><button className="button" disabled={busy} onClick={seed}>Seed Simulated Comments</button><button className="text-link" disabled={busy} onClick={preview}>Remove Simulated Comments</button></div>
  {busy && <p role="status">Processing… Keep this page open. Completed articles are safe to retry.</p>}
  {error && <p role="alert">{error}</p>}
  {found !== null && <div aria-live="polite"><p>Published articles found: {found}. Processed: {results.length}. Seeded: {results.filter(r=>r.status==="seeded").length}. Skipped: {results.filter(r=>r.status==="skipped").length}. Failed: {failures}. Total new simulated comments: {results.reduce((sum,r)=>sum+r.count,0)}. Total errors: {failures}.</p><ul>{results.map(r=><li key={r.id}>{r.title} — {r.status==="seeded" ? r.count+" comments" : r.status==="skipped" ? "already seeded" : "failed: "+r.error}</li>)}</ul></div>}
  {cleanup && <div><p>Simulated comments to remove: {cleanup.count}. Seeded article records to reset: {cleanup.articleIds.length}.</p><button disabled={busy} onClick={remove}>Confirm removal of simulated comments</button><button disabled={busy} onClick={()=>setCleanup(null)}>Cancel</button></div>}
  {message && <p role="status">{message}</p>}
 </section>;
}
