import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SimulationDatePreview = {
  id: string;
  expiresAt: string;
  articles: {
    articleId: string;
    title: string;
    count: number;
    status: "eligible" | "incompatible";
    days: { date: string; count: number }[];
    comments: { id: string; name: string; content: string; currentTimestamp: string; plannedTimestamp: string }[];
  }[];
};

function requestError(error: { code?: string; message?: string }) {
  if (error.code === "22023") return new Error(error.message ?? "Prepare a fresh preview.");
  if (error.code === "PGRST202" || error.code === "42883") return new Error("The existing simulation dates migration is not installed.");
  return new Error("Request failed or its outcome is unknown. Prepare a fresh preview before retrying.");
}

export async function prepareExistingSimulationDates(client: SupabaseClient): Promise<SimulationDatePreview> {
  const { data, error } = await client.rpc("prepare_existing_simulation_dates").abortSignal(AbortSignal.timeout(30000));
  if (error) throw requestError(error);
  return data;
}

export async function confirmExistingSimulationDates(client: SupabaseClient, id: string): Promise<{ updated: number; skippedArticles: number }> {
  const { data, error } = await client.rpc("confirm_existing_simulation_dates", { p_preview_id: id, p_confirm: true }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw requestError(error);
  return data;
}
