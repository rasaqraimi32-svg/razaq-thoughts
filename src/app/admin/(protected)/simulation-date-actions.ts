"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "@/lib/journal/validation";
import { prepareExistingSimulationDates, confirmExistingSimulationDates } from "@/lib/journal/existing-simulation-dates";

export async function previewExistingSimulationDatesAction() {
  await requireAdmin();
  try {
    return { result: await prepareExistingSimulationDates(await createClient()) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to prepare preview." };
  }
}

export async function confirmExistingSimulationDatesAction(id: string, confirmed: boolean) {
  await requireAdmin();
  if (confirmed !== true || typeof id !== "string" || !uuidPattern.test(id)) return { error: "Preview and explicit confirmation required." };
  try {
    const result = await confirmExistingSimulationDates(await createClient(), id);
    revalidatePath("/admin/comments");
    revalidatePath("/articles/[slug]", "page");
    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Confirmation failed; prepare a fresh preview." };
  }
}
