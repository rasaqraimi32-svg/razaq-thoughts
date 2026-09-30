"use client";
import {useState} from "react";
import {previewSimulationCleanupAction,removeSimulationAction} from "@/app/admin/(protected)/simulation-actions";
import type {SimulationSnapshot} from "@/lib/journal/comment-simulation";
import NewSimulationWorkflow from "./NewSimulationWorkflow";
export default function CommentSimulationTools(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [cleanup,setCleanup]=useState<SimulationSnapshot|null>(null);
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
 return <section className="admin-comment-card" aria-labelledby="simulation-title"><h2 id="simulation-title">Simulation Tools</h2><NewSimulationWorkflow/><hr/>
 <button className="text-link" disabled={busy} onClick={preview}>Remove Simulated Comments</button>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {cleanup&&<div><p>Simulated comments to remove: {cleanup.count}. Seeded article records to reset: {cleanup.articleIds.length}.</p><button disabled={busy} onClick={remove}>Confirm removal of simulated comments</button><button disabled={busy} onClick={()=>setCleanup(null)}>Cancel</button></div>}
 </section>;
}
