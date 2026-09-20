import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key);
const client = configured ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
// Read-only checks against the configured project. No fixtures or credentials are logged.
test("live anonymous readers can read categories", { skip: !configured }, async () => {
  const { data, error } = await client.from("categories").select("id,name,slug").limit(100);
  assert.equal(Boolean(error), false, "Category query failed; check database connectivity and policies."); assert.ok(Array.isArray(data));
});
for (const status of ["draft", "archived"]) test("live RLS hides " + status + " articles", { skip: !configured }, async () => {
  const { data, error } = await client.from("articles").select("id").eq("status", status);
  assert.equal(Boolean(error), false, "Article query failed."); assert.equal(data.length, 0);
});
test("live anonymous readers cannot read profiles", { skip: !configured }, async () => {
  const { data, error } = await client.from("profiles").select("id").limit(1);
  if (error) assert.equal(error.code, "42501", "Profile query failed for a reason other than permission denial.");
  else assert.equal(data?.length, 0, "Administrator profile was publicly readable.");
});
test("live public article query exposes only published rows", { skip: !configured }, async () => {
  const { data, error } = await client.from("articles").select("id,status").limit(100);
  assert.equal(Boolean(error), false, "Public article query failed.");
  assert.ok(data.every(article => article.status === "published"));
});
